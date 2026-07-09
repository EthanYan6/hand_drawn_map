// rough.js 手绘渲染辅助函数
// 用于在 SVG overlay 上绘制手绘风格的路线与箭头

import rough from "roughjs";
import { type RoughSVG } from "roughjs/bin/svg";
import type { Options as RoughOptions } from "roughjs/bin/core";

// 默认手绘配置：墨水深棕、轻微抖动
export const DEFAULT_ROUGH_OPTIONS: RoughOptions = {
  roughness: 1.6,
  bowing: 2.2,
  stroke: "#3E2C1C",
  strokeWidth: 2.6,
  // 多次绘制以模拟墨迹浓淡
  // rough.js 通过 seed 控制抖动种子，保证每次绘制一致
};

// 偏淡的辅助配置（用于次要线条）
export const LIGHT_ROUGH_OPTIONS: RoughOptions = {
  ...DEFAULT_ROUGH_OPTIONS,
  strokeWidth: 1.8,
  roughness: 1.2,
};

// 获取/创建一个 rough.js SVG 实例（基于传入的 svg 元素）
export function getRoughSvg(svg: SVGSVGElement): RoughSVG {
  return rough.svg(svg);
}

// 在两点间生成贝塞尔曲线的控制点（带轻微随机偏移，模拟手绘弯曲）
export function computeControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  // 偏移强度，正值向上凸，负值向下凹
  bend = 1,
): { x: number; y: number } {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // 法线方向（顺时针 90°）
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // 偏移量约为线段长度的 15%
  const offset = len * 0.15 * bend;
  return { x: midX + nx * offset, y: midY + ny * offset };
}

// 在 SVG 上绘制手绘风格曲线路径
export function drawHandLine(
  rc: RoughSVG,
  svg: SVGSVGElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options?: Partial<RoughOptions>,
  bend = 1,
): SVGGElement {
  const ctrl = computeControlPoint(from, to, bend);
  // 构造二次贝塞尔曲线的 path d
  const d = `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}`;
  const opts = { ...DEFAULT_ROUGH_OPTIONS, ...options };
  const node = rc.path(d, opts) as SVGGElement;
  svg.appendChild(node);
  return node;
}

// 在终点处绘制手绘箭头（三角形）
export function drawHandArrow(
  rc: RoughSVG,
  svg: SVGSVGElement,
  point: { x: number; y: number },
  // 箭头指向方向（弧度）
  angle: number,
  size = 12,
  options?: Partial<RoughOptions>,
): SVGGElement {
  // 三角形顶点：尖端在 point，两翼向后展开
  const wingAngle = Math.PI / 6; // 30°
  const p1 = point;
  const p2 = {
    x: point.x - size * Math.cos(angle - wingAngle),
    y: point.y - size * Math.sin(angle - wingAngle),
  };
  const p3 = {
    x: point.x - size * Math.cos(angle + wingAngle),
    y: point.y - size * Math.sin(angle + wingAngle),
  };
  const opts = { ...DEFAULT_ROUGH_OPTIONS, fill: "#3E2C1C", fillStyle: "solid", ...options };
  const node = rc.polygon(
    [
      [p1.x, p1.y],
      [p2.x, p2.y],
      [p3.x, p3.y],
    ],
    opts,
  ) as SVGGElement;
  svg.appendChild(node);
  return node;
}

// 清空 SVG 内容
export function clearSvg(svg: SVGSVGElement): void {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}
