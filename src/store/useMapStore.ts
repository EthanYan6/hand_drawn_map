// 全局状态：地点列表、加载状态、地图层级、错误信息、显示语言

import { create } from "zustand";
import type { LanguageCode, MapLevel, PlaceLocation, PlaceNote } from "@/types";
import { geocodePlaces, refetchDisplayNames } from "@/utils/geocode";
import { detectLanguage, detectMapLevel } from "@/utils/mapLevel";
import { defaultBubbleOffset } from "@/utils/bubbleLayout";
import { fetchRoute } from "@/utils/routing";

// 用于生成地点 id
let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `place-${Date.now()}-${idCounter}`;
}

interface MapState {
  places: PlaceLocation[];
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  mapLevel: MapLevel;
  // 触发地图 fitBounds 的版本号，每次添加/删除地点时递增
  fitVersion: number;
  // 导出弹窗
  exportOpen: boolean;
  // 添加地点弹窗
  addOpen: boolean;
  // 当前显示语言（控制地名 displayName 的语言）
  displayLanguage: LanguageCode;

  openAddModal: () => void;
  closeAddModal: () => void;

  openExportModal: () => void;
  closeExportModal: () => void;

  // 批量添加地点（触发地理编码）
  addPlaces: (names: string[]) => Promise<void>;
  // 删除地点
  removePlace: (id: string) => void;
  // 清空所有地点
  clearPlaces: () => void;
  // 调整地点顺序
  movePlace: (id: string, direction: "up" | "down") => void;
  // 更新地点备注
  setNote: (id: string, note: PlaceNote | null) => void;
  // 切换泡泡展开状态
  toggleBubble: (id: string) => void;
  // 设置泡泡偏移（拖拽）
  setBubbleOffset: (id: string, offset: { x: number; y: number }) => void;
  // 设置路段距离（公里）
  setDistance: (id: string, distance: number | null) => void;
  // 同时展开所有泡泡（用于导出）
  openAllBubbles: () => void;
  // 清除错误
  clearError: () => void;
  // 切换显示语言（重新查询所有地点的 displayName）
  setDisplayLanguage: (language: LanguageCode) => Promise<void>;
}

