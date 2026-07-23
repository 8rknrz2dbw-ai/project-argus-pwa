// ── GDACS 免金鑰颱風來源（盡力而為）────────────────────────
//
// GDACS（全球災害警報系統）提供活躍熱帶氣旋的公開資料，免金鑰。這裡取事件
// 清單、挑出最接近台灣的熱帶氣旋，組成我們的 Typhoon（含真實名稱與目前位置）。
// GDACS 清單多為「目前位置」，未必含完整預報路徑；完整路徑與官方警報仍以
// 中央氣象署(CWA，需設定)為準。任何解析失敗一律回 null → 前端退回示範。

import { catOf, type Typhoon, type TyphoonPoint } from './typhoon'

const EVENTS = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP'
const TW = { lat: 23.7, lng: 121.0 }

function num(v: unknown, d = NaN): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : d
}
function kmFromTaiwan(lat: number, lng: number): number {
  const dLat = (lat - TW.lat) * 111
  const dLng = (lng - TW.lng) * 111 * Math.cos(TW.lat * 0.0174533)
  return Math.hypot(dLat, dLng)
}
/** 由 GDACS 分類/風速粗估暴風半徑(km)。 */
function galeFromWindKt(kt: number): number {
  if (kt < 34) return 120
  if (kt < 64) return 170
  if (kt < 100) return 230
  return 290
}

export async function fetchGdacsTyphoon(): Promise<Typhoon | null> {
  let data: any
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(EVENTS, { signal: ctrl.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }
  try {
    const feats: any[] = data?.features ?? []
    const tcs = feats.filter((f) => {
      const t = f?.properties?.eventtype ?? f?.properties?.eventtypeid
      return t === 'TC' || t === 'TC '
    })
    if (!tcs.length) return null
    // 取最接近台灣者
    let best: { f: any; d: number } | null = null
    for (const f of tcs) {
      const g = f?.geometry?.coordinates
      if (!Array.isArray(g) || g.length < 2) continue
      const d = kmFromTaiwan(num(g[1]), num(g[0]))
      if (!best || d < best.d) best = { f, d }
    }
    if (!best) return null
    // 太遠（>3000km）視為與台灣無關，回 null 讓前端顯示示範
    if (best.d > 3000) return null

    const p = best.f.properties ?? {}
    const g = best.f.geometry.coordinates
    const lat = num(g[1])
    const lng = num(g[0])
    const name = String(p.eventname || p.name || p.htmldescription || '熱帶氣旋').replace(/^Typhoon\s+/i, '')
    // GDACS severity 常為最大風速 km/h
    const windKmh = num(p?.severitydata?.severity, NaN)
    const windKt = Number.isFinite(windKmh) ? windKmh / 1.852 : 55
    const cur: TyphoonPoint = {
      lat,
      lng,
      hours: 0,
      windKt: Math.round(windKt),
      galeRadiusKm: galeFromWindKt(windKt),
      cat: catOf(windKt),
    }
    // 盡力抓「預報路徑」讓免費版也有完整軌跡；失敗就只用目前位置。
    const track = await fetchTrack(p.eventid, p.episodeid, cur).catch(() => [cur])
    return { name, nameEn: String(p.eventname || 'TC'), demo: false, track }
  } catch {
    return null
  }
}

/** 抓 GDACS 事件幾何，擷取路徑點（觀測+預報）。防禦性；對不上就回目前位置。 */
async function fetchTrack(eventid: unknown, episodeid: unknown, cur: TyphoonPoint): Promise<TyphoonPoint[]> {
  if (!eventid) return [cur]
  const url = `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${eventid}${
    episodeid ? `&episodeid=${episodeid}` : ''
  }`
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10000)
  let data: any
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return [cur]
    data = await res.json()
  } finally {
    clearTimeout(timeout)
  }
  const now = Date.now()
  const feats: any[] = data?.features ?? []
  const pts: TyphoonPoint[] = []
  for (const f of feats) {
    const cls = String(f?.properties?.Class ?? f?.properties?.class ?? '')
    if (!/point/i.test(cls)) continue // 只取路徑點，略過線/多邊形
    const g = f?.geometry?.coordinates
    if (!Array.isArray(g) || g.length < 2) continue
    const pr = f.properties ?? {}
    const t = Date.parse(pr.trackdate ?? pr.dateTime ?? pr.date ?? '')
    const hours = Number.isFinite(t) ? Math.round((t - now) / 3600000) : 0
    const w = num(pr.windspeed, NaN)
    const windKt = Number.isFinite(w) ? w / 1.852 : cur.windKt
    pts.push({
      lat: num(g[1]),
      lng: num(g[0]),
      hours,
      windKt: Math.round(windKt),
      galeRadiusKm: galeFromWindKt(windKt),
      cat: catOf(windKt),
    })
  }
  if (pts.length < 2) return [cur]
  pts.sort((a, b) => a.hours - b.hours)
  return pts
}
