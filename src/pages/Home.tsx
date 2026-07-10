// 主页：全屏地图 + 顶部弹幕统计 + 左侧手账面板 + 右上角导出按钮 + 弹窗

import { Plus, Download, Compass, AlertCircle, X } from "lucide-react";
import MapView from "@/components/MapView";
import PaperPanel from "@/components/PaperPanel";
import PlaceList from "@/components/PlaceList";
import AddPlaceModal from "@/components/AddPlaceModal";
import ExportModal from "@/components/ExportModal";
import DanmakuBar from "@/components/DanmakuBar";
import DonateModal from "@/components/DonateModal";
import { useMapStore } from "@/store/useMapStore";

export default function Home() {
  const openAddModal = useMapStore((s) => s.openAddModal);
  const openExportModal = useMapStore((s) => s.openExportModal);
  const places = useMapStore((s) => s.places);
  const error = useMapStore((s) => s.error);
  const clearError = useMapStore((s) => s.clearError);

  return (
    <div className="relative w-full h-full overflow-hidden paper-texture">
      {/* 地图底层 */}
      <MapView />

      {/* 顶部弹幕统计条 */}
      <DanmakuBar />

      {/* 顶部装饰标题（地图上方居中） */}
      <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-[600] text-center">
        <h1 className="font-hand-cn text-4xl text-ink-800 drop-shadow-[1px_1px_0_rgba(251,243,224,0.8)]">
          旅行手账
        </h1>
        <p className="font-hand-en text-xl text-ink-700 -mt-1 drop-shadow-[1px_1px_0_rgba(251,243,224,0.8)]">
          Hand-drawn Travel Map
        </p>
      </div>

      {/* 左侧控制面板 */}
      <aside className="absolute top-6 left-6 bottom-6 w-[300px] z-[600] flex flex-col">
        <PaperPanel tape tapePosition="top-left" className="flex flex-col h-full">
          {/* 面板头部 */}
          <div className="px-4 pt-4 pb-3 border-b-2 border-dashed border-ink-700/40">
            <div className="flex items-center gap-2">
              <Compass size={20} className="text-stamp-500" />
              <h2 className="font-hand-cn text-2xl text-ink-800">我的足迹</h2>
            </div>
          </div>

          {/* 添加按钮 */}
          <div className="px-3 py-3">
            <button
              onClick={openAddModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-stamp-500 text-paper-50 hover:bg-stamp-600 rounded-xl font-hand-cn text-xl transition-colors shadow-[2px_2px_0_rgba(62,44,28,0.2)] hover:shadow-[3px_3px_0_rgba(62,44,28,0.25)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0"
            >
              <Plus size={18} />
              添加地点
            </button>
          </div>

          {/* 地点列表 */}
          <div className="flex-1 min-h-0 px-2 pb-3">
            <PlaceList />
          </div>
        </PaperPanel>
      </aside>

      {/* 右上角导出按钮（印章风格） */}
      <button
        onClick={openExportModal}
        disabled={places.length === 0}
        className="absolute top-6 right-6 z-[600] group disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="导出图片"
        title="导出为图片"
      >
        <div className="relative w-[72px] h-[72px] flex items-center justify-center">
          {/* 印章外圈 */}
          <svg
            className="absolute inset-0 group-hover:animate-wobble"
            viewBox="0 0 72 72"
            fill="none"
          >
            <circle
              cx="36"
              cy="36"
              r="33"
              fill="#C73E1D"
              stroke="#3E2C1C"
              strokeWidth="2.5"
            />
            <circle
              cx="36"
              cy="36"
              r="27"
              fill="none"
              stroke="#FBF3E0"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          </svg>
          {/* 印章文字 */}
          <div className="relative flex flex-col items-center justify-center text-paper-50">
            <Download size={20} strokeWidth={2.5} />
            <span className="font-hand-cn text-sm leading-none mt-0.5">导出</span>
          </div>
        </div>
      </button>

      {/* 错误提示 toast */}
      {error && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[700] animate-slide-up">
          <div className="flex items-center gap-2 bg-stamp-500/95 text-paper-50 px-4 py-2.5 rounded-xl shadow-[0_4px_20px_rgba(199,62,29,0.4)] border-2 border-ink-800 max-w-[80vw]">
            <AlertCircle size={18} className="shrink-0" />
            <span className="font-serif text-sm">{error}</span>
            <button
              onClick={clearError}
              className="ml-2 text-paper-50/80 hover:text-paper-50 shrink-0"
              aria-label="关闭提示"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 弹窗 */}
      <AddPlaceModal />
      <ExportModal />
      <DonateModal />

      {/* 底部水印 */}
      <div className="pointer-events-none absolute bottom-3 right-4 z-[600] font-hand-en text-sm text-ink-600/60">
        ✦ 旅行手账 · 手绘地图生成器
      </div>
    </div>
  );
}
