// 全局 Leaflet 地图实例引用
// MapView 初始化时调用 setMapInstance，导出时通过 getMapInstance 获取
// 用于在 exportImage 中将 lat/lon 转为容器像素坐标

import type L from "leaflet";

let mapInstance: L.Map | null = null;

export function setMapInstance(map: L.Map): void {
  mapInstance = map;
}

export function getMapInstance(): L.Map | null {
  return mapInstance;
}
