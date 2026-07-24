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
      const la = num(g[1])
      const lo = num(g[0])
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue // 防 NaN 座標流入 setView
      const d = kmFromTaiwan(la, lo)
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

/**
 * 抓 GDACS 事件幾何，擷取「觀測＋預報路徑」。
 * 穩健策略：改用 GeoJSON geometry.type 判斷（不再靠脆弱的 Class 字串）：
 *   1) 有時間的 Point → 最佳（真實時刻的路徑點）
 *   2) 沒時間但有 LineString 預報線 → 取線的頂點當路徑（時刻為估算）
 *   3) 都沒有 → 只回目前位置
 */
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
  } catch {
    return [cur]
  } finally {
    clearTimeout(timeout)
  }
  const now = Date.now()
  const feats: any[] = data?.features ?? []
  const timed: TyphoonPoint[] = []
  const untimed: TyphoonPoint[] = []
  // 每條 LineString 各自獨立收集——不可混用（過去軌跡/預報線/暴風半徑會交錯成亂線）。
  const lines: [number, number][][] = []
  const toLatLngs = (arr: any[]): [number, number][] =>
    (arr ?? [])
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => [num(c[1]), num(c[0])] as [number, number])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))

  const toPoint = (lat: number, lng: number, pr: any): { pt: TyphoonPoint; hasTime: boolean } | null => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const t = parseTrackDate(pr)
    const hasTime = Number.isFinite(t)
    const w = num(pr?.windspeed ?? pr?.wind ?? pr?.maxwind ?? pr?.severity, NaN)
    // GDACS 風速多為 km/h；>90 視為 km/h 換算成 kt，否則當作已是 kt。
    const windKt = Number.isFinite(w) ? Math.round(w > 90 ? w / 1.852 : w) : cur.windKt
    return {
      hasTime,
      pt: {
        lat,
        lng,
        hours: hasTime ? Math.round((t - now) / 3600000) : 0,
        windKt,
        galeRadiusKm: galeFromWindKt(windKt),
        cat: catOf(windKt),
      },
    }
  }

  for (const f of feats) {
    const geom = f?.geometry
    const pr = f?.properties ?? {}
    if (!geom) continue
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      const r = toPoint(num(geom.coordinates[1]), num(geom.coordinates[0]), pr)
      if (r) (r.hasTime ? timed : untimed).push(r.pt)
    } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      lines.push(toLatLngs(geom.coordinates))
    } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      for (const seg of geom.coordinates) lines.push(toLatLngs(seg))
    }
  }

  // 1) 有時刻的路徑點最可靠
  if (timed.length >= 2) return mergeCurrent(timed, cur)
  // 2) 把破碎的開放線段（GDACS 常把軌跡切成多段 2 點線）接回單一軌跡；
  //    略過封閉環（暴風半徑圈）。取接起來最長的那條當路徑，時刻為估算。
  const openSegs = lines.filter((l) => l.length >= 2 && !isClosedRing(l))
  const best = stitch(openSegs).sort((a, b) => b.length - a.length)[0]
  if (best && best.length >= 2) {
    const lineTrack = lineToTrack(best, cur)
    if (lineTrack.length >= 2) return lineTrack
  }
  // 3) 無時刻的點（至少畫出路徑形狀）
  if (untimed.length >= 2) return mergeCurrent(untimed, cur)
  return [cur]
}

/** 是否為封閉環（首尾幾乎重合）——暴風半徑圈等，不當路徑。 */
function isClosedRing(l: [number, number][]): boolean {
  if (l.length < 3) return false
  const a = l[0]
  const b = l[l.length - 1]
  return Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02
}

/** 把多段線依「端點相接」串成連續折線（還原被切碎的軌跡）。 */
function stitch(segs: [number, number][][]): [number, number][][] {
  const near = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 0.12 && Math.abs(a[1] - b[1]) < 0.12
  const used = new Array(segs.length).fill(false)
  const chains: [number, number][][] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = true
    let chain = segs[i].slice()
    let extended = true
    while (extended) {
      extended = false
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue
        const s = segs[j]
        const head = chain[0]
        const tail = chain[chain.length - 1]
        if (near(tail, s[0])) { chain = chain.concat(s.slice(1)); used[j] = true; extended = true }
        else if (near(tail, s[s.length - 1])) { chain = chain.concat(s.slice().reverse().slice(1)); used[j] = true; extended = true }
        else if (near(head, s[s.length - 1])) { chain = s.slice().concat(chain.slice(1)); used[j] = true; extended = true }
        else if (near(head, s[0])) { chain = s.slice().reverse().concat(chain.slice(1)); used[j] = true; extended = true }
      }
    }
    chains.push(chain)
  }
  return chains
}

/** 從任意屬性找出可解析的日期字串（欄名含 date/time）。 */
function parseTrackDate(pr: any): number {
  if (!pr || typeof pr !== 'object') return NaN
  for (const [k, v] of Object.entries(pr)) {
    if (typeof v === 'string' && /date|time/i.test(k)) {
      const t = Date.parse(v)
      if (Number.isFinite(t)) return t
    }
  }
  return NaN
}

/** 併入目前位置（若路徑缺 ~0h 點），並依時刻排序。 */
function mergeCurrent(pts: TyphoonPoint[], cur: TyphoonPoint): TyphoonPoint[] {
  const hasNow = pts.some((p) => Math.abs(p.hours) <= 2)
  const out = hasNow ? pts.slice() : [cur, ...pts]
  return out.sort((a, b) => a.hours - b.hours)
}

/**
 * 連續軌跡 → 路徑點：找出離現在位置最近的頂點當「現在(0h)」，取較長的那一臂
 * 當預報方向（過去段通常較短），沿線估 ~72h 展開。時刻為估算。
 */
function lineToTrack(coords: [number, number][], cur: TyphoonPoint): TyphoonPoint[] {
  if (coords.length < 2) return []
  // 離現在位置最近的頂點 = 分界（0h）
  let ni = 0
  let nd = Infinity
  coords.forEach((c, i) => {
    const d = (c[0] - cur.lat) ** 2 + (c[1] - cur.lng) ** 2
    if (d < nd) { nd = d; ni = i }
  })
  const fwd = coords.slice(ni) // 分界→尾
  const bwd = coords.slice(0, ni + 1).reverse() // 分界→頭
  // 預報段通常「延伸最遠」（+72h 距離最大）；以端點離現在位置的距離挑，
  // 比用頂點數量更穩健（避免把較密的『過去』軌跡誤當預報）。
  const reach = (arm: [number, number][]) =>
    arm.length ? (arm[arm.length - 1][0] - cur.lat) ** 2 + (arm[arm.length - 1][1] - cur.lng) ** 2 : -1
  let seg = reach(fwd) >= reach(bwd) ? fwd : bwd
  if (seg.length < 2) seg = fwd.length >= bwd.length ? fwd : bwd
  if (seg.length < 2) seg = coords.slice()
  // 降採樣到 ≤7 點
  const step = Math.max(1, Math.floor(seg.length / 6))
  const picks = seg.filter((_, i) => i % step === 0)
  if (picks[picks.length - 1] !== seg[seg.length - 1]) picks.push(seg[seg.length - 1])
  const span = 72 // 估算預報時程（h）
  return picks.map((c, i) => {
    const hours = picks.length > 1 ? Math.round((i / (picks.length - 1)) * span) : 0
    return { lat: c[0], lng: c[1], hours, windKt: cur.windKt, galeRadiusKm: cur.galeRadiusKm, cat: cur.cat }
  })
}
