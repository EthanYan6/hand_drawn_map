// 导出图片：手动捕获瓦片层 + SVG 路线层序列化为图片
// + 图钉/标签/距离标签手动绘制到 canvas（绕过 html2canvas 对 CSS transform 的 bug）
// + html2canvas 仅捕获泡泡（透明背景叠加）
// + 合成标题区（含签名）+ 日期时间 + 里程信息框，输出 PNG

import html2canvas from "html2canvas";
import L from "leaflet";
import { useMapStore } from "@/store/useMapStore";
import { getMapInstance } from "@/utils/mapInstance";
import type { PlaceLocation } from "@/types";

const EXPORT_W = 1920;
const EXPORT_H = 1100;
const TITLE_RATIO = 0.09; // 标题区占比（收紧，减少空白）
const TITLE_MAP_GAP = 0; // 标题区与地图之间无间距
const CAPTURE_SCALE = 2; // 瓦片与 overlay 都用 2 倍像素密度

// 等待字体加载完成
async function ensureFontsReady(): Promise<void> {
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    // 忽略字体加载失败
  }
}

// 绘制仿古纸张背景（含渐变与噪点）
function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "#F4E8D0";
  ctx.fillRect(0, 0, w, h);
  const g1 = ctx.createRadialGradient(
    w * 0.2, h * 0.3, 0,
    w * 0.2, h * 0.3, w * 0.6,
  );
  g1.addColorStop(0, "rgba(62, 44, 28, 0.05)");
  g1.addColorStop(1, "rgba(62, 44, 28, 0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(
    w * 0.8, h * 0.7, 0,
    w * 0.8, h * 0.7, w * 0.6,
  );
  g2.addColorStop(0, "rgba(199, 62, 29, 0.04)");
  g2.addColorStop(1, "rgba(199, 62, 29, 0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
}

// 绘制手绘风格装饰线（标题两侧）
function drawTitleDecoration(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  halfWidth: number,
): void {
  ctx.strokeStyle = "#3E2C1C";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  const leftStart = centerX - halfWidth;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = leftStart - 200 + t * 200;
    const y = centerY + Math.sin(t * Math.PI * 3) * 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  const rightStart = centerX + halfWidth;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = rightStart + t * 200;
    const y = centerY + Math.sin(t * Math.PI * 3 + 1) * 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#C73E1D";
  for (const dir of [-1, 1]) {
    const x = centerX + dir * (halfWidth + 220);
    ctx.beginPath();
    ctx.moveTo(x, centerY - 6);
    ctx.lineTo(x + 5, centerY);
    ctx.lineTo(x, centerY + 6);
    ctx.lineTo(x - 5, centerY);
    ctx.closePath();
    ctx.fill();
  }
}

