// 真正的弹幕组件：覆盖在地图上的飞行弹幕
// 文字从屏幕右侧随机高度进入，向左横向飘过，飞出左侧后消失
// 两条文案交替发射：累计人数 / 今日人数
// 数字加载前显示转圈 loading，加载后显示数字
// 不蒜子 UV 按 IP 去重，每个 IP 每天只算一次

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
  text: "total" | "today";
  top: number; // 顶部偏移百分比（随机）
  duration: number; // 飞行耗时（秒）
  delay: number; // 发射延迟（秒）
}

export default function DanmakuBar() {
  const [siteUv, setSiteUv] = useState<string | null>(null);
  const [todayUv, setTodayUv] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const gotAnyRef = useRef(false);
  // 弹幕队列
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const siteSpan = document.createElement("span");
    siteSpan.id = "busuanzi_site_uv";
    const todaySpan = document.createElement("span");
    todaySpan.id = "busuanzi_today_uv";
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
    holder.appendChild(siteSpan);
    holder.appendChild(todaySpan);
    document.body.appendChild(holder);

    const readNumber = (el: HTMLElement): string | null => {
      const t = el.textContent?.trim();
      if (t && /^\d+$/.test(t)) return t;
      return null;
    };

    const sync = () => {
      const s = readNumber(siteSpan);
      const t = readNumber(todaySpan);
      if (s) {
        setSiteUv(s);
        gotAnyRef.current = true;
      }
      if (t) {
        setTodayUv(t);
        gotAnyRef.current = true;
      }
    };

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(siteSpan, { childList: true, characterData: true, subtree: true });
    obs.observe(todaySpan, { childList: true, characterData: true, subtree: true });

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

  // 顶部两条弹幕：累计 + 今日，隔一会儿飘一次
  // 每条飞完后等几秒再重新飘，保证屏幕上最多只有这两条
  useEffect(() => {
    if (hidden) return;

    const launchOne = (text: "total" | "today", top: number) => {
      const duration = 16; // 16 秒飞行
      idCounter.current += 1;
      const id = idCounter.current;
      setItems((prev) => [...prev, { id, text, top, duration, delay: 0 }]);
      // 飞完后从队列移除，并安排下次发射
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== id));
      }, duration * 1000 + 200);
    };

    // 累计弹幕：顶部第一行，飞完后间隔 4 秒重新飘
    const cycleTotal = () => {
      launchOne("total", 6);
      timerTotal = setTimeout(cycleTotal, 16000 + 4000);
    };
    // 今日弹幕：顶部第二行，错开 8 秒启动，避免两条同时出发
    const cycleToday = () => {
      launchOne("today", 40);
      timerToday = setTimeout(cycleToday, 16000 + 4000);
    };

    let timerTotal: ReturnType<typeof setTimeout>;
    let timerToday: ReturnType<typeof setTimeout>;
    cycleTotal();
    const startToday = setTimeout(cycleToday, 8000);

    return () => {
      clearTimeout(timerTotal);
      clearTimeout(timerToday);
      clearTimeout(startToday);
    };
  }, [hidden]);

  if (hidden) return null;

  const renderItem = (item: DanmakuItem) => {
    const isTotal = item.text === "total";
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
        {isTotal ? (
          <span>
            共有
            <StatNumber value={siteUv} />
            人与你一起使用旅行手账
            <span className="mx-2 text-watercolor-400">✦</span>
          </span>
        ) : (
          <span className="text-paper-100">
            今日共有
            <StatNumber value={todayUv} />
            人使用
            <span className="mx-2 text-stamp-400">✧</span>
          </span>
        )}
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
