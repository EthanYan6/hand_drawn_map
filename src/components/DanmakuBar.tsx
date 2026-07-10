// 真正的弹幕组件：覆盖在地图上的飞行弹幕
// 文字从屏幕右侧随机高度进入，向左横向飘过，飞出左侧后消失
// 使用不蒜子 page_uv 按页面路径统计，避免与其他项目数据混淆
// 数字加载前显示转圈 loading，加载后显示数字

import { useEffect, useRef, useState } from "react";

// 转圈加载小图标
function LoadingSpinner() {
  return (
    <span className="inline-flex items-center align-middle mx-0.5">
      <svg
        className="animate-spin-slow"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeOpacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

// 数字展示：加载中显示转圈，加载后显示数字
function StatNumber({ value }: { value: string | null }) {
  if (value === null) {
    return <LoadingSpinner />;
  }
  return (
    <span className="font-bold text-stamp-400 mx-1">{value}</span>
  );
}

interface DanmakuItem {
  id: number;
  top: number; // 顶部偏移百分比（随机）
  duration: number; // 飞行耗时（秒）
  delay: number; // 发射延迟（秒）
}

export default function DanmakuBar() {
  const [pageUv, setPageUv] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const gotAnyRef = useRef(false);
  // 弹幕队列
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const pageSpan = document.createElement("span");
    pageSpan.id = "busuanzi_page_uv";
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
    holder.appendChild(pageSpan);
    document.body.appendChild(holder);

    const readNumber = (el: HTMLElement): string | null => {
      const t = el.textContent?.trim();
      if (t && /^\d+$/.test(t)) return t;
      return null;
    };

    const sync = () => {
      const s = readNumber(pageSpan);
      if (s) {
        setPageUv(s);
        gotAnyRef.current = true;
      }
    };

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(pageSpan, { childList: true, characterData: true, subtree: true });

    const poll = setInterval(sync, 600);
    const timeout = setTimeout(() => {
      if (!gotAnyRef.current) setHidden(true);
    }, 12000);

    return () => {
      obs.disconnect();
      clearInterval(poll);
      clearTimeout(timeout);
      if (holder.parentNode) document.body.removeChild(holder);
    };
  }, []);

  // 弹幕：累计人数，隔一会儿飘一次
  // 每条飞完后等几秒再重新飘
  useEffect(() => {
    if (hidden) return;

    const launchOne = (top: number) => {
      const duration = 16; // 16 秒飞行
      idCounter.current += 1;
      const id = idCounter.current;
      setItems((prev) => [...prev, { id, top, duration, delay: 0 }]);
      // 飞完后从队列移除，并安排下次发射
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== id));
      }, duration * 1000 + 200);
    };

    // 累计弹幕：顶部第一行，飞完后间隔 4 秒重新飘
    const cycleTotal = () => {
      launchOne(6);
      timerTotal = setTimeout(cycleTotal, 16000 + 4000);
    };

    let timerTotal: ReturnType<typeof setTimeout>;
    cycleTotal();

    return () => {
      clearTimeout(timerTotal);
    };
  }, [hidden]);

  if (hidden) return null;

  const renderItem = (item: DanmakuItem) => {
    return (
      <div
        key={item.id}
        className="absolute whitespace-nowrap pointer-events-none font-hand-cn text-[16px] text-paper-50"
        style={{
          top: `${item.top}%`,
          left: 0,
          // 用 CSS animation 飞行，从右侧(100vw)到左侧(-100%)
          animation: `danmakuFly ${item.duration}s linear forwards`,
          animationDelay: `${item.delay}s`,
          // 描边让文字在地图上清晰可读
          textShadow:
            "1px 1px 0 rgba(42,26,14,0.9), -1px -1px 0 rgba(42,26,14,0.9), 1px -1px 0 rgba(42,26,14,0.9), -1px 1px 0 rgba(42,26,14,0.9), 0 2px 4px rgba(0,0,0,0.6)",
        }}
      >
        <span>
          共有
          <StatNumber value={pageUv} />
          人与你一起使用旅行手账
          <span className="mx-2 text-watercolor-400">✦</span>
        </span>
      </div>
    );
  };

  return (
    <>
      {/* 注入弹幕飞行 keyframes：从右侧视口外飞到左侧外 */}
      <style>{`
        @keyframes danmakuFly {
          from { transform: translateX(100vw); }
          to { transform: translateX(-100%); }
        }
      `}</style>
      {/* 弹幕层：覆盖整个视口，pointer-events-none 不阻挡地图操作 */}
      <div className="pointer-events-none fixed inset-0 z-[800] overflow-hidden">
        {items.map(renderItem)}
      </div>
    </>
  );
}
