// ── 蒙地卡羅漂流機率模擬 (SAROPS 式) ────────────────────────
//
// 依國研院海洋中心〈海上搜救：科學方法can help！〉一文：AMS 單點畫圈會隨
// 時間無限擴大而失去參考價值；改用蒙地卡羅在落海點周圍灑大量常態分布亂數
// 起點，每顆粒子依「偏航(leeway) + 左右風壓差 + 風場 + 流場」漂流，最後以
// 機率密度呈現目標最可能出現的區域。
//
// 執行於瀏覽器（可用 Math.random）；粒子數為手機效能與精度的折衷。

export interface MCCell {
  south: number
  west: number
  north: number
  east: number
  count: number
}
export interface MCResult {
  cells: MCCell[]
  maxCount: number
  /** 最高機率格中心。 */
  peak: { lat: number; lng: number } | null
  /** 涵蓋 ~95% 粒子的建議搜索半徑 (m)，從質心量起。 */
  radius95: number
  centroid: { lat: number; lng: number } | null
}

const DEG = Math.PI / 180
const R = 6371000

/** Box–Muller 常態分布亂數（平均 0、標準差 1）。 */
function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function toEastNorth(speed: number, dirDeg: number) {
  const r = dirDeg * DEG
  return { east: speed * Math.sin(r), north: speed * Math.cos(r) }
}
function offset(lat: number, lng: number, dE: number, dN: number) {
  return {
    lat: lat + (dN / R) / DEG,
    lng: lng + (dE / (R * Math.cos(lat * DEG))) / DEG,
  }
}

export interface MCInput {
  lat: number
  lng: number
  windSpeed: number
  windDir: number // from
  currentSpeed: number
  currentDir: number // toward
  leeway: number
  hours: number
  reverse?: boolean
  /** 粒子數（預設 1200）。 */
  n?: number
  /** 起始位置不確定性標準差 (m，預設 400)。 */
  posSigmaM?: number
}

/**
 * 執行蒙地卡羅模擬，回傳機率密度格與峰值。
 */
export function simulateMonteCarlo(input: MCInput): MCResult {
  const n = input.n ?? 1200
  const posSigma = input.posSigmaM ?? 400
  const t = input.hours * 3600
  const sign = input.reverse ? -1 : 1
  const windToward = (input.windDir + 180) % 360

  const endLats = new Float64Array(n)
  const endLngs = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    // 起始位置擾動（常態分布）
    const sE = gauss() * posSigma
    const sN = gauss() * posSigma
    // 偏航係數擾動 ±30%
    const leewayP = Math.max(0, input.leeway * (1 + gauss() * 0.3))
    // 左右風壓差：下風方向 ±(約 25° σ) 偏移
    const divergence = gauss() * 25
    const wind = toEastNorth(input.windSpeed * leewayP, (windToward + divergence + 360) % 360)
    // 洋流擾動：速度 ±20%、方向 ±12°
    const curSpeed = input.currentSpeed * (1 + gauss() * 0.2)
    const curDir = input.currentDir + gauss() * 12
    const cur = toEastNorth(curSpeed, curDir)

    const vE = cur.east + wind.east
    const vN = cur.north + wind.north
    const dE = sE + vE * t * sign
    const dN = sN + vN * t * sign
    const p = offset(input.lat, input.lng, dE, dN)
    endLats[i] = p.lat
    endLngs[i] = p.lng
  }

  // 質心
  let sumLat = 0
  let sumLng = 0
  for (let i = 0; i < n; i++) {
    sumLat += endLats[i]
    sumLng += endLngs[i]
  }
  const centroid = { lat: sumLat / n, lng: sumLng / n }

  // 95% 半徑：距質心距離排序取 95 百分位
  const dists = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const dN = (endLats[i] - centroid.lat) * DEG * R
    const dE = (endLngs[i] - centroid.lng) * DEG * R * Math.cos(centroid.lat * DEG)
    dists[i] = Math.hypot(dE, dN)
  }
  const sorted = Array.from(dists).sort((a, b) => a - b)
  const radius95 = sorted[Math.floor(n * 0.95)] || 0

  // 機率密度格：以粒子範圍切 grid，計數
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (let i = 0; i < n; i++) {
    if (endLats[i] < minLat) minLat = endLats[i]
    if (endLats[i] > maxLat) maxLat = endLats[i]
    if (endLngs[i] < minLng) minLng = endLngs[i]
    if (endLngs[i] > maxLng) maxLng = endLngs[i]
  }
  const G = 26 // grid 邊格數
  const dLat = (maxLat - minLat) / G || 1e-6
  const dLng = (maxLng - minLng) / G || 1e-6
  const counts = new Int32Array(G * G)
  for (let i = 0; i < n; i++) {
    let r = Math.floor((endLats[i] - minLat) / dLat)
    let c = Math.floor((endLngs[i] - minLng) / dLng)
    if (r >= G) r = G - 1
    if (c >= G) c = G - 1
    counts[r * G + c]++
  }
  let maxCount = 0
  let peakIdx = -1
  const cells: MCCell[] = []
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const cnt = counts[r * G + c]
      if (cnt === 0) continue
      if (cnt > maxCount) {
        maxCount = cnt
        peakIdx = r * G + c
      }
      const south = minLat + r * dLat
      const west = minLng + c * dLng
      cells.push({ south, west, north: south + dLat, east: west + dLng, count: cnt })
    }
  }
  const peak =
    peakIdx >= 0
      ? {
          lat: minLat + (Math.floor(peakIdx / G) + 0.5) * dLat,
          lng: minLng + ((peakIdx % G) + 0.5) * dLng,
        }
      : null

  return { cells, maxCount, peak, radius95, centroid }
}