// 将图片（dataURL 或 blob URL）加载为 Image
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 绘制标题区（含标题、签名、副标题）
async function drawTitleArea(
  ctx: CanvasRenderingContext2D,
  title: string,
  signature: string | null,
  w: number,
  h: number,
): Promise<void> {
  // 标题区背景
  ctx.fillStyle = "#FBF3E0";
  ctx.fillRect(0, 0, w, h);
  drawPaperBackground(ctx, w, h);

  // 标题下方的分隔虚线
  ctx.strokeStyle = "rgba(62, 44, 28, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(60, h - 12);
  ctx.lineTo(w - 60, h - 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // 标题文字
  ctx.fillStyle = "#3E2C1C";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleFontSize = Math.round(h * 0.4);
  ctx.font = `${titleFontSize}px "Ma Shan Zheng", "Noto Serif SC", serif`;
  const centerX = w / 2;
  const titleY = h * 0.42;
  ctx.fillText(title, centerX, titleY);

  // 测量标题宽度绘制装饰
  const metrics = ctx.measureText(title);
  const halfWidth = metrics.width / 2 + 30;
  drawTitleDecoration(ctx, centerX, titleY, halfWidth);

  // 副标题
  ctx.fillStyle = "rgba(82, 64, 46, 0.7)";
  ctx.font = `${Math.round(h * 0.085)}px "Caveat", cursive`;
  ctx.fillText("Travel Journal", centerX, h - 26);

  // 签名：右下角
  if (signature) {
    if (signature.startsWith("data:")) {
      // 手写画布签名：绘制图片
      try {
        const img = await loadImage(signature);
        // 限制签名最大高度，等比缩放
        const maxH = h * 0.28;
        const maxW = w * 0.22;
        let dw = img.width;
        let dh = img.height;
        const ratio = Math.min(maxW / dw, maxH / dh, 1);
        dw *= ratio;
        dh *= ratio;
        const dx = w - dw - 50;
        const dy = h - dh - 38;
        ctx.drawImage(img, dx, dy, dw, dh);
      } catch {
        // 加载失败忽略
      }
    } else {
      // 输入名字：用手写体绘制文字
      ctx.fillStyle = "#3E2C1C";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.font = `${Math.round(h * 0.17)}px "Ma Shan Zheng", "Caveat", cursive`;
      ctx.fillText(signature, w - 50, h - 30);
      // 签名下划线
      const sigMetrics = ctx.measureText(signature);
      ctx.strokeStyle = "rgba(62, 44, 28, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w - 50 - sigMetrics.width, h - 26);
      ctx.lineTo(w - 50, h - 26);
      ctx.stroke();
    }
  }
}

// 格式化日期时间：2026-07-09 14:30
function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// 绘制右下角日期时间
function drawDateTime(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const text = formatDateTime(new Date());
  ctx.fillStyle = "rgba(82, 64, 46, 0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `16px "Caveat", "Noto Serif SC", serif`;
  ctx.fillText(text, w - 16, h - 12);
}

// 绘制右下角里程信息框（总公里数、开始日期、结束日期）
function drawTripInfo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  totalKm: number,
  startDate?: string,
  endDate?: string,
): void {
  const hasInfo = totalKm > 0 || startDate || endDate;
  if (!hasInfo) return;

  const boxW = 200;
  const boxH = 88;
  const boxX = w - boxW - 16;
  const boxY = h - boxH - 36;

  // 半透明背景框
  ctx.fillStyle = "rgba(251, 243, 224, 0.88)";
  ctx.strokeStyle = "rgba(62, 44, 28, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // 不规则圆角模拟手绘
  const r1 = 8, r2 = 6, r3 = 9, r4 = 5;
  ctx.moveTo(boxX + r1, boxY);
  ctx.lineTo(boxX + boxW - r2, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r2);
  ctx.lineTo(boxX + boxW, boxY + boxH - r3);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r3, boxY + boxH);
  ctx.lineTo(boxX + r4, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r4);
  ctx.lineTo(boxX, boxY + r1);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r1, boxY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let lineY = boxY + 18;
  const lineH = 26;
  const labelX = boxX + 14;
  const valueX = boxX + 70;

  // 总里程
  if (totalKm > 0) {
    ctx.fillStyle = "rgba(82, 64, 46, 0.7)";
    ctx.font = `13px "Noto Serif SC", serif`;
    ctx.fillText("总里程", labelX, lineY);
    ctx.fillStyle = "#3E2C1C";
    ctx.font = `bold 15px "Noto Serif SC", serif`;
    ctx.fillText(`${totalKm.toFixed(1)} km`, valueX, lineY);
    lineY += lineH;
  }

  // 开始日期
  if (startDate) {
    ctx.fillStyle = "rgba(82, 64, 46, 0.7)";
    ctx.font = `13px "Noto Serif SC", serif`;
    ctx.fillText("出发", labelX, lineY);
    ctx.fillStyle = "#3E2C1C";
    ctx.font = `14px "Noto Serif SC", serif`;
    ctx.fillText(startDate, valueX, lineY);
    lineY += lineH;
  }

  // 结束日期
  if (endDate) {
    ctx.fillStyle = "rgba(82, 64, 46, 0.7)";
    ctx.font = `13px "Noto Serif SC", serif`;
    ctx.fillText("返程", labelX, lineY);
    ctx.fillStyle = "#3E2C1C";
    ctx.font = `14px "Noto Serif SC", serif`;
    ctx.fillText(endDate, valueX, lineY);
  }
}

