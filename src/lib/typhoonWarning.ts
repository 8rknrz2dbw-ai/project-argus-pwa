// ── 颱風警報時機推估（海警/陸警 ETA）──────────────────────
//
// 依颱風「預報路徑點 + 暴風半徑」推估最快何時暴風圈(7級風)會影響台灣：
//   海警：暴風圈進入台灣近海（沿岸 100 km 內）——CWA 約發布於 24h 前。
//   陸警：暴風圈觸及陸地——CWA 約發布於 18h 前。
// 這是「從路徑推估」，非官方警報；官方以中央氣象署發布為準。

import { TAIWAN_BASELINE } from './territorialWaters'
import type { Typhoon } from './typhoon'

const R = 6371
const DEG = Math.PI / 180
function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const a =
    Math.sin(((lat2 - lat1) * DEG) / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(((lng2 - lng1) * DEG) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
/** 某點到台灣本島海岸（基線點近似）的最短距離(km)。 */
function nearestTaiwanKm(lat: number, lng: number): number {
  let best = Infinity
  for (const [la, lo] of TAIWAN_BASELINE) {
    const d = kmBetween(lat, lng, la, lo)
    if (d < best) best = d
  }
  return best
}

export interface WarningEstimate {
  /** 最快海警（暴風圈進近海 100km）距現在小時；null=推估不影響。 */
  seaHours: number | null
  /** 最快陸警（暴風圈觸陸）距現在小時；null=推估不影響。 */
  landHours: number | null
  /** 暴風圈邊緣與台灣海岸的最近距離(km，正=尚有距離、負=已觸及)。 */
  closestGapKm: number
  /** 是否已在影響中。 */
  seaNow: boolean
  landNow: boolean
}

const SEA_BUFFER_KM = 100

export function estimateWarnings(ty: Typhoon): WarningEstimate {
  const pts = ty.track.filter((p) => p.hours >= 0)
  let seaHours: number | null = null
  let landHours: number | null = null
  let closestGap = Infinity
  for (const p of pts) {
    const centerKm = nearestTaiwanKm(p.lat, p.lng)
    const gap = centerKm - p.galeRadiusKm // 暴風圈邊緣到海岸的距離
    if (gap < closestGap) closestGap = gap
    if (seaHours === null && gap <= SEA_BUFFER_KM) seaHours = p.hours
    if (landHours === null && gap <= 0) landHours = p.hours
  }
  return {
    seaHours,
    landHours,
    closestGapKm: closestGap,
    seaNow: seaHours === 0,
    landNow: landHours === 0,
  }
}
