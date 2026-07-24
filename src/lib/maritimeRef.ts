// ── 海域參考圖資（海上風電場 / 台海中線）─────────────────────
//
// 態勢感知用「示意位置」，非官方精確劃界；實際範圍/邊界以航港局公告與各風場
// 施工圖為準。對海巡：風電場＝作業區/限制航行/避碰熱點；中線＝越界監控參考。

export interface WindFarm {
  name: string
  /** 場區約略中心。 */
  lat: number
  lng: number
  /** 約略半徑(km)——畫圈示意涵蓋範圍。 */
  radiusKm: number
  status: '營運' | '建置中' | '規劃'
}

/** 台灣西部外海主要離岸風電場（示意中心，由北到南）。 */
export const WIND_FARMS: WindFarm[] = [
  { name: '海洋風電 Formosa 1（竹南外海）', lat: 24.71, lng: 120.84, radiusKm: 5, status: '營運' },
  { name: '海能風電 Formosa 2（苗栗外海）', lat: 24.6, lng: 120.62, radiusKm: 8, status: '營運' },
  { name: '中能風場（彰化外海）', lat: 24.12, lng: 120.1, radiusKm: 8, status: '建置中' },
  { name: '台電一期（彰化外海）', lat: 24.05, lng: 120.3, radiusKm: 5, status: '營運' },
  { name: '大彰化 東南／西南（彰化外海）', lat: 23.98, lng: 119.98, radiusKm: 15, status: '營運' },
  { name: '海龍 Hai Long（彰化外海）', lat: 23.9, lng: 119.88, radiusKm: 12, status: '建置中' },
  { name: '允能風場 Yunlin（雲林外海）', lat: 23.83, lng: 120.1, radiusKm: 10, status: '營運' },
]

/**
 * 台灣海峽中線（示意，非官方劃界）：由東北往西南橫貫海峽的參考線，
 * 供海巡監控越界態勢用。座標為近似，實際以官方公告為準。
 */
export const MEDIAN_LINE: [number, number][] = [
  [26.5, 121.5],
  [25.5, 120.4],
  [24.5, 119.3],
  [23.5, 118.4],
  [22.8, 117.9],
]