// 手动捕获 Leaflet 瓦片层
// 绕过 html2canvas 在 scale 下对 mapPane/tile transform 的渲染 bug
// 直接遍历已加载的瓦片 <img>，用 getBoundingClientRect 计算位置后 drawImage
async function captureTileLayer(
  container: HTMLElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  const rect = container.getBoundingClientRect();
  const w = Math.round(rect.width * scale);
  const h = Math.round(rect.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建瓦片 canvas 上下文");

  // 背景色（与纸张一致，避免瓦片缝隙露白）
  ctx.fillStyle = "#F4E8D0";
  ctx.fillRect(0, 0, w, h);

  // 收集所有瓦片
  const tiles = Array.from(
    container.querySelectorAll("img.leaflet-tile"),
  ) as HTMLImageElement[];

  // 等待所有瓦片加载完成（带超时保护）
  await Promise.all(
    tiles.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 3000);
      });
    }),
  );

  // 按当前可视位置绘制每个瓦片
  const containerRect = container.getBoundingClientRect();
  ctx.scale(scale, scale);
  for (const img of tiles) {
    if (!img.complete || img.naturalWidth === 0) continue;
    const tileRect = img.getBoundingClientRect();
    const x = tileRect.left - containerRect.left;
    const y = tileRect.top - containerRect.top;
    if (x + tileRect.width < 0 || x > rect.width) continue;
    if (y + tileRect.height < 0 || y > rect.height) continue;
    const opacity = parseFloat(
      window.getComputedStyle(img).opacity || "1",
    );
    if (opacity <= 0) continue;
    ctx.globalAlpha = opacity;
    ctx.drawImage(img, x, y, tileRect.width, tileRect.height);
    ctx.globalAlpha = 1;
  }

  return canvas;
}

// 将 SVG 路线层序列化为图片（绕过 html2canvas 对复杂 SVG 的性能瓶颈）
async function captureSvgLayer(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale: number,
): Promise<HTMLCanvasElement | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 从 displayName 中提取简短名称（与 HandDrawnOverlay 一致）
function shortName(place: PlaceLocation): string {
  if (place.name && place.name.trim()) {
    return place.name.trim();
  }
  const parts = place.displayName.split(",");
  return parts[0].trim();
}

