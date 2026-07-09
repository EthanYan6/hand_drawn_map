// 手绘风格图钉 SVG，带编号
// 被地点标记使用

interface HandPinProps {
  index: number; // 1-based 编号
  color?: string; // 图钉主色
  size?: number;
  active?: boolean; // 是否激活（泡泡展开）
}

export default function HandPin({
  index,
  color = "#C73E1D",
  size = 40,
  active = false,
}: HandPinProps) {
  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 40 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: active
          ? "drop-shadow(2px 4px 3px rgba(62,44,28,0.4))"
          : "drop-shadow(1px 2px 2px rgba(62,44,28,0.25))",
        transition: "filter 0.2s ease, transform 0.2s ease",
        transform: active ? "scale(1.1)" : "scale(1)",
      }}
    >
      {/* 图钉针尖（底部三角） */}
      <path
        d="M20 50 L16 38 L24 38 Z"
        fill={color}
        stroke="#3E2C1C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 图钉头部（手绘不规则圆） */}
      <path
        d="M20 4 C 28 4, 36 11, 36 20 C 36 30, 28 38, 20 38 C 12 38, 4 30, 4 20 C 4 11, 12 4, 20 4 Z"
        fill={color}
        stroke="#3E2C1C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 内圈高光 */}
      <ellipse cx="15" cy="14" rx="4" ry="3" fill="rgba(255,255,255,0.4)" />
      {/* 编号圆 */}
      <circle cx="20" cy="21" r="9" fill="#FBF3E0" stroke="#3E2C1C" strokeWidth="1.5" />
      <text
        x="20"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Caveat, cursive"
        fontSize="14"
        fontWeight="700"
        fill="#3E2C1C"
      >
        {index}
      </text>
    </svg>
  );
}