export const useMapStore = create<MapState>((set, get) => ({
  places: [],
  loading: false,
  loadingMessage: "",
  error: null,
  mapLevel: "world",
  fitVersion: 0,
  exportOpen: false,
  addOpen: false,
  displayLanguage: "zh-CN",

  openAddModal: () => set({ addOpen: true }),
  closeAddModal: () => set({ addOpen: false }),

  openExportModal: () => set({ exportOpen: true }),
  closeExportModal: () => set({ exportOpen: false }),

  addPlaces: async (names) => {
    const valid = names.map((n) => n.trim()).filter(Boolean);
    if (valid.length === 0) return;

    set({ loading: true, loadingMessage: "正在查找地点…", error: null });
    try {
      const currentLang = get().displayLanguage;
      const results = await geocodePlaces(valid, currentLang);
      const failed: string[] = [];
      const newPlaces: PlaceLocation[] = [];
      const existingCount = get().places.length;
      results.forEach((r, i) => {
        if (Number.isNaN(r.lat) || Number.isNaN(r.lon)) {
          failed.push(valid[i]);
          return;
        }
        const idx = existingCount + i;
        newPlaces.push({
          id: genId(),
          name: valid[i],
          displayName: r.displayName,
          lat: r.lat,
          lon: r.lon,
          address: r.address,
          note: null,
          // 根据序号智能选择上下位置，避免遮挡连线
          bubbleOffset: defaultBubbleOffset(idx),
          bubbleOpen: false,
          routeFromPrevious: null,
          distanceFromPrevious: null,
        });
      });

      // 路由获取改为后台异步：先把地点加入 state，再逐个获取路由
      // 避免等待 OSRM 请求时阻塞 UI（尤其是跨国场景请求慢/超时）
      if (newPlaces.length === 0) {
        set({
          loading: false,
          error: `未找到任何地点，请检查输入：${valid.join("、")}`,
        });
        return;
      }

      const allPlaces = [...get().places, ...newPlaces];
      const level = detectMapLevel(allPlaces);
      // 首次添加地点时，根据主导国家自动检测语言
      const prevLang = get().displayLanguage;
      const detectedLang = detectLanguage(allPlaces);
      const langChanged = prevLang === "zh-CN" && detectedLang !== "zh-CN";
      set({
        places: allPlaces,
        mapLevel: level,
        loading: false,
        loadingMessage: "",
        fitVersion: get().fitVersion + 1,
        displayLanguage: langChanged ? detectedLang : prevLang,
        error: failed.length > 0 ? `部分地点未找到：${failed.join("、")}` : null,
      });
      // 如果语言发生变化，重新查询已添加地点的 displayName
      if (langChanged) {
        get().setDisplayLanguage(detectedLang);
      }

      // 后台异步获取道路路径（不阻塞 UI）
      // 远距离（>500km）自动跳过，逐个完成后更新 state
      const routeBaseIndex = existingCount;
      void (async () => {
        for (let i = 0; i < newPlaces.length; i++) {
          const globalIdx = routeBaseIndex + i;
          if (globalIdx === 0) continue;
          const currentPlaces = get().places;
          const from = currentPlaces[globalIdx - 1];
          const to = currentPlaces[globalIdx];
          if (!from || !to) continue;
          if (Number.isNaN(from.lat) || Number.isNaN(from.lon)) continue;
          if (Number.isNaN(to.lat) || Number.isNaN(to.lon)) continue;
          const route = await fetchRoute(
            { lat: from.lat, lon: from.lon },
            { lat: to.lat, lon: to.lon },
          );
          if (route) {
            // 逐个更新对应地点的 routeFromPrevious
            set({
              places: get().places.map((p) =>
                p.id === to.id ? { ...p, routeFromPrevious: route } : p),
            });
          }
        }
      })();
    } catch (e) {
      set({
        loading: false,
        loadingMessage: "",
        error: e instanceof Error ? e.message : "发生未知错误",
      });
    }
  },

  removePlace: (id) => {
    const places = get().places.filter((p) => p.id !== id);
    set({
      places,
      mapLevel: detectMapLevel(places),
      fitVersion: places.length > 0 ? get().fitVersion + 1 : get().fitVersion,
    });
  },

  clearPlaces: () =>
    set({
      places: [],
      mapLevel: "world",
      fitVersion: get().fitVersion + 1,
      error: null,
      displayLanguage: "zh-CN",
    }),

  movePlace: (id, direction) => {
    const places = [...get().places];
    const idx = places.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= places.length) return;
    [places[idx], places[target]] = [places[target], places[idx]];
    // 重新计算所有地点的默认偏移（顺序变了）
    const reoffset = places.map((p, i) => ({
      ...p,
      bubbleOffset: defaultBubbleOffset(i),
    }));
    set({ places: reoffset, fitVersion: get().fitVersion + 1 });
  },

  setNote: (id, note) => {
    set({
      places: get().places.map((p) => (p.id === id ? { ...p, note } : p)),
    });
  },

  toggleBubble: (id) => {
    set({
      places: get().places.map((p) =>
        p.id === id ? { ...p, bubbleOpen: !p.bubbleOpen } : p,
      ),
    });
  },

  setBubbleOffset: (id, offset) => {
    set({
      places: get().places.map((p) =>
        p.id === id ? { ...p, bubbleOffset: offset } : p),
    });
  },

  setDistance: (id, distance) => {
    set({
      places: get().places.map((p) =>
        p.id === id ? { ...p, distanceFromPrevious: distance } : p),
    });
  },

  // 导出时仅展开有备注的地点气泡，无备注的不显示
  openAllBubbles: () => {
    set({
      places: get().places.map((p) => ({
        ...p,
        bubbleOpen: Boolean(p.note),
      })),
    });
  },

  clearError: () => set({ error: null }),

  setDisplayLanguage: async (language) => {
    const places = get().places;
    if (places.length === 0) {
      set({ displayLanguage: language });
      return;
    }
    set({
      loading: true,
      loadingMessage: "正在切换语言…",
      displayLanguage: language,
    });
    try {
      const nameMap = await refetchDisplayNames(places, language);
      set({
        places: get().places.map((p) => ({
          ...p,
          displayName: nameMap.get(p.id) ?? p.displayName,
        })),
        loading: false,
        loadingMessage: "",
      });
    } catch (e) {
      set({
        loading: false,
        loadingMessage: "",
        error: e instanceof Error ? e.message : "语言切换失败",
      });
    }
  },
}));
