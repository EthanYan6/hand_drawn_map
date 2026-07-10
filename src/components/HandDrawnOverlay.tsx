// 手绘 overlay 层：在地图容器上覆盖一个绝对定位层
// 内含 SVG 路线（rough.js）、地点标记、地名标签、泡泡会话框
// 监听 redrawTick 变化时重新计算所有元素像素位置

import { useEffect, useRef, useState, type MouseEvent } from "react";
import L from "leaflet";
import { useMapStore } from "@/store/useMapStore";
import {
  getRoughSvg,
  drawHandLine,
  drawHandArrow,
  drawHandPath,
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

  // 距离编辑状态：正在编辑的路段索引（toPlace 在 places 中的下标）
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [distInput, setDistInput] = useState("");

  const toggleBubble = useMapStore((s) => s.toggleBubble);
  const setBubbleOffset = useMapStore((s) => s.setBubbleOffset);
  const setNote = useMapStore((s) => s.setNote);
  const setDistance = useMapStore((s) => s.setDistance);

  // 计算坐标点在容器内的像素坐标
  const toPoint = (p: { lat: number; lon: number }) => {
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
    for (let i = 0; i < places.length - 1; i++) {
      const fromPlace = places[i];
      const toPlace = places[i + 1];
      const from = toPoint(fromPlace);
      const to = toPoint(toPlace);
      const route = toPlace.routeFromPrevious;
      if (route && route.length >= 2) {
        // 用单条 rough.js 路径绘制整条道路（比逐段绘制性能更好）
        const pts = [from, ...route.map((r) => toPoint(r)), to];
        drawHandPath(rc, svg, pts);
      } else {
        // 无路径：降级为两点手绘曲线
        const bend = i % 2 === 0 ? 1 : -1;
        drawHandLine(rc, svg, from, to, {}, bend);
      }
      // 箭头方向与位置（终点处后退一点，避免压住标记）
      // 方向取路径最后一段的方向，更贴合道路
      let angle: number;
      if (route && route.length >= 2) {
        const lastFrom = toPoint(route[route.length - 2]);
        const lastTo = toPoint(route[route.length - 1]);
        angle = Math.atan2(lastTo.y - lastFrom.y, lastTo.x - lastFrom.x);
      } else {
        angle = Math.atan2(to.y - from.y, to.x - from.x);
      }
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

  // 提交距离输入
  const handleDistSubmit = () => {
    if (editingSegment === null) return;
    const place = places[editingSegment];
    if (!place) return;
    const val = parseFloat(distInput);
    if (!Number.isNaN(val) && val >= 0) {
      setDistance(place.id, val);
    } else if (distInput.trim() === "") {
      setDistance(place.id, null);
    }
    setEditingSegment(null);
    setDistInput("");
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
            data-role="pin"
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
            data-role="label"
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

      {/* 路段距离标签与点击区 - 在路线中点显示 */}
      {places.slice(1).map((toPlace, idx) => {
        const fromPlace = places[idx];
        const from = toPoint(fromPlace);
        const to = toPoint(toPlace);
        const route = toPlace.routeFromPrevious;
        // 标签定位在路线中点，而非直线中点
        let midX: number;
        let midY: number;
        if (route && route.length >= 2) {
          const midRoute = route[Math.floor(route.length / 2)];
          const midPt = toPoint(midRoute);
          midX = midPt.x;
          midY = midPt.y;
        } else {
          midX = (from.x + to.x) / 2;
          midY = (from.y + to.y) / 2;
        }
        const dist = toPlace.distanceFromPrevious;
        const isEditing = editingSegment === idx + 1;

        return (
          <div
            key={`dist-${toPlace.id}`}
            data-role="distance"
            className="pointer-events-auto absolute"
            style={{
              left: midX - 40,
              top: midY - 14,
              width: 80,
            }}
          >
            {isEditing ? (
              <div
                className="flex items-center gap-1 bg-paper-50/95 border-2 border-ink-800 rounded-lg px-1.5 py-0.5 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  type="number"
                  value={distInput}
                  onChange={(e) => setDistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleDistSubmit();
                    if (e.key === "Escape") {
                      setEditingSegment(null);
                      setDistInput("");
                    }
                  }}
                  onBlur={handleDistSubmit}
                  placeholder="km"
                  className="w-12 text-sm font-hand-cn text-ink-800 bg-transparent outline-none text-center"
                />
                <span className="text-xs text-ink-600 font-hand-en">km</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingSegment(idx + 1);
                  setDistInput(
                    dist != null ? String(dist) : "",
                  );
                }}
                className="block w-full text-center text-xs font-hand-cn px-1.5 py-0.5 rounded-md transition-all hover:bg-paper-50/80"
                style={{
                  color: dist != null ? "#3E2C1C" : "rgba(82, 64, 46, 0.5)",
                  background:
                    dist != null ? "rgba(251, 243, 224, 0.85)" : "transparent",
                  border: dist != null
                    ? "1px solid rgba(62, 44, 28, 0.3)"
                    : "1px solid transparent",
                }}
                title="点击设置距离"
              >
                {dist != null ? `${dist} km` : "···"}
              </button>
            )}
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
            data-role="bubble"
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
