/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 仿古纸张米色 - 主背景
        paper: {
          50: "#FBF3E0",
          100: "#F4E8D0",
          200: "#EAD9B0",
          300: "#DCC68A",
        },
        // 墨水深棕 - 主线条
        ink: {
          900: "#2A1A0E",
          800: "#3E2C1C",
          700: "#52402E",
          600: "#6B5742",
        },
        // 旅行印章红 - 强调色
        stamp: {
          400: "#E15D3F",
          500: "#C73E1D",
          600: "#A12E14",
        },
        // 水彩蓝绿 - 辅助色
        watercolor: {
          400: "#7BAA98",
          500: "#5B8E7D",
          600: "#436B5E",
        },
      },
      fontFamily: {
        // 中文手写标题
        "hand-cn": ['"Ma Shan Zheng"', "cursive"],
        // 英文手写
        "hand-en": ["Caveat", "cursive"],
        // 正文衬线
        serif: ['"Noto Serif SC"', "serif"],
      },
      animation: {
        "wobble": "wobble 0.4s ease-in-out",
        "stamp-down": "stampDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "marquee": "marquee 32s linear infinite",
        "marquee-reverse": "marqueeReverse 28s linear infinite",
        "spin-slow": "spin 1.1s linear infinite",
      },
      keyframes: {
        wobble: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
        stampDown: {
          "0%": { transform: "scale(0.6) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(1.1) rotate(3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeReverse: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
