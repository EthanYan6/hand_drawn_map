// 箭头泡泡会话框：手绘风格，可输入文字或上传图片
// 位置由父组件控制，本组件负责内容与样式

import { useRef, useState, type MouseEvent } from "react";
import { ImagePlus, Type, X, GripVertical, RotateCcw } from "lucide-react";
import type { PlaceLocation, PlaceNote } from "@/types";
import { cn } from "@/lib/utils";

interface BubbleNoteProps {
  place: PlaceLocation;
  index: number;
  onClose: () => void;
  onNoteChange: (note: PlaceNote | null) => void;
  onDragStart: (e: MouseEvent<HTMLDivElement>) => void;
}

export default function BubbleNote({
  place,
  index,
  onClose,
  onNoteChange,
  onDragStart,
}: BubbleNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(place.note?.content ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const note = place.note;

  const handleSaveText = () => {
    const text = draft.trim();
    onNoteChange(text ? { type: "text", content: text } : null);
    setEditing(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("图片大小请控制在 2MB 以内");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onNoteChange({ type: "image", content: reader.result as string });
      setEditing(false);
    };
    reader.readAsDataURL(file);
    // 清空 input 以便重复选择同一文件
    e.target.value = "";
  };

  // 调整箭头方向：偏移在标记上方时箭头朝下，下方时朝上
  const arrowDown = place.bubbleOffset.y < 0;

  return (
    <div
      className="relative select-none"
      style={{ width: 230 }}
      data-bubble={place.id}
    >
      {/* 箭头 SVG：固定像素定位，避免 html2canvas 百分比 transform 偏移 */}
      <svg
        className={cn(
          "absolute pointer-events-none",
          arrowDown ? "-bottom-2" : "-top-2 rotate-180",
        )}
        style={{ left: 101 }}
        width="28"
        height="16"
        viewBox="0 0 28 16"
        fill="none"
      >
        <path
          d="M14 15 C 12 8, 6 4, 2 2 C 8 5, 12 10, 14 15 Z M14 15 C 16 8, 22 4, 26 2 C 20 5, 16 10, 14 15 Z"
          fill="#FBF3E0"
          stroke="#3E2C1C"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>

      {/* 泡泡主体 */}
      <div
        className={cn(
          "relative bg-paper-50/95 border-2 border-ink-800",
          "shadow-[2px_3px_0_rgba(62,44,28,0.18),0_6px_16px_rgba(62,44,28,0.12)]",
          // 不规则圆角模拟手绘
          "rounded-[20px_16px_22px_14px/14px_22px_16px_20px]",
        )}
      >
        {/* 标题栏 - 可拖拽 */}
        <div
          className="flex items-center gap-1.5 border-b-2 border-dashed border-ink-700/50 px-2.5 py-1.5 cursor-grab active:cursor-grabbing"
          onMouseDown={onDragStart}
        >
          <GripVertical size={13} className="text-ink-600/70 shrink-0" />
          <span className="font-hand-cn text-base text-ink-800 truncate flex-1">
            <span className="text-stamp-500 mr-1">#{index}</span>
            {place.name}
          </span>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-stamp-500 transition-colors p-0.5"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-2.5 min-h-[64px]">
          {!note && !editing && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-ink-700 hover:bg-paper-200/60 rounded-lg transition-colors border border-dashed border-ink-600/40"
              >
                <Type size={14} className="text-watercolor-600" />
                <span className="font-hand-en text-base">添加文字</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-ink-700 hover:bg-paper-200/60 rounded-lg transition-colors border border-dashed border-ink-600/40"
              >
                <ImagePlus size={14} className="text-watercolor-600" />
                <span className="font-hand-en text-base">上传图片</span>
              </button>
            </div>
          )}

          {note?.type === "text" && !editing && (
            <div className="group relative">
              <p className="font-hand-cn text-base text-ink-800 whitespace-pre-wrap break-words leading-snug pr-5">
                {note.content}
              </p>
              <button
                onClick={() => {
                  setDraft(note.content);
                  setEditing(true);
                }}
                className="absolute top-0 right-0 text-ink-500 hover:text-stamp-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="编辑"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          )}

          {note?.type === "image" && !editing && (
            <div className="group relative">
              <img
                src={note.content}
                alt={place.name}
                className="w-full max-h-40 object-cover rounded-[10px_8px_12px_7px] border border-ink-700/40"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute top-1 right-1 bg-paper-50/90 p-1 rounded-full text-ink-600 hover:text-stamp-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="替换图片"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          )}

          {editing && (
            <div className="flex flex-col gap-1.5">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="写下这里的见闻…"
                rows={3}
                className="font-hand-cn text-base text-ink-800 bg-paper-50/70 border border-dashed border-ink-600/50 rounded-md p-1.5 resize-none outline-none focus:border-stamp-500 custom-scroll"
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="px-2 py-0.5 text-xs text-ink-600 hover:text-ink-800 font-hand-en text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveText}
                  className="px-2.5 py-0.5 text-xs bg-ink-800 text-paper-50 hover:bg-ink-900 rounded-md font-hand-en text-sm transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
