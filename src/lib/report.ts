// ── 搜救報告產生與分享 ──────────────────────────────────────
import type { DriftPoint } from './drift'
import { bearingToText } from './drift'
import type { MarineEnv } from './marineEnv'

export interface ReportInput {
  mob: { lat: number; lng: number }
  env: MarineEnv
  drift: DriftPoint[]
  reverse?: boolean
  targetLabel?: string
  /** 蒙地卡羅摘要（可選）。 */
  mc?: { peak: { lat: number; lng: number } | null; radius95: number } | null
  /** 日照窗口（可選）。 */
  sun?: { sunrise: number | null; sunset: number | null; dusk: number | null } | null
  /** 潮汐（可選，取最近幾筆）。 */
  tide?: { time: number; type: string; heightCm: number | null; station: string }[] | null
  /** 我到目標的距離/方位（可選）。 */
  fromOwn?: { distNm: number; bearingDeg: number } | null
}

/** 產生純文字搜救報告（給隊友、可貼進通訊軟體）。 */
export function buildReport({ mob, env, drift, reverse, targetLabel, mc, sun, tide, fromOwn }: ReportInput): string {
  const lines: string[] = []
  lines.push('【阿爾戈斯 搜救漂流預判報告】')
  if (targetLabel) lines.push(`漂流物體：${targetLabel}`)
  lines.push(`推演方向：${reverse ? '逆推（回推來源）' : '順推（往未來漂）'}`)
  lines.push(`${reverse ? '發現/目擊點' : '落海點'}：${fmtCoord(mob.lat, mob.lng)}`)
  if (fromOwn) {
    lines.push(`我方位置 → 目標：${bearingToText(fromOwn.bearingDeg)}方 ${fromOwn.distNm.toFixed(1)} 浬`)
  }
  lines.push(
    `海象：風 ${env.windSpeed.toFixed(1)} m/s 來自${bearingToText(env.windDir)}、` +
      `洋流 ${env.currentSpeed.toFixed(2)} m/s 往${bearingToText(env.currentDir)}、` +
      `浪高 ${env.waveHeight.toFixed(1)} m${env.live ? '' : '（離線預設值）'}`,
  )
  lines.push(reverse ? '回推來源：' : '漂流預判：')
  for (const p of drift) {
    lines.push(
      `  ${p.hours}h ${reverse ? '前' : '後'} → ${fmtCoord(p.lat, p.lng)}｜` +
        `${bearingToText(p.bearingDeg)}方 ${(p.driftMeters / 1852).toFixed(1)} 浬｜` +
        `半徑 ${(p.radiusMeters / 1852).toFixed(1)} 浬`,
    )
  }
  if (mc && mc.peak) {
    lines.push('蒙地卡羅機率搜索（1200 粒子）：')
    lines.push(`  最高機率位置：${fmtCoord(mc.peak.lat, mc.peak.lng)}`)
    lines.push(`  95% 搜索範圍半徑：${(mc.radius95 / 1852).toFixed(1)} 浬`)
  }
  if (sun && (sun.sunrise || sun.sunset)) {
    lines.push(`日照：日出 ${hm(sun.sunrise)}、日落 ${hm(sun.sunset)}、天黑 ${hm(sun.dusk)}`)
  }
  if (tide && tide.length) {
    const t = tide
      .slice(0, 3)
      .map((e) => `${e.type}${hm(e.time)}${e.heightCm != null ? `(${Math.round(e.heightCm)}cm)` : ''}`)
      .join('、')
    lines.push(`潮汐(${tide[0].station})：${t}`)
  }
  lines.push('※ 近似模型供快速決策參考，請並用官方 SAROPS 與現場判斷。')
  return lines.join('\n')
}

function hm(e: number | null | undefined): string {
  if (e == null) return '—'
  const d = new Date(e)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
