// 已添加地点列表：手账风编号、上下移动、删除

import { ChevronUp, ChevronDown, Trash2, MapPin } from "lucide-react";
import { useMapStore } from "@/store/useMapStore";
import { MAP_LEVEL_LABEL } from "@/types";
import { cn } from "@/lib/utils";

export default function PlaceList() {
  const places = useMapStore((s) => s.places);
  const removePlace = useMapStore((s) => s.removePlace);
  const movePlace = useMapStore((s) => s.movePlace);
  const toggleBubble = useMapStore((s) => s.toggleBubble);
  const mapLevel = useMapStore((s) => s.mapLevel);
  const clearPlaces = useMapStore((s) => s.clearPlaces);

  if (places.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <div className="inline-block mb-3 opacity-60">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <path
              d="M28 8 C 38 8, 46 16, 46 26 C 46 38, 28 50, 28 50 C 28 50, 10 38, 10 26 C 10 16, 18 8, 28 8 Z"
              stroke="#52402E"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4 3"
            />
            <circle cx="28" cy="26" r="6" stroke="#52402E" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <p className="font-hand-cn text-lg text-ink-600">
          还没有地点
        </p>
        <p className="font-hand-en text-base text-ink-600/70 mt-1">
          点击上方按钮添加你的旅行足迹
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部信息条 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed border-ink-700/40">
        <span className="font-hand-cn text-sm text-ink-700">
          {places.length} 站 · {MAP_LEVEL_LABEL[mapLevel]}
        </span>
        <button
          onClick={clearPlaces}
          className="font-hand-en text-sm text-ink-500 hover:text-stamp-500 transition-colors"
        >
          清空
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2 py-2 space-y-1.5">
        {places.map((place, i) => (
          <div
            key={place.id}
            className={cn(
              "group flex items-start gap-2 p-2 rounded-lg",
              "bg-paper-50/60 border border-ink-700/30",
              "hover:border-stamp-500/50 hover:bg-paper-50 transition-colors",
            )}
          >
            {/* 编号圆 */}
            <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-stamp-500 text-paper-50 font-hand-en text-base font-bold border-2 border-ink-800">
              {i + 1}
            </div>

            {/* 信息 */}
            <button
              onClick={() => toggleBubble(place.id)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-center gap-1">
                <MapPin size={12} className="text-stamp-500 shrink-0" />
                <span className="font-hand-cn text-base text-ink-800 truncate">
                  {place.name}
                </span>
              </div>
              <p className="text-xs text-ink-600/80 truncate font-serif mt-0.5">
                {place.displayName}
              </p>
              {place.note && (
                <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-watercolor-500/20 text-watercolor-600 rounded font-hand-en text-sm">
                  {place.note.type === "text" ? "已备注" : "已配图"}
                </span>
              )}
            </button>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => movePlace(place.id, "up")}
                disabled={i === 0}
                className="text-ink-600 hover:text-stamp-500 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                aria-label="上移"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => movePlace(place.id, "down")}
                disabled={i === places.length - 1}
                className="text-ink-600 hover:text-stamp-500 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                aria-label="下移"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <button
              onClick={() => removePlace(place.id)}
              className="text-ink-500 hover:text-stamp-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 self-center"
              aria-label="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
