// 导出图片弹窗：输入标题、手写签名（输入名字生成或自己手写），触发导出

import { useEffect, useRef, useState } from "react";
import { Download, X, Loader2, PenTool, Type, Eraser } from "lucide-react";
import { useMapStore } from "@/store/useMapStore";
import { exportImage } from "@/utils/exportImage";
import { cn } from "@/lib/utils";

type SignatureMode = "input" | "draw";

export default function ExportModal() {
  const open = useMapStore((s) => s.exportOpen);
  const close = useMapStore((s) => s.closeExportModal);
  const places = useMapStore((s) => s.places);

  const [title, setTitle] = useState("");
  const [sigMode, setSigMode] = useState<SignatureMode>("input");
  const [signName, setSignName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 手写签名画布
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // 弹窗打开时初始化画布尺寸
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 等待 DOM 渲染后设置实际尺寸
    requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#3E2C1C";
        ctx.lineWidth = 2.8;
      }
      setHasDrawn(false);
    });
  }, [open, sigMode]);

  if (!open) return null;

  // 画布事件
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = getPos(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPtRef.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPtRef.current = pos;
    setHasDrawn(true);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPtRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // 忽略
    }
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleExport = async () => {
    if (places.length === 0) {
      setError("请先添加至少一个地点");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      // 收集签名数据：输入模式用名字字符串，手写模式用画布 dataURL
      let signature: string | null = null;
      if (sigMode === "input") {
        signature = signName.trim() || null;
      } else if (sigMode === "draw" && hasDrawn) {
        signature = canvasRef.current?.toDataURL("image/png") ?? null;
      }
      await exportImage(title, signature);
      close();
      setTitle("");
      setSignName("");
      setHasDrawn(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in"
      onClick={exporting ? undefined : close}
    >
      <div
        className={cn(
          "relative w-[min(92vw,480px)] max-h-[90vh] overflow-y-auto custom-scroll bg-paper-100 hand-border p-6 animate-slide-up",
          "shadow-[0_12px_40px_rgba(62,44,28,0.3)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tape" style={{ top: -10, right: 30, transform: "rotate(5deg)" }} />

        <button
          onClick={close}
          disabled={exporting}
          className="absolute top-3 right-3 text-ink-600 hover:text-stamp-500 transition-colors disabled:opacity-50"
          aria-label="关闭"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Download size={22} className="text-stamp-500" />
          <h2 className="font-hand-cn text-3xl text-ink-800">导出手账</h2>
        </div>
        <p className="font-hand-en text-base text-ink-600 mb-4">
          为这张旅行地图起个名字吧
        </p>

        {/* 标题输入 */}
        <input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !exporting) handleExport();
          }}
          placeholder="例如：2026 春日江南行"
          disabled={exporting}
          maxLength={30}
          className="hand-input w-full text-xl py-2"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-hand-en text-base text-ink-600/70">
            {title.length}/30
          </span>
          <span className="font-hand-en text-base text-ink-600/70">
            1920 × 1280 PNG
          </span>
        </div>

        {/* 手写签名区 */}
        <div className="mt-4 pt-4 border-t border-dashed border-ink-700/40">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5">
              <PenTool size={15} className="text-watercolor-600" />
              <span className="font-hand-cn text-base text-ink-700">手写签名</span>
            </label>
            {/* 模式切换 */}
            <div className="flex gap-1 bg-paper-200/60 rounded-lg p-0.5">
              <button
                onClick={() => setSigMode("input")}
                disabled={exporting}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-hand-cn transition-colors",
                  sigMode === "input"
                    ? "bg-stamp-500 text-paper-50"
                    : "text-ink-700 hover:bg-paper-100",
                )}
              >
                <Type size={12} />
                输入
              </button>
              <button
                onClick={() => setSigMode("draw")}
                disabled={exporting}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-hand-cn transition-colors",
                  sigMode === "draw"
                    ? "bg-stamp-500 text-paper-50"
                    : "text-ink-700 hover:bg-paper-100",
                )}
              >
                <PenTool size={12} />
                手写
              </button>
            </div>
          </div>

          {sigMode === "input" ? (
            <input
              type="text"
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              placeholder="输入你的名字，将生成为手写体签名"
              disabled={exporting}
              maxLength={20}
              className="hand-input w-full text-lg py-1.5"
            />
          ) : (
            <div className="relative">
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                className="w-full h-[100px] bg-paper-50/70 border-2 border-dashed border-ink-600/50 rounded-lg touch-none cursor-crosshair"
              />
              {hasDrawn && (
                <button
                  onClick={clearCanvas}
                  disabled={exporting}
                  className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-0.5 bg-paper-100/90 text-ink-600 hover:text-stamp-500 rounded-md text-xs font-hand-en transition-colors"
                >
                  <Eraser size={11} />
                  清除
                </button>
              )}
              {!hasDrawn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="font-hand-en text-sm text-ink-600/50">
                    在此区域手写签名 ✍️
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-stamp-600 font-serif bg-stamp-500/10 border border-stamp-500/30 rounded-md px-3 py-1.5">
            {error}
          </p>
        )}

        {exporting && (
          <div className="mt-3 flex items-center gap-2 text-ink-700 bg-watercolor-500/15 border border-watercolor-500/30 rounded-md px-3 py-2">
            <Loader2 size={16} className="animate-spin text-watercolor-600" />
            <span className="font-hand-cn text-base">
              正在生成手账图片，请稍候…
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={close}
            disabled={exporting}
            className="px-4 py-1.5 text-ink-700 hover:bg-paper-200/60 rounded-lg font-hand-cn text-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className={cn(
              "flex items-center gap-1.5 px-5 py-1.5 bg-stamp-500 text-paper-50 hover:bg-stamp-600",
              "rounded-lg font-hand-cn text-lg transition-colors shadow-[2px_2px_0_rgba(62,44,28,0.2)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>生成中</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>导出图片</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
