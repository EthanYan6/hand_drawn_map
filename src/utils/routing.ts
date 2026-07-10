// OSRM 公共路由服务：获取两点间的道路路径
// 用于手绘连线按实际道路弯曲，而非直线
// 公共服务器文档：http://project-osrm.org/docs/v5.24.0/api/

export interface RoutePoint {
  lat: number;
  lon: number;
}

// OSRM 公共服务器有速率限制，调用需节流
let lastRouteTime = 0;
const ROUTE_MIN_INTERVAL = 1100; // 1.1s 间隔

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastRouteTime + ROUTE_MIN_INTERVAL - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRouteTime = Date.now();
}

// Haversine 公式计算两点间球面距离（公里）
export function haversineKm(
  a: RoutePoint,
  b: RoutePoint,
): number {
  const R = 6371; // 地球半径 km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 路由距离上限：超过此值（如跨国）跳过 OSRM，直接用直线
const MAX_ROUTE_DISTANCE_KM = 500;

// 路径点降采样：最多保留 maxPoints 个点，均匀抽取
function downsample(
  points: RoutePoint[],
  maxPoints: number,
): RoutePoint[] {
  if (points.length <= maxPoints) return points;
  const result: RoutePoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  // 确保最后一个点是终点
  result[result.length - 1] = points[points.length - 1];
  return result;
}

// 获取两点间的驾驶路径
// 远距离（>500km，如跨国）跳过，返回 null 降级为直线
// 失败时返回 null，调用方降级为直线
export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[] | null> {
  // 远距离跳过路由，避免跨国请求超时
  const dist = haversineKm(from, to);
  if (dist > MAX_ROUTE_DISTANCE_KM) return null;

  try {
    await throttle();
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson&steps=false`;
    // 5 秒超时，防止请求挂起阻塞 UI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const coords: unknown = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // OSRM 返回 [lon, lat][]，转换为 {lat, lon}[]
    const points = coords.map((c) => {
      const [lon, lat] = c as [number, number];
      return { lat, lon };
    });
    // 降采样：最多 50 个点，防止 SVG 渲染过载
    return downsample(points, 50);
  } catch {
    return null;
  }
}