// 截断文本以适应最大宽度
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (
    truncated.length > 0 &&
    ctx.measureText(truncated + "…").width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

// 生成单个图钉 SVG 字符串（不含编号文字，编号用 canvas 绘制以确保字体正确）
function generatePinSvg(): string {
  return `<svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 50 L16 38 L24 38 Z" fill="#C73E1D" stroke="#3E2C1C" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M20 4 C 28 4, 36 11, 36 20 C 36 30, 28 38, 20 38 C 12 38, 4 30, 4 20 C 4 11, 12 4, 20 4 Z" fill="#C73E1D" stroke="#3E2C1C" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="15" cy="14" rx="4" ry="3" fill="rgba(255,255,255,0.4)"/>
  <circle cx="20" cy="21" r="9" fill="#FBF3E0" stroke="#3E2C1C" stroke-width="1.5"/>
</svg>`;
}

// 预加载图钉图片（所有图钉形状相同，只需加载一次）
async function preloadPinImage(): Promise<HTMLImageElement> {
  const svgString = generatePinSvg();
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);
  try {
    return await loadImage(url);
  } finally {
    // Image 已加载后可安全释放 blob URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// 手动绘制图钉、地名标签、距离标签到 canvas
// 绕过 html2canvas 对 CSS transform 的渲染 bug
async function drawOverlayElements(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  places: PlaceLocation[],
  scale: number,
): Promise<void> {
  const pinImg = await preloadPinImage();

  ctx.save();
  ctx.scale(scale, scale);

  // 计算每个地点的像素坐标
  const points = places.map((p) => {
    const pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lon));
    return { x: pt.x, y: pt.y };
  });

  // 1. 绘制图钉（图片 + 编号文字）
  for (let i = 0; i < places.length; i++) {
    const pt = points[i];
    const pinX = pt.x - 20; // 图钉左上角 x
    const pinY = pt.y - 52; // 图钉左上角 y

    // drop-shadow（非激活状态）
    ctx.save();
    ctx.shadowColor = "rgba(62, 44, 28, 0.25)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(pinImg, pinX, pinY, 40, 52);
    ctx.restore();

    // 编号文字（canvas 绘制以确保字体正确）
    ctx.fillStyle = "#3E2C1C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 14px "Caveat", cursive';
    ctx.fillText(String(i + 1), pt.x, pinY + 21);
  }

  // 2. 绘制地名标签
  for (let i = 0; i < places.length; i++) {
    const pt = points[i];
    const name = shortName(places[i]);
    const labelY = pt.y + 6; // 标签顶部 y（与 HandDrawnOverlay 一致）

    // 测量文本宽度
    ctx.font = '14px "Ma Shan Zheng", "Noto Serif SC", serif';
    const truncated = truncateText(ctx, name, 134); // max-w-[150px] - padding
    const metrics = ctx.measureText(truncated);
    const padX = 8;
    const padY = 3;
    const boxW = metrics.width + padX * 2;
    const boxH = 14 + padY * 2 + 6; // 文本高度 + padding + 余量
    const boxX = pt.x - boxW / 2;

    // 背景
    ctx.fillStyle = "rgba(251, 243, 224, 0.92)";
    ctx.strokeStyle = "rgba(62, 44, 28, 0.5)";
    ctx.lineWidth = 1.5;
    // 不规则圆角矩形（模拟手绘）
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(boxX + r, labelY);
    ctx.lineTo(boxX + boxW - r * 0.8, labelY);
    ctx.quadraticCurveTo(boxX + boxW, labelY, boxX + boxW, labelY + r);
    ctx.lineTo(boxX + boxW, labelY + boxH - r * 1.2);
    ctx.quadraticCurveTo(
      boxX + boxW, labelY + boxH,
      boxX + boxW - r, labelY + boxH,
    );
    ctx.lineTo(boxX + r * 0.7, labelY + boxH);
    ctx.quadraticCurveTo(boxX, labelY + boxH, boxX, labelY + boxH - r);
    ctx.lineTo(boxX, labelY + r);
    ctx.quadraticCurveTo(boxX, labelY, boxX + r, labelY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = "#3E2C1C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '14px "Ma Shan Zheng", "Noto Serif SC", serif';
    ctx.fillText(truncated, pt.x, labelY + boxH / 2);
  }

  // 3. 绘制距离标签
  for (let i = 1; i < places.length; i++) {
    const dist = places[i].distanceFromPrevious;
    if (dist == null) continue;

    const from = points[i - 1];
    const to = points[i];
    const route = places[i].routeFromPrevious;
    // 标签定位在路线中点，而非直线中点
    let midX: number;
    let midY: number;
    if (route && route.length >= 2) {
      const midRoute = route[Math.floor(route.length / 2)];
      const midPt = map.latLngToContainerPoint(
        L.latLng(midRoute.lat, midRoute.lon),
      );
      midX = midPt.x;
      midY = midPt.y;
    } else {
      midX = (from.x + to.x) / 2;
      midY = (from.y + to.y) / 2;
    }

    const text = `${dist} km`;
    ctx.font = '12px "Ma Shan Zheng", "Noto Serif SC", serif';
    const metrics = ctx.measureText(text);
    const padX = 6;
    const padY = 2;
    const boxW = metrics.width + padX * 2;
    const boxH = 12 + padY * 2 + 4;
    const boxX = midX - boxW / 2;
    const boxY = midY - boxH / 2;

    // 背景
    ctx.fillStyle = "rgba(251, 243, 224, 0.85)";
    ctx.strokeStyle = "rgba(62, 44, 28, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = "#3E2C1C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '12px "Ma Shan Zheng", "Noto Serif SC", serif';
    ctx.fillText(text, midX, midY);
  }

  ctx.restore();
}

// 捕获泡泡层（仅泡泡，隐藏其他 overlay 元素）
async function captureBubbles(
  overlay: HTMLElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  // 隐藏所有非泡泡元素
  const hiddenEls = overlay.querySelectorAll<HTMLElement>(
    '[data-role="pin"], [data-role="label"], [data-role="distance"]',
  );
  const savedDisplays: { el: HTMLElement; display: string }[] = [];
  hiddenEls.forEach((el) => {
    savedDisplays.push({ el, display: el.style.display });
    el.style.display = "none";
  });

  // 同时隐藏 SVG 路线层（调用方已隐藏，但确保）
  const svgEl = overlay.querySelector("svg");
  const savedSvgDisplay = svgEl?.style.display || "";
  if (svgEl) svgEl.style.display = "none";

  // 修正气泡标题栏导出布局：文字上移修正基线，图标同步下移对齐同一行
  const titleBars = overlay.querySelectorAll<HTMLElement>(
    '[data-role="bubble-title"]',
  );
  const savedTitleBarStyles: { el: HTMLElement; cssText: string }[] = [];
  titleBars.forEach((titleBar) => {
    savedTitleBarStyles.push({ el: titleBar, cssText: titleBar.style.cssText });
    titleBar.style.overflow = "visible";
    titleBar.style.alignItems = "center";
    titleBar.style.paddingTop = "4px";
    titleBar.style.paddingBottom = "8px";
  });

  const titleTextElements = overlay.querySelectorAll<HTMLElement>(
    '[data-role="bubble-title-text"]',
  );
  const savedTitleTextStyles: { el: HTMLElement; cssText: string }[] = [];
  titleTextElements.forEach((titleTextElement) => {
    savedTitleTextStyles.push({
      el: titleTextElement,
      cssText: titleTextElement.style.cssText,
    });
    titleTextElement.style.overflow = "visible";
    titleTextElement.style.textOverflow = "clip";
    titleTextElement.style.transform = "translateY(-0.5em)";
  });

  const titleActionElements = overlay.querySelectorAll<HTMLElement>(
    '[data-role="bubble-title-grip"], [data-role="bubble-title-close"]',
  );
  const savedTitleActionStyles: { el: HTMLElement; cssText: string }[] = [];
  titleActionElements.forEach((actionElement) => {
    savedTitleActionStyles.push({
      el: actionElement,
      cssText: actionElement.style.cssText,
    });
    actionElement.style.display = "flex";
    actionElement.style.alignItems = "center";
    actionElement.style.flexShrink = "0";
    actionElement.style.transform = "translateY(-0.15em)";
  });

  try {
    const canvas = await html2canvas(overlay, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: null, // 透明背景
      scale,
      logging: false,
      imageTimeout: 0,
    });
    return canvas;
  } finally {
    // 恢复所有元素
    savedDisplays.forEach(({ el, display }) => {
      el.style.display = display;
    });
    if (svgEl) svgEl.style.display = savedSvgDisplay;
    savedTitleBarStyles.forEach(({ el, cssText }) => {
      el.style.cssText = cssText;
    });
    savedTitleTextStyles.forEach(({ el, cssText }) => {
      el.style.cssText = cssText;
    });
    savedTitleActionStyles.forEach(({ el, cssText }) => {
      el.style.cssText = cssText;
    });
  }
}

