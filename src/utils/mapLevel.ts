// 地理跨度识别：根据地点列表判断地图层级与初始缩放

import type { LanguageCode, MapLevel, PlaceLocation } from "@/types";
import { COUNTRY_LANGUAGE } from "@/types";

// 判断地点列表所属的地图层级
export function detectMapLevel(places: PlaceLocation[]): MapLevel {
  if (places.length === 0) return "world";

  const valid = places.filter((p) => p.address && p.address.country);
  if (valid.length === 0) return "world";

  const countries = new Set(
    valid
      .map((p) => p.address.country_code ?? p.address.country)
      .filter((v): v is string => Boolean(v)),
  );
  if (countries.size > 1) return "world";

  const states = new Set(
    valid
      .map((p) => p.address.state)
      .filter((v): v is string => Boolean(v)),
  );
  if (states.size > 1) return "country";

  const cities = new Set(
    valid
      .map((p) => p.address.city)
      .filter((v): v is string => Boolean(v)),
  );
  if (cities.size > 1) return "province";

  return "city";
}

// 检测地点列表的主导国家，返回对应的默认显示语言
// 取出现次数最多的国家代码，若无法识别则回退到中文
export function detectLanguage(places: PlaceLocation[]): LanguageCode {
  if (places.length === 0) return "zh-CN";
  const counts = new Map<string, number>();
  for (const p of places) {
    const code = p.address?.country_code;
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) return "zh-CN";
  // 找出出现次数最多的国家代码
  let topCode = "";
  let topCount = 0;
  for (const [code, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topCode = code;
    }
  }
  return COUNTRY_LANGUAGE[topCode] ?? "en";
}

// 各层级对应的默认最大缩放（fitBounds 上限，避免过度放大）
export const MAX_ZOOM_BY_LEVEL: Record<MapLevel, number> = {
  city: 13,
  province: 9,
  country: 6,
  world: 4,
};

// 各层级对应的最小缩放（fitBounds 下限）
export const MIN_ZOOM_BY_LEVEL: Record<MapLevel, number> = {
  city: 11,
  province: 7,
  country: 4,
  world: 2,
};
