// 导出图片：手动捕获瓦片层（绕过 html2canvas 对 Leaflet transform 的渲染 bug）
// + html2canvas 捕获 overlay 层（SVG 路线 + 标记 + 标签 + 泡泡，透明背景叠加）
// + 合成标题区（含签名）+ 日期时间，输出 PNG

import html2canvas from "html2canvas";
import { useMapStore } from "@/store/useMapStore";

const EXPORT_W = 1920;
const EXPORT_H = 1280;
const TITLE_RATIO = 0.16; // 标题区占 16%（稍高，容纳签名）
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

// 将签名图片（dataURL）加载为 Image
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
  const text = `生成于 ${formatDateTime(new Date())}`;
  ctx.fillStyle = "rgba(82, 64, 46, 0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `16px "Caveat", "Noto Serif SC", serif`;
  ctx.fillText(text, w - 16, h - 12);
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
  // getBoundingClientRect 已包含 Leaflet 的 translate3d，位置最准确
  const containerRect = container.getBoundingClientRect();
  ctx.scale(scale, scale);
  for (const img of tiles) {
    if (!img.complete || img.naturalWidth === 0) continue;
    const tileRect = img.getBoundingClientRect();
    const x = tileRect.left - containerRect.left;
    const y = tileRect.top - containerRect.top;
    // 跳过完全在容器外的瓦片
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

// 捕获 overlay 层（SVG 路线 + 图钉 + 地名标签 + 泡泡）
// 用 html2canvas 渲染，透明背景以便叠加到瓦片层上
async function captureOverlay(
  overlay: HTMLElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  return html2canvas(overlay, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null, // 透明背景
    scale,
    logging: false,
    imageTimeout: 0,
  });
}

// 主导出函数
// title: 标题；signature: 签名（字符串=名字 / dataURL=手写图片 / null=无签名）
export async function exportImage(
  title: string,
  signature: string | null = null,
): Promise<void> {
  const finalTitle = title.trim() || "我的旅行手账";
  const target = document.getElementById("map-capture-target");
  if (!target) {
    throw new Error("找不到地图容器");
  }
  const overlayEl = document.getElementById("map-overlay-layer");

  // 1. 确保字体加载
  await ensureFontsReady();

  // 2. 临时展开有备注的泡泡（用最新 store 状态，避免已删除备注仍显示）
  const store = useMapStore.getState();
  const latestPlaces = store.places;
  if (latestPlaces.length === 0) {
    throw new Error("请先添加至少一个地点");
  }
  store.openAllBubbles();
  await new Promise((r) => setTimeout(r, 50));

  // 3. 等待 DOM 渲染与瓦片稳定
  await new Promise((r) => setTimeout(r, 900));

  // 4. 分别捕获瓦片层与 overlay 层
  //    瓦片层手动绘制，避免 html2canvas 对 Leaflet transform 的 bug
  //    overlay 层用 html2canvas，透明背景叠加
  const tileCanvas = await captureTileLayer(target, CAPTURE_SCALE);
  let overlayCanvas: HTMLCanvasElement | null = null;
  if (overlayEl) {
    overlayCanvas = await captureOverlay(
      overlayEl as HTMLElement,
      CAPTURE_SCALE,
    );
  }

  // 5. 合成地图层（瓦片 + overlay）
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = tileCanvas.width;
  mapCanvas.height = tileCanvas.height;
  const mapCtx = mapCanvas.getContext("2d");
  if (!mapCtx) throw new Error("无法创建地图合成 canvas 上下文");
  mapCtx.drawImage(tileCanvas, 0, 0);
  if (overlayCanvas) {
    mapCtx.drawImage(overlayCanvas, 0, 0);
  }

  // 6. 合成最终图片（标题 + 地图 + 日期）
  const titleH = Math.round(EXPORT_H * TITLE_RATIO);
  const mapH = EXPORT_H - titleH;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = EXPORT_W;
  finalCanvas.height = EXPORT_H;
  const ctx = finalCanvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas 上下文");

  // 整体纸张背景
  drawPaperBackground(ctx, EXPORT_W, EXPORT_H);

  // 标题区（含签名）
  await drawTitleArea(ctx, finalTitle, signature, EXPORT_W, titleH);

  // 地图区（contain 模式，居中）
  const mapRatio = mapCanvas.width / mapCanvas.height;
  const targetRatio = EXPORT_W / mapH;
  let drawW: number;
  let drawH: number;
  if (mapRatio > targetRatio) {
    drawH = mapH;
    drawW = mapH * mapRatio;
  } else {
    drawW = EXPORT_W;
    drawH = EXPORT_W / mapRatio;
  }
  const drawX = (EXPORT_W - drawW) / 2;
  const drawY = titleH + (mapH - drawH) / 2;
  ctx.drawImage(mapCanvas, drawX, drawY, drawW, drawH);

  // 右下角日期时间
  drawDateTime(ctx, EXPORT_W, EXPORT_H);

  // 7. 下载
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
