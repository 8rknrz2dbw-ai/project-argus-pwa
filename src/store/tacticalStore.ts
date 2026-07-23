import { create } from 'zustand'
import type { BBox, DetectionCollection, TacticalMode } from '../types'
import type { DriftPoint } from '../lib/drift'
import type { MarineEnv } from '../lib/marineEnv'
import type { HourlySeries } from '../lib/marineSeries'
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
  /** 免金鑰光學影像來源：nasa=每日MODIS(有雲層/較糊)、esri=高解析鑲嵌(清晰)。 */
  opticalSource: 'nasa' | 'esri'

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
  rescueStatus: 'idle' | 'loading' | 'done'
  /** 時間軸拉桿的小時數（0 = 不顯示 scrubber）。 */
  scrubHours: number
  /** 漂流物體類型的風壓係數 (leeway)。 */
  driftLeeway: number
  /** 目前選的漂流物體類型 id。 */
  driftTargetId: string
  /** 漂流推演方向：forward=落海點往未來漂；backward=發現點回推來源。 */
  driftMode: 'forward' | 'backward'
  /** 回報/落海時間（epoch ms）。可為過去，用逐時歷史海象積分。 */
  incidentTime: number
  /** 該點的逐時風/洋流序列（時變漂流用）。 */
  rescueSeries: HourlySeries | null
  /** 是否顯示蒙地卡羅機率密度圖 (SAROPS 式)。 */
  showProbability: boolean
  /** 蒙地卡羅結果摘要（峰值/質心/95% 半徑 m），供搜索航線與報告使用。 */
  mcSummary: {
    peak: { lat: number; lng: number } | null
    centroid: { lat: number; lng: number } | null
    radius95: number
  } | null
  /** 是否顯示平行梳掃搜索航線。 */
  showSearchPattern: boolean
  /** 航線間距（海浬）＝有效搜索寬度。 */
  trackSpacingNm: number

  // ── AIS 船舶識別 (ais) ──────────────────────────────
  vessels: Vessel[]

  // ── 海況熱力圖 (seastate) ────────────────────────────
  /** 熱力圖顯示哪個欄位：海溫或浪高。 */
  seaStateField: 'sst' | 'wave'

  // ── 環境時間動畫 (envanim) ───────────────────────────
  /** 動畫目前顯示的小時 epoch（0=未載入）。 */
  animEpoch: number
  /** 動畫是否播放中。 */
  animPlaying: boolean
  /** 動畫可用的時間點(epoch) 陣列。 */
  animTimes: number[]

  // ── 我的位置 (GPS，跨模式保留) ──────────────────────
  ownPosition: { lat: number; lng: number; accuracy: number } | null

  // ── 狀態列訊息（給海上人員的即時回饋）───────────────
  statusMessage: string

  // ── actions ─────────────────────────────────────────
  setMode: (mode: TacticalMode) => void
  setMaxCloudCover: (v: number) => void
  setObservationDate: (d: string) => void
  setOpticalSource: (s: 'nasa' | 'esri') => void
  setDetections: (d: DetectionCollection | null) => void
  setAiStatus: (s: TacticalState['aiStatus'], error?: string | null) => void
  setSelecting: (v: boolean) => void
  setSelectedBBox: (b: BBox | null) => void
  setStatus: (msg: string) => void
  setManOverboard: (p: { lat: number; lng: number } | null) => void
  setRescueResult: (env: MarineEnv | null, points: DriftPoint[]) => void
  setRescueStatus: (s: TacticalState['rescueStatus']) => void
  setVessels: (v: Vessel[]) => void
  setOwnPosition: (p: TacticalState['ownPosition']) => void
  setSeaStateField: (f: 'sst' | 'wave') => void
  setAnimEpoch: (e: number) => void
  setAnimPlaying: (v: boolean) => void
  setAnimTimes: (t: number[]) => void
  setScrubHours: (h: number) => void
  setDriftTarget: (id: string, leeway: number) => void
  setDriftPoints: (points: DriftPoint[]) => void
  setDriftMode: (m: 'forward' | 'backward') => void
  setIncidentTime: (t: number) => void
  setRescueSeries: (s: HourlySeries | null) => void
  setShowProbability: (v: boolean) => void
  setMcSummary: (s: TacticalState['mcSummary']) => void
  setShowSearchPattern: (v: boolean) => void
  setTrackSpacingNm: (nm: number) => void
}

