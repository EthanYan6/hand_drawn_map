// 地图主组件：初始化 Leaflet、瓦片层、fitBounds、overlay 容器
// 手绘路线、地点标记、泡泡会话框由 HandDrawnOverlay 负责

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useMapStore } from "@/store/useMapStore";
import { MAX_ZOOM_BY_LEVEL, MIN_ZOOM_BY_LEVEL } from "@/utils/mapLevel";
import { setMapInstance } from "@/utils/mapInstance";
import HandDrawnOverlay from "@/components/HandDrawnOverlay";

// CARTO Voyager 无地名瓦片：仅保留地形与省/市/县/国行政边境线，无原生文字标注
// 地名由 overlay 层显示用户输入的地点名称
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  // 重绘版本号，每次地图移动/缩放递增以触发 overlay 重算位置
  const [redrawTick, setRedrawTick] = useState(0);
  // 用于 rAF 节流
  const rafRef = useRef<number | null>(null);

  const places = useMapStore((s) => s.places);
  const fitVersion = useMapStore((s) => s.fitVersion);
  const mapLevel = useMapStore((s) => s.mapLevel);
  // places 的 ref：让 fitBounds useEffect 能拿到最新 places，
  // 但依赖里不放 places，避免 openAllBubbles/setNote/toggleBubble 改 places 引用时触发 fitBounds 导致导出时视野变化
  const placesRef = useRef(places);
  placesRef.current = places;

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [30, 110],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 18,
    });
    mapRef.current = map;
    setMapInstance(map);

    const tile = L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: "abcd",
      maxZoom: 19,
      crossOrigin: true,
    });
    tile.addTo(map);
    tileRef.current = tile;

    // 节流重绘 overlay
    const scheduleRedraw = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setRedrawTick((t) => t + 1);
      });
    };
    map.on("move zoom viewreset zoomanim resize", scheduleRedraw);

    // 首次也触发一次
    scheduleRedraw();

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // fitBounds：根据地点列表自动适配视野
  // 依赖 fitVersion（addPlaces/removePlace/movePlace 时递增）与 mapLevel
  // 不依赖 places 引用：避免 openAllBubbles/setNote/toggleBubble 改 places 时触发 fitBounds
  // 否则导出前 openAllBubbles 会让地图重新 fitBounds，视野变化导致导出与所见不一致
  useEffect(() => {
    const map = mapRef.current;
    const currentPlaces = placesRef.current;
    if (!map || currentPlaces.length === 0) return;
    const valid = currentPlaces.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));
    if (valid.length === 0) return;
    const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lon] as [number, number]));
    const maxZoom = MAX_ZOOM_BY_LEVEL[mapLevel];
    const minZoom = MIN_ZOOM_BY_LEVEL[mapLevel];
    // 给一点 padding，避免地点贴边
    map.fitBounds(bounds, { padding: [80, 80], maxZoom });
    // 如果缩放后仍小于该层级下限，拉到下限
    if (map.getZoom() < minZoom) {
      map.setZoom(minZoom);
    }
  }, [fitVersion, mapLevel]);

  return (
    <div id="map-capture-target" className="absolute inset-0 watercolor-tiles">
      <div ref={containerRef} className="w-full h-full" />
      {mapRef.current && (
        <HandDrawnOverlay
          map={mapRef.current}
          places={places}
          redrawTick={redrawTick}
        />
      )}
    </div>
  );
}
