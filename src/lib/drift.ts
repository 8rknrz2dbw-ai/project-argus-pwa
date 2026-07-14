// ── 落海漂流預判引擎 (Search & Rescue drift model) ──────────
//
// 純函式、無副作用、可單元測試。輸入落海點 + 風 + 洋流，輸出未來
// 各時間點的預測位置與「搜索半徑」（不確定性隨時間擴大）。
//
// 模型（簡化 SAR leeway）：
//   總漂移 = 洋流漂移向量 + 風致漂移向量(leeway)
//   - 洋流：直接以洋流速度×時間位移，方向 = 洋流流向（toward）
//   - leeway：漂浮人體約為風速的 ~3%，方向順風（downwind）
//   搜索半徑：隨時間與漂移距離擴大（累積定位誤差 + 洋流/風不確定性）
//
// 註：這是給第一線快速決策用的近似模型，不取代官方 SAROPS。

export interface Vector {
  /** 速度 (m/s) */
  speed: number
  /** 方向（度，從正北順時針）。語意見下方參數說明。 */
  dirDeg: number
}

export interface DriftInput {
  lat: number
  lng: number
  /** 風：dirDeg 為「風的來向 (from)」，氣象慣例。 */
  wind: Vector
  /** 洋流：dirDeg 為「流去的方向 (toward)」，海洋慣例。 */
  current: Vector
  /** 落海人員的風壓漂移係數（PIW≈0.03，救生筏更大）。 */
  leewayFactor?: number
  /** 要預測的時間點（小時）。 */
  hoursList?: number[]
}

export interface DriftPoint {
  hours: number
  lat: number
  lng: number
  /** 從落海點算起的漂移距離 (m)。 */
  driftMeters: number
  /** 建議搜索半徑 (m)。 */
  radiusMeters: number
  /** 該時刻的總漂移方向（度，toward）。 */
  bearingDeg: number
}

const DEG = Math.PI / 180
const R_EARTH = 6371000 // m

/** 由速度+方向(toward, 度) 拆成東/北分量 (m/s)。 */
function toEastNorth(v: Vector): { east: number; north: number } {
  const r = v.dirDeg * DEG
  return { east: v.speed * Math.sin(r), north: v.speed * Math.cos(r) }
}

/** 從一點沿東/北位移(公尺)算出新的經緯度（短距離等距近似）。 */
function offset(lat: number, lng: number, dEast: number, dNorth: number) {
  const dLat = (dNorth / R_EARTH) / DEG
  const dLng = (dEast / (R_EARTH * Math.cos(lat * DEG))) / DEG
  return { lat: lat + dLat, lng: lng + dLng }
}

/**
 * 計算漂流預測。回傳依時間排序的預測點。
 */
export function predictDrift(input: DriftInput): DriftPoint[] {
  const leeway = input.leewayFactor ?? 0.03
  const hoursList = input.hoursList ?? [1, 3, 6]

  // 風「來向」→ 漂移「去向」= 來向 + 180
  const windToward: Vector = { speed: input.wind.speed * leeway, dirDeg: (input.wind.dirDeg + 180) % 360 }
  const cur = toEastNorth(input.current)
  const wnd = toEastNorth(windToward)

  // 合成漂移速度向量 (m/s)
  const vEast = cur.east + wnd.east
  const vNorth = cur.north + wnd.north
  const vSpeed = Math.hypot(vEast, vNorth)
  const vBearing = (Math.atan2(vEast, vNorth) / DEG + 360) % 360

  return hoursList.map((h) => {
    const t = h * 3600 // 秒
    const dEast = vEast * t
    const dNorth = vNorth * t
    const { lat, lng } = offset(input.lat, input.lng, dEast, dNorth)
    const driftMeters = vSpeed * t

    // 搜索半徑：基礎 500m + 漂移距離的 25%（隨時間與距離擴大的不確定性）
    const radiusMeters = 500 + driftMeters * 0.25

    return {
      hours: h,
      lat,
      lng,
      driftMeters,
      radiusMeters,
      bearingDeg: vBearing,
    }
  })
}

/** 把方向度數轉成 8 方位中文，給 UI 顯示用。 */
export function bearingToText(deg: number): string {
  const dirs = ['北', '東北', '東', '東南', '南', '西南', '西', '西北']
  return dirs[Math.round((deg % 360) / 45) % 8]
}
