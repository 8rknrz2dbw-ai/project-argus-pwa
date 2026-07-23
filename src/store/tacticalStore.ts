import { create } from 'zustand'
import type { BBox, DetectionCollection, TacticalMode } from '../types'
import type { DriftPoint } from '../lib/drift'
import type { MarineEnv } from '../lib/marineEnv'
import type { HourlySeries } from '../lib/marineSeries'
import type { Vessel } from '../lib/ais'
import type { Detection } from '../lib/detection'
import type { Typhoon } from '../lib/typhoon'
import type { BaseLayerId } from '../lib/baseLayers'
import type { TideEvent, SeaAreaForecast } from '../lib/cwaMarine'
import {
  loadSaved,
  persistSaved,
  loadHistory,
  persistHistory,
  pushHistory,
  newId,
  type SavedCoord,
  type HistItem,
} from '../lib/savedCoords'

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
  /** 免金鑰光學影像來源：esri=高解析空拍(岸際最銳利)、eox=Sentinel-2無雲(10m平滑)、nasa=每日MODIS(有雲/較糊)。 */
  opticalSource: 'nasa' | 'esri' | 'eox' | 'ocean'
  /** 亮點掃描：每次按鈕 +1 觸發一次掃描。 */
  scanTick: number
  /** 掃描靈敏度（門檻 kStd，越小越敏感）。 */
  scanSensitivity: number
  /** 掃描到的疑似目標（含框、分類、AIS 比對）。 */
  brightSpots: Detection[]

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
  /** 漂流預測結果（順推：往未來漂）。 */
  driftPoints: DriftPoint[]
  /** 回推來源結果（逆推：從datum往前推來源）。 */
  sourcePoints: DriftPoint[]
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
  /** 疊「VIIRS 夜間漁火」衛星圖層（免金鑰，看外海漁船燈光）。 */
  showBoatLights: boolean
  /** 疊「Sentinel-1 雷達暗船」圖層（需金鑰，看不廣播 AIS 的金屬船）。 */
  showRadarVessels: boolean

  // ── 海況熱力圖 (seastate) ────────────────────────────
  /** 熱力圖顯示哪個欄位：海溫或浪高。 */
  seaStateField: 'sst' | 'wave'
  /** 目前畫面資料的實際範圍（動態上色/圖例用）。 */
  seaStateRange: { min: number; max: number } | null

  // ── CWA 在地官方海象（潮汐 / 海面預報）────────────────
  /** 落海點附近的 CWA 潮汐事件（null=未取得/未設定）。 */
  cwaTide: TideEvent[] | null
  /** CWA 台灣各海域海面天氣/波浪預報。 */
  cwaSeaAreas: SeaAreaForecast[] | null

  // ── 颱風 (typhoon) ───────────────────────────────────
  /** 目前顯示的颱風（CWA/GDACS/示範），供控制面板算警報。 */
  activeTyphoon: Typhoon | null

  // ── 環境時間動畫 (envanim) ───────────────────────────
  /** 動畫目前顯示的小時 epoch（0=未載入）。 */
  animEpoch: number
  /** 動畫是否播放中。 */
  animPlaying: boolean
  /** 動畫可用的時間點(epoch) 陣列。 */
  animTimes: number[]

  // ── 底圖選擇（戰術暗色 / 中文電子地圖 / 中文衛星混合）──
  baseLayer: BaseLayerId

  // ── 右側工具列是否展開（收合浮動按鈕，手機版面清爽）──
  toolsExpanded: boolean

  // ── 領海基線/鄰接區參考線（跨模式覆蓋層）────────────
  showTerritorial: boolean

  // ── 地圖飛行目標（座標查詢用，設定後地圖飛過去再清空）────
  flyToTarget: { lat: number; lng: number; zoom?: number } | null

  // ── 量測工具（距離/方位，跨模式）──────────────────────
  measuring: boolean
  measurePoints: { lat: number; lng: number }[]

  // ── 座標管理：已存(最愛/釘選) + 歷史（localStorage 持久化）──
  savedCoords: SavedCoord[]
  coordHistory: HistItem[]

  // ── 我的位置 (GPS，跨模式保留) ──────────────────────
  ownPosition: { lat: number; lng: number; accuracy: number } | null
  /** 航跡記錄中（連續 GPS）。 */
  trackRecording: boolean
  /** 自船航跡點（搜索覆蓋麵包屑）。 */
  ownTrack: { lat: number; lng: number }[]

  // ── 狀態列訊息（給海上人員的即時回饋）───────────────
  statusMessage: string

  // ── actions ─────────────────────────────────────────
  setMode: (mode: TacticalMode) => void
  setMaxCloudCover: (v: number) => void
  setObservationDate: (d: string) => void
  setOpticalSource: (s: 'nasa' | 'esri' | 'eox' | 'ocean') => void
  bumpScan: () => void
  setScanSensitivity: (v: number) => void
  setBrightSpots: (s: Detection[]) => void
  setDetections: (d: DetectionCollection | null) => void
  setAiStatus: (s: TacticalState['aiStatus'], error?: string | null) => void
  setSelecting: (v: boolean) => void
  setSelectedBBox: (b: BBox | null) => void
  setStatus: (msg: string) => void
  setManOverboard: (p: { lat: number; lng: number } | null) => void
  setRescueResult: (env: MarineEnv | null, points: DriftPoint[]) => void
  setRescueStatus: (s: TacticalState['rescueStatus']) => void
  setVessels: (v: Vessel[]) => void
  setShowBoatLights: (b: boolean) => void
  setShowRadarVessels: (b: boolean) => void
  setOwnPosition: (p: TacticalState['ownPosition']) => void
  toggleTrackRecording: () => void
  pushTrackPoint: (p: { lat: number; lng: number }) => void
  clearTrack: () => void
  setFlyTo: (t: { lat: number; lng: number; zoom?: number } | null) => void
  /** 跳到座標並記錄歷史（座標查詢/清單點擊共用）。 */
  gotoCoord: (lat: number, lng: number, zoom?: number) => void
  /** 新增一筆已存座標（釘選或最愛）。 */
  addSavedCoord: (c: { lat: number; lng: number; label?: string; pinned?: boolean; favorite?: boolean }) => void
  updateSavedCoord: (id: string, patch: Partial<SavedCoord>) => void
  removeSavedCoord: (id: string) => void
  clearHistory: () => void
  toggleMeasure: () => void
  addMeasurePoint: (p: { lat: number; lng: number }) => void
  clearMeasure: () => void
  toggleTools: () => void
  setBaseLayer: (id: BaseLayerId) => void
  setShowTerritorial: (v: boolean) => void
  setSeaStateField: (f: 'sst' | 'wave') => void
  setSeaStateRange: (r: { min: number; max: number } | null) => void
  setCwaTide: (t: TideEvent[] | null) => void
  setCwaSeaAreas: (s: SeaAreaForecast[] | null) => void
  setActiveTyphoon: (t: Typhoon | null) => void
  setAnimEpoch: (e: number) => void
  setAnimPlaying: (v: boolean) => void
  setAnimTimes: (t: number[]) => void
  setScrubHours: (h: number) => void
  setDriftTarget: (id: string, leeway: number) => void
  setDriftPoints: (points: DriftPoint[]) => void
  setSourcePoints: (points: DriftPoint[]) => void
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
  scanTick: 0,
  scanSensitivity: 3,
  brightSpots: [],
  detections: null,
  aiStatus: 'idle',
  aiError: null,
  selecting: false,
  selectedBBox: null,
  manOverboard: null,
  rescueEnv: null,
  driftPoints: [],
  sourcePoints: [],
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
  showBoatLights: false,
  showRadarVessels: false,
  seaStateField: 'sst',
  seaStateRange: null,
  activeTyphoon: null,
  cwaTide: null,
  cwaSeaAreas: null,
  animEpoch: 0,
  animPlaying: false,
  animTimes: [],
  flyToTarget: null,
  savedCoords: loadSaved(),
  coordHistory: loadHistory(),
  measuring: false,
  measurePoints: [],
  ownPosition: null,
  trackRecording: false,
  ownTrack: [],
  baseLayer: ((): BaseLayerId => {
    const v = (() => {
      try {
        return localStorage.getItem('argus.baseLayer.v1')
      } catch {
        return null
      }
    })()
    return v === 'nlsc' || v === 'nlscPhoto' || v === 'dark' ? v : 'dark'
  })(),
  toolsExpanded: false,
  showTerritorial: false,
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
      sourcePoints: [],
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
      // 注意：vessels 不清空——保留最後已知 AIS，供光學亮點掃描做「無AIS=可疑」比對。
      brightSpots: [],
      cwaTide: null,
      cwaSeaAreas: null,
      animPlaying: false,
      animTimes: [],
      statusMessage: MODE_HINT[mode],
    })),

  setMaxCloudCover: (v) => set({ maxCloudCover: v }),
  setObservationDate: (d) => set({ observationDate: d }),
  setOpticalSource: (s: 'nasa' | 'esri' | 'eox' | 'ocean') => set({ opticalSource: s }),
  bumpScan: () => set((st) => ({ scanTick: st.scanTick + 1 })),
  setScanSensitivity: (v) => set({ scanSensitivity: v }),
  setBrightSpots: (s) => set({ brightSpots: s }),
  setDetections: (d) => set({ detections: d }),
  setAiStatus: (s, error = null) => set({ aiStatus: s, aiError: error }),
  setSelecting: (v) => set({ selecting: v }),
  setSelectedBBox: (b) => set({ selectedBBox: b }),
  setStatus: (msg) => set({ statusMessage: msg }),
  setManOverboard: (p) => set({ manOverboard: p }),
  setRescueResult: (env, points) => set({ rescueEnv: env, driftPoints: points }),
  setRescueStatus: (s) => set({ rescueStatus: s }),
  setVessels: (v) => set({ vessels: v }),
  setShowBoatLights: (b) => set({ showBoatLights: b }),
  setShowRadarVessels: (b) => set({ showRadarVessels: b }),
  setOwnPosition: (p) => set({ ownPosition: p }),
  toggleTrackRecording: () =>
    set((st) => ({ trackRecording: !st.trackRecording, ownTrack: st.trackRecording ? st.ownTrack : [] })),
  pushTrackPoint: (p) =>
    set((st) => {
      const last = st.ownTrack[st.ownTrack.length - 1]
      // 去抖：距上一點 <15m 不記，避免原地漂移塞爆
      if (last) {
        const dLat = (p.lat - last.lat) * 111000
        const dLng = (p.lng - last.lng) * 111000 * Math.cos(last.lat * 0.0174533)
        if (Math.hypot(dLat, dLng) < 15) return {}
      }
      return { ownTrack: [...st.ownTrack, p] }
    }),
  clearTrack: () => set({ ownTrack: [] }),
  setFlyTo: (t) => set({ flyToTarget: t }),
  gotoCoord: (lat, lng, zoom) =>
    set((st) => {
      const coordHistory = pushHistory(st.coordHistory, lat, lng, Date.now())
      persistHistory(coordHistory)
      return { flyToTarget: { lat, lng, zoom: zoom ?? 12 }, coordHistory }
    }),
  addSavedCoord: (c) =>
    set((st) => {
      const now = Date.now()
      const item: SavedCoord = {
        id: newId(now),
        lat: c.lat,
        lng: c.lng,
        label: c.label?.trim() || defaultLabel(st.savedCoords.length + 1),
        favorite: c.favorite ?? false,
        pinned: c.pinned ?? false,
        createdAt: now,
      }
      const savedCoords = [item, ...st.savedCoords]
      persistSaved(savedCoords)
      return { savedCoords }
    }),
  updateSavedCoord: (id, patch) =>
    set((st) => {
      const savedCoords = st.savedCoords.map((c) => (c.id === id ? { ...c, ...patch } : c))
      persistSaved(savedCoords)
      return { savedCoords }
    }),
  removeSavedCoord: (id) =>
    set((st) => {
      const savedCoords = st.savedCoords.filter((c) => c.id !== id)
      persistSaved(savedCoords)
      return { savedCoords }
    }),
  clearHistory: () =>
    set(() => {
      persistHistory([])
      return { coordHistory: [] }
    }),
  toggleMeasure: () =>
    set((st) => ({ measuring: !st.measuring, measurePoints: st.measuring ? st.measurePoints : [] })),
  addMeasurePoint: (p) => set((st) => ({ measurePoints: [...st.measurePoints, p] })),
  clearMeasure: () => set({ measurePoints: [] }),
  toggleTools: () => set((st) => ({ toolsExpanded: !st.toolsExpanded })),
  setBaseLayer: (id) => {
    try {
      localStorage.setItem('argus.baseLayer.v1', id)
    } catch {
      /* ignore */
    }
    set({ baseLayer: id })
  },
  setShowTerritorial: (v) => set({ showTerritorial: v }),
  setSeaStateField: (f) => set({ seaStateField: f }),
  setSeaStateRange: (r) => set({ seaStateRange: r }),
  setCwaTide: (t) => set({ cwaTide: t }),
  setCwaSeaAreas: (s) => set({ cwaSeaAreas: s }),
  setActiveTyphoon: (t) => set({ activeTyphoon: t }),
  setAnimEpoch: (e) => set({ animEpoch: e }),
  setAnimPlaying: (v) => set({ animPlaying: v }),
  setAnimTimes: (t) => set({ animTimes: t }),
  setScrubHours: (h) => set({ scrubHours: h }),
  setDriftTarget: (id, leeway) => set({ driftTargetId: id, driftLeeway: leeway }),
  setDriftPoints: (points) => set({ driftPoints: points }),
  setSourcePoints: (points) => set({ sourcePoints: points }),
  setDriftMode: (m) => set({ driftMode: m }),
  setIncidentTime: (t) => set({ incidentTime: t }),
  setRescueSeries: (s) => set({ rescueSeries: s }),
  setShowProbability: (v) => set({ showProbability: v }),
  setMcSummary: (s) => set({ mcSummary: s }),
  setShowSearchPattern: (v) => set({ showSearchPattern: v }),
  setTrackSpacingNm: (nm) => set({ trackSpacingNm: nm }),
}))

function defaultLabel(n: number): string {
  return `座標 ${n}`
}

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
