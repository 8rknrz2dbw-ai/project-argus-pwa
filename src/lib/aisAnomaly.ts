// ── AIS 異常行為偵測 ────────────────────────────────────────
import type { Vessel } from './ais'

/** 禁限制水域（示範：台灣東北外海一塊）。可換成真實禁漁區/軍事區。 */
export const RESTRICTED_ZONE = {
  name: '限制水域 A',
  south: 24.3,
  north: 25.0,
  west: 121.9,
  east: 122.6,
}

/** 判定異常的門檻。 */
const SPEED_ANOMALY_KN = 25 // 一般商漁船罕見超過

export interface VesselAnalysis {
  vessel: Vessel
  alerts: string[]
  /** ok = 正常, warn = 需注意, alert = 高度可疑 */
  level: 'ok' | 'warn' | 'alert'
}

function inRestricted(v: Vessel): boolean {
  return (
    v.lat >= RESTRICTED_ZONE.south &&
    v.lat <= RESTRICTED_ZONE.north &&
    v.lng >= RESTRICTED_ZONE.west &&
    v.lng <= RESTRICTED_ZONE.east
  )
}

/** 分析單艘船，回傳警示清單與等級。 */
export function analyzeVessel(v: Vessel): VesselAnalysis {
  const alerts: string[] = []
  if (v.name === '(無船名)' || v.type === '不明') alerts.push('無船名/身分不明')
  if (v.sog > SPEED_ANOMALY_KN) alerts.push(`航速異常 ${v.sog.toFixed(0)} kn`)
  if (inRestricted(v)) alerts.push(`駛入${RESTRICTED_ZONE.name}`)

  const level: VesselAnalysis['level'] =
    alerts.length === 0 ? 'ok' : alerts.length >= 2 || inRestricted(v) ? 'alert' : 'warn'
  return { vessel: v, alerts, level }
}

/** 分析整批船。 */
export function analyzeVessels(vessels: Vessel[]): VesselAnalysis[] {
  return vessels.map(analyzeVessel)
}