// 计算所有地点和路线点的边界，用于导出时自动缩放居中
function calculateExportBounds(places: PlaceLocation[]): L.LatLngBounds {
  const points: [number, number][] = [];
  for (const place of places) {
    if (!Number.isNaN(place.lat) && !Number.isNaN(place.lon)) {
      points.push([place.lat, place.lon]);
    }
    if (place.routeFromPrevious) {
      for (const routePoint of place.routeFromPrevious) {
        if (!Number.isNaN(routePoint.lat) && !Number.isNaN(routePoint.lon)) {
          points.push([routePoint.lat, routePoint.lon]);
        }
      }
    }
  }
  if (points.length === 0) {
    throw new Error("无可用的地点坐标");
  }
  return L.latLngBounds(points);
}

// 根据页面上已渲染的备注气泡 DOM，扩展导出边界（含偏移与箭头余量）
function extendBoundsWithBubbleElements(
  baseBounds: L.LatLngBounds,
  map: L.Map,
  overlayEl: HTMLElement,
): L.LatLngBounds {
  const southWest = baseBounds.getSouthWest();
  const northEast = baseBounds.getNorthEast();
  const extendedBounds = L.latLngBounds(southWest, northEast);

  const overlayRect = overlayEl.getBoundingClientRect();
  const bubbleElements = overlayEl.querySelectorAll<HTMLElement>(
    '[data-role="bubble"]',
  );
  const arrowMargin = 24;

  bubbleElements.forEach((bubbleElement) => {
    const bubbleRect = bubbleElement.getBoundingClientRect();
    const left = bubbleRect.left - overlayRect.left - arrowMargin;
    const top = bubbleRect.top - overlayRect.top - arrowMargin;
    const right = bubbleRect.right - overlayRect.left + arrowMargin;
    const bottom = bubbleRect.bottom - overlayRect.top + arrowMargin;

    const topLeftPoint = L.point(left, top);
    const bottomRightPoint = L.point(right, bottom);
    const topLeftLatLng = map.containerPointToLatLng(topLeftPoint);
    const bottomRightLatLng = map.containerPointToLatLng(bottomRightPoint);

    extendedBounds.extend(topLeftLatLng);
    extendedBounds.extend(bottomRightLatLng);
  });

  return extendedBounds;
}

