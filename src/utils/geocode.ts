// Nominatim 地理编码调用，带 1 次/秒节流
// API 文档：https://nominatim.org/release-docs/develop/api/Search/

import type { LanguageCode, PlaceAddress } from "@/types";

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lon: number;
  address: PlaceAddress;
}

// 节流队列：保证相邻请求间隔 ≥ 1100ms（留 100ms 余量）
let lastRequestTime = 0;
const pendingQueue: Array<() => void> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleNext(): void {
  if (timer !== null) return;
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + 1100 - now);
  timer = setTimeout(() => {
    timer = null;
    const task = pendingQueue.shift();
    if (task) {
      lastRequestTime = Date.now();
      task();
    }
    if (pendingQueue.length > 0) scheduleNext();
  }, wait);
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pendingQueue.push(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    });
    scheduleNext();
  });
}

// 将 Nominatim 的 address 字段归一化为统一的 PlaceAddress
function normalizeAddress(addr: NominatimResult["address"]): PlaceAddress {
  if (!addr) return {};
  // city 字段优先取 city/town/village/municipality
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county;
  return {
    city,
    state: addr.state,
    country: addr.country,
    country_code: addr.country_code?.toUpperCase(),
  };
}

// 单个地点查询，language 控制 displayName 显示语言
export async function geocodePlace(
  name: string,
  language: LanguageCode = "zh-CN",
): Promise<GeocodeResult> {
  return enqueue(async () => {
    const params = new URLSearchParams({
      q: name,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      "accept-language": language,
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`地理编码失败：${res.status}`);
    }
    const data = (await res.json()) as NominatimResult[];
    if (!data || data.length === 0) {
      throw new Error(`未找到地点：${name}`);
    }
    const first = data[0];
    return {
      displayName: first.display_name,
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      address: normalizeAddress(first.address),
    };
  });
}

// 批量查询（自动节流），返回结果顺序与输入一致
export async function geocodePlaces(
  names: string[],
  language: LanguageCode = "zh-CN",
): Promise<GeocodeResult[]> {
  const results: GeocodeResult[] = [];
  for (const name of names) {
    try {
      const r = await geocodePlace(name, language);
      results.push(r);
    } catch (e) {
      // 失败的地点用占位结果，调用方自行处理
      results.push({
        displayName: name,
        lat: NaN,
        lon: NaN,
        address: {},
      });
      console.warn("地理编码失败：", name, e);
    }
  }
  return results;
}

// 仅重新查询 displayName（用于切换语言，保持坐标不变）
export async function refetchDisplayNames(
  places: { id: string; name: string; lat: number; lon: number }[],
  language: LanguageCode,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const p of places) {
    if (Number.isNaN(p.lat) || Number.isNaN(p.lon)) {
      result.set(p.id, p.name);
      continue;
    }
    try {
      // 使用 reverse geocoding 获取指定语言的 display_name
      const r = await enqueue(async () => {
        const params = new URLSearchParams({
          lat: String(p.lat),
          lon: String(p.lon),
          format: "jsonv2",
          "accept-language": language,
          zoom: "10",
        });
        const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`反向查询失败：${res.status}`);
        const data = (await res.json()) as { display_name?: string };
        return data.display_name ?? p.name;
      });
      result.set(p.id, r);
    } catch {
      result.set(p.id, p.name);
    }
  }
  return result;
}
