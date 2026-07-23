// ── AIS 異常行為偵測（海巡走私/偷渡快篩）──────────────────
import type { Vessel } from './ais'
import { TAIWAN_BASELINE } from './territorialWaters'

const SPEED_ANOMALY_KN = 25 // 一般商漁船罕見超過（疑似走私快艇）
const FAST_NEAR_COAST_KN = 18 // 近岸高速
const LOITER_MIN = 0.3 // 低於此近似停俥/錨泊
const LOITER_MAX = 2.5 // 低速滯留（疑似接駁/等待）
const TERRITORIAL_KM = 22.2 // 12 浬領海
const CONTIGUOUS_KM = 44.4 // 24 浬鄰接區

const DEG = Math.PI / 180
const R = 6371
function coastKm(lat: number, lng: number): number {
  let best = Infinity
  for (const [la, lo] of TAIWAN_BASELINE) {
    const a =
      Math.sin(((la - lat) * DEG) / 2) ** 2 +
      Math.cos(lat * DEG) * Math.cos(la * DEG) * Math.sin(((lo - lng) * DEG) / 2) ** 2
    const d = 2 * R * Math.asin(Math.sqrt(a))
    if (d < best) best = d
  }
  return best
}

export interface VesselAnalysis {
  vessel: Vessel
  alerts: string[]
  /** ok = 正常, warn = 需注意, alert = 高度可疑 */
  level: 'ok' | 'warn' | 'alert'
  /** 距海岸 km。 */
  coastKm: number
}

/** 分析單艘船，回傳警示清單與等級（含海巡走私/偷渡態樣）。 */
export function analyzeVessel(v: Vessel): VesselAnalysis {
  const alerts: string[] = []
  const dk = coastKm(v.lat, v.lng)
  const unknown = v.name === '(無船名)' || v.type === '不明'
  const inTerritorial = dk <= TERRITORIAL_KM
  const inContiguous = dk <= CONTIGUOUS_KM
  const loitering = v.sog >= LOITER_MIN && v.sog <= LOITER_MAX

  let score = 0
  if (unknown) {
    alerts.push('無船名/身分不明')
    score += inTerritorial ? 2 : 1
  }
  if (v.sog > SPEED_ANOMALY_KN) {
    alerts.push(`航速異常 ${v.sog.toFixed(0)} kn`)
    score += 1
  }
  if (inTerritorial && unknown) {
    alerts.push('⚠ 無AIS身分闖入領海（疑似偷渡/走私）')
    score += 2
  } else if (inContiguous && unknown) {
    alerts.push('無身分進入鄰接區')
    score += 1
  }
  if (loitering && inContiguous) {
    alerts.push('近岸低速滯留（疑似接駁/等待）')
    score += inTerritorial ? 2 : 1
  }
  if (v.sog >= FAST_NEAR_COAST_KN && inContiguous && unknown) {
    alerts.push('近岸高速＋無身分（疑似走私快艇）')
    score += 2
  }

  const level: VesselAnalysis['level'] = score >= 3 ? 'alert' : score >= 1 ? 'warn' : 'ok'
  return { vessel: v, alerts, level, coastKm: dk }
}

/** 分析整批船。 */
export function analyzeVessels(vessels: Vessel[]): VesselAnalysis[] {
  return vessels.map(analyzeVessel)
}
