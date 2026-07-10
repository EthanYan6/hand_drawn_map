// OSRM 公共路由服务：获取两点间的道路路径
// 用于手绘连线按实际道路弯曲，而非直线
// OSRM 失败时降级为本地模拟弯曲路径（中点位移算法）
// 公共服务器文档：http://project-osrm.org/docs/v5.24.0/api/

export interface RoutePoint {
  lat: number;
  lon: number;
}

// ── 路由缓存 ──────────────────────────────────────
// 按 from/to 坐标缓存路由结果，避免重复请求
const routeCache = new Map<string, RoutePoint[]>();

function cacheKey(from: RoutePoint, to: RoutePoint): string {
  return `${from.lat.toFixed(4)},${from.lon.toFixed(4)}-${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
}

export function clearRouteCache(): void {
  routeCache.clear();
}

// ── OSRM 请求节流 ──────────────────────────────────
// OSRM 公共服务器有速率限制，调用需节流
let lastRouteTime = 0;
const ROUTE_MIN_INTERVAL = 300; // 300ms 间隔

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

// 路由距离上限：超过此值（如跨国）跳过 OSRM，直接用模拟路径
const MAX_ROUTE_DISTANCE_KM = 2000;

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

// ── 本地模拟弯曲路径（中点位移算法）──────────────────
// 当 OSRM 不可用或超时时，用确定性算法生成自然弯曲的路径
// 基于坐标哈希生成随机种子，保证同一组点每次结果一致（不会因重绘而变化）

function hashCoords(from: RoutePoint, to: RoutePoint): number {
  let h = 2166136261;
  const str = `${from.lat.toFixed(3)},${from.lon.toFixed(3)},${to.lat.toFixed(3)},${to.lon.toFixed(3)}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// 用中点位移算法模拟弯曲路径
// 迭代 3 次产生 9 个点，足够呈现自然弯曲线条
function simulateRoute(from: RoutePoint, to: RoutePoint): RoutePoint[] {
  const seed = hashCoords(from, to);
  const rand = seededRandom(seed);

  // 经度修正：高纬度地区 1° lon 的实际距离比 1° lat 短
  const lonScale = Math.cos((from.lat * Math.PI) / 180);

  let points: RoutePoint[] = [{ ...from }, { ...to }];

  const iterations = 3;
  for (let iter = 0; iter < iterations; iter++) {
    const next: RoutePoint[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      next.push(a);

      // 中点
      const midLat = (a.lat + b.lat) / 2;
      const midLon = (a.lon + b.lon) / 2;

      // 线段在 lat/lon 空间的方向向量（修正经度）
      const dx = (b.lon - a.lon) * lonScale;
      const dy = b.lat - a.lat;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // 法线方向（垂直于线段）
      const nx = -dy / len;
      const ny = dx / len;

      // 位移量：与线段长度成正比，逐次递减
      const maxDisplace = len * 0.2 * Math.pow(0.55, iter);
      const displace = (rand() - 0.5) * 2 * maxDisplace;

      next.push({
        lat: midLat + ny * displace,
        lon: midLon + (nx * displace) / lonScale,
      });
    }
    next.push(points[points.length - 1]);
    points = next;
  }

  return points;
}

// 获取两点间的驾驶路径
// 1. 先查缓存，命中直接返回
// 2. 尝试 OSRM 获取真实道路路径
// 3. OSRM 失败/超时/远距离时降级为本地模拟弯曲路径
export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[]> {
  const key = cacheKey(from, to);
  const cached = routeCache.get(key);
  if (cached) return cached;

  // 远距离跳过 OSRM，直接模拟
  const dist = haversineKm(from, to);
  let result: RoutePoint[];

  if (dist > MAX_ROUTE_DISTANCE_KM) {
    result = simulateRoute(from, to);
  } else {
    // 尝试 OSRM
    const osrmRoute = await fetchOSRMRoute(from, to);
    result = osrmRoute ?? simulateRoute(from, to);
  }

  routeCache.set(key, result);
  return result;
}

// 调用 OSRM 公共服务器获取真实道路路径
async function fetchOSRMRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoutePoint[] | null> {
  try {
    await throttle();
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson&steps=false`;
    // 3 秒超时，防止请求挂起
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
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
    // 降采样：最多 15 个点，平衡细节与渲染性能
    return downsample(points, 15);
  } catch {
    return null;
  }
}
