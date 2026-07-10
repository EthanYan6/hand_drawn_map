// 手账风纸张质感面板容器
// 提供统一的米色纸张背景、手绘边框、可选胶带装饰

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PaperPanelProps {
  children: ReactNode;
  className?: string;
  // 是否显示胶带装饰
  tape?: boolean;
  // 胶带位置
  tapePosition?: "top-left" | "top-right" | "top-center";
}

export default function PaperPanel({
  children,
  className,
  tape = false,
  tapePosition = "top-center",
}: PaperPanelProps) {
  const tapeStyle: Record<string, React.CSSProperties> = {
    "top-left": { top: -10, left: 20, transform: "rotate(-8deg)" },
    "top-right": { top: -10, right: 20, transform: "rotate(6deg)" },
    "top-center": { top: -10, left: "50%", marginLeft: -40, transform: "rotate(-2deg)" },
  };

  return (
    <div
      className={cn(
        "relative bg-paper-100/95 backdrop-blur-sm hand-border",
        "shadow-[0_4px_20px_rgba(62,44,28,0.15)]",
        className,
      )}
    >
      {/* 纸张纹理叠加 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.24 0 0 0 0 0.17 0 0 0 0 0.11 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {tape && <div className="tape z-10" style={tapeStyle[tapePosition]} />}
      <div className="relative z-[1] h-full overflow-hidden">{children}</div>
    </div>
  );
}
