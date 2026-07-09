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

// 获取两点间的驾驶路径
// 失败时返回 null，调用方降级为直线
export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[] | null> {
  try {
    await throttle();
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const coords: unknown = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // OSRM 返回 [lon, lat][]，转换为 {lat, lon}[]
    return coords.map((c) => {
      const [lon, lat] = c as [number, number];
      return { lat, lon };
    });
  } catch {
    return null;
  }
}
