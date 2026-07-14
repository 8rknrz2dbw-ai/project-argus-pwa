import { create } from 'zustand'
import type { BBox, DetectionCollection, TacticalMode } from '../types'
import type { DriftPoint } from '../lib/drift'
import type { MarineEnv } from '../lib/marineEnv'
import type { Vessel } from '../lib/ais'

/**
 * 全域戰術狀態 —— 整個 App 唯一的「真相來源 (single source of truth)」。
 *
 * 設計重點：UI 元件只負責「改狀態」，地圖圖層由 LayerControl 監聽狀態後
 * 自動 add/remove。這樣就不會有兩個地方同時操作 Leaflet 而邏輯打架。
 */
interface TacticalState {
  // ── 核心：當前戰術模式（互斥）─────────────────────────
  mode: TacticalMode

  // ── 光學模式的參數 ───────────────────────────────────
  /** 最大雲量 %（注入 WMS 的 MAXCC 參數）。 */
  maxCloudCover: number
  /** 歷史觀測日期（YYYY-MM-DD）。 */
  observationDate: string

  // ── AI 分析結果 ─────────────────────────────────────
  detections: DetectionCollection | null
  aiStatus: 'idle' | 'loading' | 'done' | 'error'
  aiError: string | null

  // ── 使用者框選的分析區域 ─────────────────────────────
  selecting: boolean
  selectedBBox: BBox | null

  // ── 搜救推演模式 (rescue) ────────────────────────────
  /** 落海點（最後已知位置）。 */
  manOverboard: { lat: number; lng: number } | null
  /** 該點的即時海象。 */
  rescueEnv: MarineEnv | null
  /** 漂流預測結果。 */
  driftPoints: DriftPoint[]
  /** 落海到現在經過的時間（分鐘），影響搜索時間點。 */
  rescueStatus: 'idle' | 'loading' | 'done'

  // ── AIS 船舶識別 (ais) ──────────────────────────────
  vessels: Vessel[]

  // ── 狀態列訊息（給海上人員的即時回饋）───────────────
  statusMessage: string

  // ── actions ─────────────────────────────────────────
  setMode: (mode: TacticalMode) => void
  setMaxCloudCover: (v: number) => void
  setObservationDate: (d: string) => void
  setDetections: (d: DetectionCollection | null) => void
  setAiStatus: (s: TacticalState['aiStatus'], error?: string | null) => void
  setSelecting: (v: boolean) => void
  setSelectedBBox: (b: BBox | null) => void
  setStatus: (msg: string) => void
  setManOverboard: (p: { lat: number; lng: number } | null) => void
  setRescueResult: (env: MarineEnv | null, points: DriftPoint[]) => void
  setRescueStatus: (s: TacticalState['rescueStatus']) => void
  setVessels: (v: Vessel[]) => void
}

const today = new Date().toISOString().slice(0, 10)

export const useTacticalStore = create<TacticalState>((set) => ({
  mode: 'orbit',
  maxCloudCover: 20,
  observationDate: today,
  detections: null,
  aiStatus: 'idle',
  aiError: null,
  selecting: false,
  selectedBBox: null,
  manOverboard: null,
  rescueEnv: null,
  driftPoints: [],
  rescueStatus: 'idle',
  vessels: [],
  statusMessage: '軌道預警模式待命中',

  setMode: (mode) =>
    set(() => ({
      mode,
      // 切模式時清掉上一個模式殘留的結果與框選，避免圖層疊加打架。
      detections: null,
      selecting: false,
      selectedBBox: null,
      aiStatus: 'idle',
      aiError: null,
      // 離開搜救/AIS 時清掉其狀態
      manOverboard: null,
      rescueEnv: null,
      driftPoints: [],
      rescueStatus: 'idle',
      vessels: [],
      statusMessage: MODE_HINT[mode],
    })),

  setMaxCloudCover: (v) => set({ maxCloudCover: v }),
  setObservationDate: (d) => set({ observationDate: d }),
  setDetections: (d) => set({ detections: d }),
  setAiStatus: (s, error = null) => set({ aiStatus: s, aiError: error }),
  setSelecting: (v) => set({ selecting: v }),
  setSelectedBBox: (b) => set({ selectedBBox: b }),
  setStatus: (msg) => set({ statusMessage: msg }),
  setManOverboard: (p) => set({ manOverboard: p }),
  setRescueResult: (env, points) => set({ rescueEnv: env, driftPoints: points }),
  setRescueStatus: (s) => set({ rescueStatus: s }),
  setVessels: (v) => set({ vessels: v }),
}))

const MODE_HINT: Record<TacticalMode, string> = {
  orbit: '軌道預警模式：即時軌跡渲染中',
  sar: '雷達盲搜模式：框選海域以啟動 AI 辨識',
  optical: '岸際光學模式：Sentinel-2 光學影像',
  ais: 'AIS 船舶識別模式：即時船位載入中',
  rescue: '搜救推演模式：點地圖標記落海點，計算漂流',
}
