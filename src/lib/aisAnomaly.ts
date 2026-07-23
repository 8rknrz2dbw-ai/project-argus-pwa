// ── AIS 異常行為偵測 ────────────────────────────────────────
import type { Vessel } from './ais'

/** 判定異常的門檻。 */
const SPEED_ANOMALY_KN = 25 // 一般商漁船罕見超過

export interface VesselAnalysis {
  vessel: Vessel
  alerts: string[]
  /** ok = 正常, warn = 需注意, alert = 高度可疑 */
  level: 'ok' | 'warn' | 'alert'
}

/** 分析單艘船，回傳警示清單與等級。 */
export function analyzeVessel(v: Vessel): VesselAnalysis {
  const alerts: string[] = []
  if (v.name === '(無船名)' || v.type === '不明') alerts.push('無船名/身分不明')
  if (v.sog > SPEED_ANOMALY_KN) alerts.push(`航速異常 ${v.sog.toFixed(0)} kn`)

  const level: VesselAnalysis['level'] =
    alerts.length === 0 ? 'ok' : alerts.length >= 2 ? 'alert' : 'warn'
  return { vessel: v, alerts, level }
}

/** 分析整批船。 */
export function analyzeVessels(vessels: Vessel[]): VesselAnalysis[] {
  return vessels.map(analyzeVessel)
}
