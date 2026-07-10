// 地点相关类型定义

export interface PlaceAddress {
  city?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

export type NoteType = "text" | "image";

export interface PlaceNote {
  type: NoteType;
  content: string; // 文字内容或图片 base64
}

export interface PlaceLocation {
  id: string;
  name: string; // 用户输入的原始名称
  displayName: string; // Nominatim 返回的完整名称
  lat: number;
  lon: number;
  address: PlaceAddress;
  note: PlaceNote | null;
  // 泡泡在容器内的像素偏移（相对地点标记），可拖拽调整
  bubbleOffset: { x: number; y: number };
  // 泡泡是否展开
  bubbleOpen: boolean;
  // 从上一个地点到此地点的道路路径点（OSRM），null 表示用直线
  routeFromPrevious: { lat: number; lon: number }[] | null;
  // 从上一个地点到此地点的距离（公里），null 表示未设置
  distanceFromPrevious: number | null;
}

// 地图层级枚举
export type MapLevel = "city" | "province" | "country" | "world";

export const MAP_LEVEL_LABEL: Record<MapLevel, string> = {
  city: "同城",
  province: "跨市同省",
  country: "跨省同国",
  world: "跨国",
};

// 显示语言代码（Nominatim accept-language 参数）
export type LanguageCode =
  | "zh-CN"
  | "zh-TW"
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "it"
  | "ru"
  | "pt"
  | "th"
  | "vi"
  | "ar";

// 可选语言列表（导出弹窗下拉用）
export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string }[] = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "pt", label: "Português" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ar", label: "العربية" },
];

// 国家代码（ISO-2）→ 默认显示语言
export const COUNTRY_LANGUAGE: Record<string, LanguageCode> = {
  CN: "zh-CN",
  TW: "zh-TW",
  HK: "zh-TW",
  MO: "zh-TW",
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  NZ: "en",
  IE: "en",
  SG: "en",
  JP: "ja",
  KR: "ko",
  KP: "ko",
  FR: "fr",
  BE: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PE: "es",
  IT: "it",
  VA: "it",
  RU: "ru",
  BY: "ru",
  PT: "pt",
  BR: "pt",
  TH: "th",
  VN: "vi",
  AE: "ar",
  SA: "ar",
  EG: "ar",
};
