// 手绘 overlay 层：在地图容器上覆盖一个绝对定位层
// 内含 SVG 路线（rough.js）、地点标记、地名标签、泡泡会话框
// 监听 redrawTick 变化时重新计算所有元素像素位置

import { useEffect, useRef, type MouseEvent } from "react";
import L from "leaflet";
import { useMapStore } from "@/store/useMapStore";
import {
  getRoughSvg,
  drawHandLine,
  drawHandArrow,
  clearSvg,
} from "@/utils/roughDraw";
import HandPin from "@/components/HandPin";
import BubbleNote from "@/components/BubbleNote";
import type { PlaceLocation } from "@/types";

interface HandDrawnOverlayProps {
  map: L.Map;
  places: PlaceLocation[];
  redrawTick: number;
}

// 从 displayName 中提取简短名称用于地图标签
// Nominatim 的 display_name 通常是逗号分隔，第一段是最具体的名称
function shortName(place: PlaceLocation): string {
  // 优先用用户输入的原始名称（更符合用户预期）
  if (place.name && place.name.trim()) {
    return place.name.trim();
  }
  const parts = place.displayName.split(",");
  return parts[0].trim();
}

export default function HandDrawnOverlay({
  map,
  places,
  redrawTick,
}: HandDrawnOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // 拖拽状态
  const dragRef = useRef<{
    placeId: string;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
  } | null>(null);
  // 最新的 places 引用（供全局监听使用）
  const placesRef = useRef(places);
  placesRef.current = places;

  const toggleBubble = useMapStore((s) => s.toggleBubble);
  const setBubbleOffset = useMapStore((s) => s.setBubbleOffset);
  const setNote = useMapStore((s) => s.setNote);

  // 计算单个地点在容器内的像素坐标
  const toPoint = (p: PlaceLocation) => {
    const pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lon));
    return { x: pt.x, y: pt.y };
  };

  // 绘制手绘路线（每次 places 或 redrawTick 变化时重绘）
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    clearSvg(svg);
    if (places.length < 2) return;
    const rc = getRoughSvg(svg);
    const points = places.map(toPoint);
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      // 交替弯曲方向，模拟手绘蜿蜒
      const bend = i % 2 === 0 ? 1 : -1;
      drawHandLine(rc, svg, from, to, {}, bend);
      // 箭头方向与位置（终点处后退一点，避免压住标记）
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const arrowPos = {
        x: to.x - Math.cos(angle) * 22,
        y: to.y - Math.sin(angle) * 22,
      };
      drawHandArrow(rc, svg, arrowPos, angle, 11);
    }
  }, [places, redrawTick, map]);

  // 拖拽泡泡的全局监听（仅绑定一次）
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setBubbleOffset(d.placeId, {
        x: d.startOffset.x + dx,
        y: d.startOffset.y + dy,
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setBubbleOffset]);

  const handleBubbleDragStart = (placeId: string, e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const place = placesRef.current.find((p) => p.id === placeId);
    if (!place) return;
    dragRef.current = {
      placeId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: { ...place.bubbleOffset },
    };
  };

  return (
    <div
      ref={overlayRef}
      id="map-overlay-layer"
      className="pointer-events-none absolute inset-0 z-[500] overflow-hidden"
    >
      {/* 路线 SVG（铺满容器，pointer-events none） */}
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
      />

      {/* 地点标记 */}
      {places.map((place, i) => {
        const pt = toPoint(place);
        return (
          <div
            key={`pin-${place.id}`}
            className="pointer-events-auto absolute"
            style={{
              left: pt.x - 20,
              top: pt.y - 52,
              width: 40,
              height: 52,
            }}
          >
            <button
              onClick={() => toggleBubble(place.id)}
              className="block cursor-pointer hover:animate-wobble focus:outline-none shrink-0"
              aria-label={`地点 ${i + 1}: ${place.name}`}
              title={place.displayName}
            >
              <HandPin index={i + 1} active={place.bubbleOpen} />
            </button>
          </div>
        );
      })}

      {/* 地名标签 - 显示在坐标点正下方（固定宽度容器，内部居中） */}
      {places.map((place) => {
        const pt = toPoint(place);
        return (
          <div
            key={`label-${place.id}`}
            className="pointer-events-none absolute flex justify-center"
            style={{
              left: pt.x - 80,
              top: pt.y + 6,
              width: 160,
            }}
          >
            <span
              className="inline-block max-w-[150px] truncate px-2 py-0.5 text-sm font-hand-cn text-ink-800 whitespace-nowrap"
              style={{
                background: "rgba(251, 243, 224, 0.92)",
                border: "1.5px solid rgba(62, 44, 28, 0.5)",
                borderRadius: "8px 6px 9px 5px",
                boxShadow: "1px 1px 0 rgba(62, 44, 28, 0.15)",
              }}
              title={place.displayName}
            >
              {shortName(place)}
            </span>
          </div>
        );
      })}

      {/* 泡泡会话框 */}
      {places.map((place, i) => {
        if (!place.bubbleOpen) return null;
        const pt = toPoint(place);
        // 泡泡宽度固定 230，水平居中对准偏移点；垂直由偏移正负决定在上下方
        const arrowDown = place.bubbleOffset.y < 0;
        return (
          <div
            key={`bubble-${place.id}`}
            className="pointer-events-auto absolute"
            style={{
              left: pt.x + place.bubbleOffset.x - 115,
              top: arrowDown
                ? pt.y + place.bubbleOffset.y - 120
                : pt.y + place.bubbleOffset.y,
              width: 230,
            }}
          >
            <BubbleNote
              place={place}
              index={i + 1}
              onClose={() => toggleBubble(place.id)}
              onNoteChange={(note) => setNote(place.id, note)}
              onDragStart={(e) => handleBubbleDragStart(place.id, e)}
            />
          </div>
        );
      })}
    </div>
  );
}
