// 添加地点弹窗：支持逐个输入或批量输入（每行一个）
// 触发 store.addPlaces 进行地理编码

import { useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { useMapStore } from "@/store/useMapStore";
import { cn } from "@/lib/utils";

export default function AddPlaceModal() {
  const open = useMapStore((s) => s.addOpen);
  const close = useMapStore((s) => s.closeAddModal);
  const addPlaces = useMapStore((s) => s.addPlaces);
  const loading = useMapStore((s) => s.loading);
  const loadingMessage = useMapStore((s) => s.loadingMessage);
  const error = useMapStore((s) => s.error);
  const clearError = useMapStore((s) => s.clearError);

  const [text, setText] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    const names = text
      .split(/[\n,，;；]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    await addPlaces(names);
    // 仅当无错误时关闭
    if (!useMapStore.getState().error) {
      setText("");
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in"
      onClick={close}
    >
      <div
        className={cn(
          "relative w-[min(92vw,520px)] bg-paper-100 hand-border p-6 animate-slide-up",
          "shadow-[0_12px_40px_rgba(62,44,28,0.3)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 胶带装饰 */}
        <div className="tape" style={{ top: -10, left: "50%", marginLeft: -40, transform: "rotate(-3deg)" }} />

        <button
          onClick={close}
          className="absolute top-3 right-3 text-ink-600 hover:text-stamp-500 transition-colors"
          aria-label="关闭"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <MapPin size={22} className="text-stamp-500" />
          <h2 className="font-hand-cn text-3xl text-ink-800">添加地点</h2>
        </div>
        <p className="font-hand-en text-base text-ink-600 mb-4">
          输入地点名称，每行一个，或用逗号分隔
        </p>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) clearError();
          }}
          placeholder={"例如：\n北京天安门\n上海外滩\n杭州西湖"}
          rows={5}
          disabled={loading}
          className="font-hand-cn text-lg w-full bg-paper-50/70 border-2 border-dashed border-ink-600/50 rounded-lg p-3 resize-none outline-none focus:border-stamp-500 custom-scroll text-ink-800 placeholder:text-ink-600/50 disabled:opacity-60"
        />

        {error && (
          <p className="mt-3 text-sm text-stamp-600 font-serif bg-stamp-500/10 border border-stamp-500/30 rounded-md px-3 py-1.5">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between mt-5">
          <span className="font-hand-en text-base text-ink-600">
            {text.split(/[\n,，;；]/).filter((s) => s.trim()).length} 个地点
          </span>
          <div className="flex gap-2">
            <button
              onClick={close}
              disabled={loading}
              className="px-4 py-1.5 text-ink-700 hover:bg-paper-200/60 rounded-lg font-hand-cn text-lg transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className={cn(
                "flex items-center gap-1.5 px-5 py-1.5 bg-stamp-500 text-paper-50 hover:bg-stamp-600",
                "rounded-lg font-hand-cn text-lg transition-colors shadow-[2px_2px_0_rgba(62,44,28,0.2)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{loadingMessage || "查找中…"}</span>
                </>
              ) : (
                <span>添加</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
