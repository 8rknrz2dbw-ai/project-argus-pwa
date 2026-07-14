// ── 搜救報告產生與分享 ──────────────────────────────────────
import type { DriftPoint } from './drift'
import { bearingToText } from './drift'
import type { MarineEnv } from './marineEnv'

export interface ReportInput {
  mob: { lat: number; lng: number }
  env: MarineEnv
  drift: DriftPoint[]
}

/** 產生純文字搜救報告（給隊友、可貼進通訊軟體）。 */
export function buildReport({ mob, env, drift }: ReportInput): string {
  const lines: string[] = []
  lines.push('【ARGUS 搜救漂流預判報告】')
  lines.push(`落海點：${fmtCoord(mob.lat, mob.lng)}`)
  lines.push(
    `海象：風 ${env.windSpeed.toFixed(1)} m/s 來自${bearingToText(env.windDir)}、` +
      `洋流 ${env.currentSpeed.toFixed(2)} m/s 往${bearingToText(env.currentDir)}、` +
      `浪高 ${env.waveHeight.toFixed(1)} m${env.live ? '' : '（離線預設值）'}`,
  )
  lines.push('漂流預判：')
  for (const p of drift) {
    lines.push(
      `  ${p.hours}h 後 → ${fmtCoord(p.lat, p.lng)}｜` +
        `${bearingToText(p.bearingDeg)}方 ${(p.driftMeters / 1852).toFixed(1)} 浬｜` +
        `建議搜索半徑 ${(p.radiusMeters / 1852).toFixed(1)} 浬`,
    )
  }
  lines.push('※ 近似模型供快速決策參考，請並用官方 SAROPS 與現場判斷。')
  return lines.join('\n')
}

/** 用 Web Share 分享；不支援時退回複製到剪貼簿。回傳採用的方式。 */
export async function shareReport(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'ARGUS 搜救報告', text })
      return 'shared'
    }
  } catch {
    // 使用者取消分享也走到這，改試複製
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** 經緯度轉「度分」海事格式。 */
function fmtCoord(lat: number, lng: number): string {
  return `${dm(Math.abs(lat))}${lat >= 0 ? 'N' : 'S'} ${dm(Math.abs(lng))}${lng >= 0 ? 'E' : 'W'}`
}
function dm(v: number): string {
  const d = Math.floor(v)
  const m = (v - d) * 60
  return `${d}°${m.toFixed(2)}'`
}