// 判断两次边界是否基本一致，避免 fitBounds 反复震荡
function isBoundsNearlyEqual(
  boundsA: L.LatLngBounds,
  boundsB: L.LatLngBounds,
): boolean {
  const southWestA = boundsA.getSouthWest();
  const northEastA = boundsA.getNorthEast();
  const southWestB = boundsB.getSouthWest();
  const northEastB = boundsB.getNorthEast();
  const latThreshold = 1e-6;
  const lngThreshold = 1e-6;

  const latSame =
    Math.abs(southWestA.lat - southWestB.lat) < latThreshold &&
    Math.abs(northEastA.lat - northEastB.lat) < latThreshold;
  const lngSame =
    Math.abs(southWestA.lng - southWestB.lng) < lngThreshold &&
    Math.abs(northEastA.lng - northEastB.lng) < lngThreshold;

  return latSame && lngSame;
}

// 导出前自动缩放：先按地点/路线 fit，再纳入备注气泡位置后二次 fit
async function fitMapViewForExport(
  map: L.Map,
  places: PlaceLocation[],
  overlayEl: HTMLElement,
  target: HTMLElement,
): Promise<void> {
  let bounds = calculateExportBounds(places);
  map.invalidateSize();

  const maxIterations = 2;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    map.fitBounds(bounds, {
      animate: false,
      padding: [120, 120],
      maxZoom: 16,
    });

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => setTimeout(() => resolve(), 200)),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    const extendedBounds = extendBoundsWithBubbleElements(
      bounds,
      map,
      overlayEl,
    );
    const boundsUnchanged = isBoundsNearlyEqual(bounds, extendedBounds);
    if (boundsUnchanged) {
      break;
    }
    bounds = extendedBounds;
  }

  await waitForTilesLoaded(target, 8000);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// 等待地图瓦片加载完成（DOM 轮询方式）
