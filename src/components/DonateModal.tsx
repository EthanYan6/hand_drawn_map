// 打赏弹窗：手账风格，展示友好文案与微信/支付宝付款码

import { useState } from "react";
import { Coffee, X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DonateModal() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"wechat" | "alipay">("wechat");

  return (
    <>
      {/* 触发按钮：与导出按钮同行，放在导出按钮左侧，尺寸一致 72×72 */}
      <button
        onClick={() => setOpen(true)}
        className="absolute top-6 right-[96px] z-[600] group"
        aria-label="打赏"
        title="打赏请喝咖啡"
      >
        <div className="relative w-[72px] h-[72px] flex items-center justify-center">
          {/* 背景圆盘 - 暖咖啡色 */}
          <svg
            className="absolute inset-0 group-hover:animate-wobble"
            viewBox="0 0 72 72"
            fill="none"
          >
            <circle
              cx="36"
              cy="36"
              r="33"
              fill="#6B5742"
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
          <div className="relative flex flex-col items-center justify-center text-paper-50">
            <Coffee size={20} strokeWidth={2.5} />
            <span className="font-hand-cn text-sm leading-none mt-0.5">打赏</span>
          </div>
        </div>
      </button>

      {/* 弹窗 */}
      {open && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink-900/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className={cn(
              "relative w-[min(92vw,380px)] bg-paper-100 hand-border p-6 animate-slide-up",
              "shadow-[0_12px_40px_rgba(62,44,28,0.35)]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 胶带装饰 */}
            <div
              className="tape"
              style={{ top: -10, left: "50%", marginLeft: -40, transform: "rotate(-3deg)" }}
            />

            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-ink-600 hover:text-stamp-500 transition-colors"
              aria-label="关闭"
            >
              <X size={20} />
            </button>

            {/* 标题 */}
            <div className="flex items-center gap-2 mb-1 justify-center">
              <Coffee size={22} className="text-stamp-500" />
              <h2 className="font-hand-cn text-3xl text-ink-800">请喝杯咖啡</h2>
            </div>
            <p className="font-hand-en text-base text-ink-600 text-center mb-1">
              Buy me a coffee
            </p>

            {/* 友好文案 */}
            <div className="mt-3 mb-4 px-3 py-2.5 bg-paper-50/70 border border-dashed border-ink-600/40 rounded-lg">
              <p className="font-hand-cn text-[15px] leading-relaxed text-ink-700 text-center">
                感谢使用旅行手账～
                <br />
                如果这个小工具为你的旅程增添了
                <br />
                一点点乐趣，欢迎请我喝杯咖啡 ☕
                <br />
                你的支持是我继续完善的动力 ❤️
              </p>
            </div>

            {/* 付款码切换标签 */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveTab("wechat")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-hand-cn text-base transition-all border-2",
                  activeTab === "wechat"
                    ? "bg-watercolor-500 text-paper-50 border-ink-800 shadow-[2px_2px_0_rgba(62,44,28,0.2)]"
                    : "bg-paper-50/60 text-ink-700 border-ink-700/40 hover:border-watercolor-500/60",
                )}
              >
                微信赞赏
              </button>
              <button
                onClick={() => setActiveTab("alipay")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-hand-cn text-base transition-all border-2",
                  activeTab === "alipay"
                    ? "bg-stamp-500 text-paper-50 border-ink-800 shadow-[2px_2px_0_rgba(62,44,28,0.2)]"
                    : "bg-paper-50/60 text-ink-700 border-ink-700/40 hover:border-stamp-500/60",
                )}
              >
                支付宝
              </button>
            </div>

            {/* 付款码图片：完整显示（含底部名称），按原始比例自适应高度 */}
            <div className="flex justify-center">
              <div className="relative">
                <img
                  src={`${import.meta.env.BASE_URL}${
                    activeTab === "wechat" ? "wechat_pay.jpg" : "ali_pay.jpg"
                  }`}
                  alt={activeTab === "wechat" ? "微信赞赏码" : "支付宝赞赏码"}
                  className="w-[240px] h-auto block border-2 border-ink-800 rounded-[14px_10px_16px_9px] shadow-[3px_3px_0_rgba(62,44,28,0.18)]"
                />
                {/* 角标 */}
                <div className="absolute -top-2 -right-2 bg-stamp-500 text-paper-50 text-[10px] font-hand-en px-2 py-0.5 rounded-full border border-ink-800 rotate-6">
                  扫一扫
                </div>
              </div>
            </div>

            <p className="mt-3 text-center font-hand-en text-sm text-ink-600/80 flex items-center justify-center gap-1">
              <Heart size={12} className="text-stamp-500 fill-stamp-500" />
              长按或扫描二维码即可
            </p>
          </div>
        </div>
      )}
    </>
  );
}