// 預設用「昨天」：衛星影像（GIBS/Sentinel）當天常還沒處理好，昨天最保險。
const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

export const useTacticalStore = create<TacticalState>((set) => ({
  mode: 'orbit',
  maxCloudCover: 20,
  observationDate: today,
  opticalSource: 'esri',
  detections: null,
  aiStatus: 'idle',
  aiError: null,
  selecting: false,
  selectedBBox: null,
  manOverboard: null,
  rescueEnv: null,
  driftPoints: [],
  rescueStatus: 'idle',
  scrubHours: 0,
  driftLeeway: 0.014,
  driftTargetId: 'piw',
  driftMode: 'forward',
  incidentTime: Date.now(),
  rescueSeries: null,
  showProbability: false,
  mcSummary: null,
  showSearchPattern: false,
  trackSpacingNm: 1,
  vessels: [],
  seaStateField: 'sst',
  animEpoch: 0,
  animPlaying: false,
  animTimes: [],
  ownPosition: null,
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
      scrubHours: 0,
      driftLeeway: 0.014,
      driftTargetId: 'piw',
      driftMode: 'forward',
      incidentTime: Date.now(),
      rescueSeries: null,
      showProbability: false,
      mcSummary: null,
      showSearchPattern: false,
      trackSpacingNm: 1,
      vessels: [],
      animPlaying: false,
  animTimes: [],
      statusMessage: MODE_HINT[mode],
    })),

  setMaxCloudCover: (v) => set({ maxCloudCover: v }),
  setObservationDate: (d) => set({ observationDate: d }),
  setOpticalSource: (s) => set({ opticalSource: s }),
  setDetections: (d) => set({ detections: d }),
  setAiStatus: (s, error = null) => set({ aiStatus: s, aiError: error }),
  setSelecting: (v) => set({ selecting: v }),
  setSelectedBBox: (b) => set({ selectedBBox: b }),
  setStatus: (msg) => set({ statusMessage: msg }),
  setManOverboard: (p) => set({ manOverboard: p }),
  setRescueResult: (env, points) => set({ rescueEnv: env, driftPoints: points }),
  setRescueStatus: (s) => set({ rescueStatus: s }),
  setVessels: (v) => set({ vessels: v }),
  setOwnPosition: (p) => set({ ownPosition: p }),
  setSeaStateField: (f) => set({ seaStateField: f }),
  setAnimEpoch: (e) => set({ animEpoch: e }),
  setAnimPlaying: (v) => set({ animPlaying: v }),
  setAnimTimes: (t) => set({ animTimes: t }),
  setScrubHours: (h) => set({ scrubHours: h }),
  setDriftTarget: (id, leeway) => set({ driftTargetId: id, driftLeeway: leeway }),
  setDriftPoints: (points) => set({ driftPoints: points }),
  setDriftMode: (m) => set({ driftMode: m }),
  setIncidentTime: (t) => set({ incidentTime: t }),
  setRescueSeries: (s) => set({ rescueSeries: s }),
  setShowProbability: (v) => set({ showProbability: v }),
  setMcSummary: (s) => set({ mcSummary: s }),
  setShowSearchPattern: (v) => set({ showSearchPattern: v }),
  setTrackSpacingNm: (nm) => set({ trackSpacingNm: nm }),
}))

const MODE_HINT: Record<TacticalMode, string> = {
  orbit: '軌道預警模式：即時軌跡渲染中',
  sar: '雷達盲搜模式：框選海域以啟動 AI 辨識',
  optical: '岸際光學模式：Sentinel-2 光學影像',
  ais: 'AIS 船舶識別模式：即時船位載入中',
  rescue: '搜救推演模式：點地圖標記落海點，計算漂流',
  seastate: '海況熱力圖模式：載入海溫/浪高分佈',
  envanim: '環境時間動畫：播放風場/洋流隨時間變化',
  typhoon: '颱風路徑：顯示颱風位置/暴風圈/預報路徑',
}