async function waitForTilesLoaded(
  container: HTMLElement,
  timeoutMs = 4000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tiles = Array.from(
      container.querySelectorAll("img.leaflet-tile"),
    ) as HTMLImageElement[];
    if (tiles.length > 0) {
      let allLoaded = true;
      for (const img of tiles) {
        if (!img.complete || img.naturalWidth === 0) {
          allLoaded = false;
          break;
        }
      }
      if (allLoaded) return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

// 计算地图在导出图中的绘制区域：顶部紧贴标题区下方，底部贴齐底边
function calculateMapDrawRect(
  mapCanvasWidth: number,
  mapCanvasHeight: number,
  exportWidth: number,
  exportHeight: number,
  titleHeight: number,
): { drawX: number; drawY: number; drawW: number; drawH: number } {
  const mapTop = titleHeight + TITLE_MAP_GAP;
  const availableHeight = exportHeight - mapTop;
  const availableWidth = exportWidth;
  const mapRatio = mapCanvasWidth / mapCanvasHeight;

  let drawH = availableHeight;
  let drawW = drawH * mapRatio;

  if (drawW > availableWidth) {
    drawW = availableWidth;
    drawH = drawW / mapRatio;
  }

  const drawX = (availableWidth - drawW) / 2;
  // 地图顶部紧贴标题下方（虚线），底部尽量贴齐底边
  const drawY = mapTop;

  return { drawX, drawY, drawW, drawH };
}

// 主导出函数
// title: 标题；signature: 签名（字符串=名字 / dataURL=手写图片 / null=无签名）
// startDate: 开始日期（YYYY-MM-DD）；endDate: 结束日期
export async function exportImage(
  title: string,
  signature: string | null = null,
  startDate?: string,
  endDate?: string,
): Promise<void> {
  const finalTitle = title.trim() || "我的旅行手账";
  const target = document.getElementById("map-capture-target");
  if (!target) {
    throw new Error("找不到地图容器");
  }
  const overlayEl = document.getElementById("map-overlay-layer");
  const map = getMapInstance();
  if (!map) {
    throw new Error("地图未初始化");
  }

  // 1. 确保字体加载
  await ensureFontsReady();

  // 2. 临时展开有备注的泡泡（用最新 store 状态）
  const store = useMapStore.getState();
  const latestPlaces = store.places;
  if (latestPlaces.length === 0) {
    throw new Error("请先添加至少一个地点");
  }
  store.openAllBubbles();
  await new Promise((r) => setTimeout(r, 50));

  // 3. 自动缩放居中：将所有地点和路线缩放到视野中
  const savedView = {
    center: map.getCenter().clone(),
    zoom: map.getZoom(),
  };

  let tileCanvas!: HTMLCanvasElement;
  let svgCanvas: HTMLCanvasElement | null = null;
  let overlayCanvas!: HTMLCanvasElement;
  let bubbleCanvas: HTMLCanvasElement | null = null;
  const savedOverlayOverflow = overlayEl?.style.overflow ?? "";

  try {
    // 自动缩放：纳入地点、路线与备注气泡位置
    try {
      if (overlayEl) {
        await fitMapViewForExport(
          map,
          latestPlaces,
          overlayEl as HTMLElement,
          target,
        );
      } else {
        const bounds = calculateExportBounds(latestPlaces);
        map.invalidateSize();
        map.fitBounds(bounds, {
          animate: false,
          padding: [120, 120],
          maxZoom: 16,
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => setTimeout(() => resolve(), 200)),
        );
        await waitForTilesLoaded(target, 8000);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (exportFitError) {
      console.error("[export] 自动缩放失败，使用当前视野:", exportFitError);
    }

    // 4. 等待 DOM 渲染稳定
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 导出捕获期间解除 overlay 裁切，避免气泡边缘被截断
    if (overlayEl) {
      overlayEl.style.overflow = "visible";
    }

    // 5. 捕获瓦片层（手动绘制，绕过 html2canvas 对 Leaflet transform 的 bug）
    tileCanvas = await captureTileLayer(target, CAPTURE_SCALE);

    // 6. 捕获 SVG 路线层（序列化为图片，绕过 html2canvas 对复杂 SVG 的性能瓶颈）
    const svgEl = overlayEl?.querySelector("svg") as SVGSVGElement | null;
    if (svgEl && overlayEl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      svgCanvas = await captureSvgLayer(
        svgEl,
        overlayRect.width,
        overlayRect.height,
        CAPTURE_SCALE,
      );
    }

    // 7. 手动绘制图钉/标签/距离标签到 overlay canvas
    //    绕过 html2canvas 对 CSS transform 的渲染 bug
    overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = tileCanvas.width;
    overlayCanvas.height = tileCanvas.height;
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) throw new Error("无法创建 overlay canvas 上下文");
    await drawOverlayElements(overlayCtx, map, latestPlaces, CAPTURE_SCALE);

    // 8. 捕获泡泡层（隐藏其他元素，仅用 html2canvas 捕获泡泡）
    if (overlayEl) {
      bubbleCanvas = await captureBubbles(
        overlayEl as HTMLElement,
        CAPTURE_SCALE,
      );
    }
  } finally {
    if (overlayEl) {
      overlayEl.style.overflow = savedOverlayOverflow;
    }
    // 恢复原始地图视野
    map.setView(savedView.center, savedView.zoom, { animate: false });
  }

  // 9. 合成地图层（瓦片 + SVG 路线 + 图钉/标签 + 泡泡）
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = tileCanvas.width;
  mapCanvas.height = tileCanvas.height;
  const mapCtx = mapCanvas.getContext("2d");
  if (!mapCtx) throw new Error("无法创建地图合成 canvas 上下文");
  mapCtx.drawImage(tileCanvas, 0, 0);
  if (svgCanvas) {
    mapCtx.drawImage(svgCanvas, 0, 0, tileCanvas.width, tileCanvas.height);
  }
  mapCtx.drawImage(overlayCanvas, 0, 0);
  if (bubbleCanvas) {
    mapCtx.drawImage(bubbleCanvas, 0, 0, tileCanvas.width, tileCanvas.height);
  }

  // 10. 合成最终图片（标题 + 地图 + 里程信息 + 日期）
  const titleH = Math.round(EXPORT_H * TITLE_RATIO);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = EXPORT_W;
  finalCanvas.height = EXPORT_H;
  const ctx = finalCanvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas 上下文");

  // 整体纸张背景
  drawPaperBackground(ctx, EXPORT_W, EXPORT_H);

  // 标题区（含签名）
  await drawTitleArea(ctx, finalTitle, signature, EXPORT_W, titleH);

  // 地图区：底边贴齐导出图底部，尽量减少标题下方空白
  const mapDrawRect = calculateMapDrawRect(
    mapCanvas.width,
    mapCanvas.height,
    EXPORT_W,
    EXPORT_H,
    titleH,
  );
  ctx.drawImage(
    mapCanvas,
    mapDrawRect.drawX,
    mapDrawRect.drawY,
    mapDrawRect.drawW,
    mapDrawRect.drawH,
  );

  // 右下角里程信息框
  const totalKm = latestPlaces.reduce(
    (sum, p) => sum + (p.distanceFromPrevious ?? 0),
    0,
  );
  drawTripInfo(ctx, EXPORT_W, EXPORT_H, totalKm, startDate, endDate);

  // 右下角日期时间
  drawDateTime(ctx, EXPORT_W, EXPORT_H);

  // 11. 下载
  await new Promise<void>((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("生成图片失败"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${finalTitle}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      },
      "image/png",
      0.95,
    );
  });
}
