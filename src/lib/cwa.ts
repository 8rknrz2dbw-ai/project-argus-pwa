// ── 中央氣象署 (CWA) Open Data 介接 ─────────────────────────
//
// CWA Open Data API 沒有 CORS，且授權碼不宜暴露在瀏覽器，因此一律透過
// 已部署的 Cloudflare Worker 代理（同一支 edgeAiUrl，POST 帶 cwaDataset）。
// Worker 端注入/轉送授權碼後打 CWA，回傳 JSON。
//
// 目前接：颱風路徑潛勢預報 W-C0034-005（取代示範颱風）。

import { getConfig } from './config'
import { catOf, type Typhoon, type TyphoonPoint } from './typhoon'

/** 透過 Worker 代理呼叫 CWA datastore，回傳原始 JSON。 */
export async function fetchCwaJson(
  dataset: string,
  params: Record<string, string> = {},
): Promise<any> {
  const cfg = getConfig()
  if (!cfg.edgeAiUrl) throw new Error('需先設定邊緣 Worker 網址')
  if (!cfg.cwaKey) throw new Error('需先設定 CWA 授權碼')
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(cfg.edgeAiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwaDataset: dataset, cwaKey: cfg.cwaKey, cwaParams: params }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Worker/CWA ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

const MS_TO_KT = 1.94384

function n(v: unknown, d = 0): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : d
}

/** 從一個 fix 物件抽出七級風(15 m/s)暴風半徑（km）。CWA 欄位命名多變，盡量兼容。 */
function galeRadiusOf(fix: any): number {
  const cand =
    fix?.radiusOf15Ms ??
    fix?.circleOf15Ms?.radius ??
    fix?.circleOf15Ms?.[0]?.radius ??
    fix?.stormRadius ??
    0
  // 有些為方位分段半徑陣列，取最大值
  if (Array.isArray(cand)) return Math.max(0, ...cand.map((x) => n(x?.radius ?? x)))
  return n(cand)
}

function coordOf(fix: any): [number, number] | null {
  // "lng,lat" 字串，或 {lat,lon}
  const c = fix?.coordinate ?? fix?.coordinates
  if (typeof c === 'string' && c.includes(',')) {
    const [lng, lat] = c.split(',').map((s: string) => parseFloat(s))
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  }
  const lat = n(fix?.lat ?? fix?.latitude, NaN)
  const lng = n(fix?.lon ?? fix?.lng ?? fix?.longitude, NaN)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  return null
}

/**
 * 解析 CWA W-C0034-005 為我們的 Typhoon 結構。防禦性寫法：欄位對不上就回 null，
 * 讓呼叫端退回示範颱風，永遠不會壞掉。
 */
export async function fetchCwaTyphoon(nowMs: number): Promise<Typhoon | null> {
  let data: any
  try {
    data = await fetchCwaJson('W-C0034-005')
  } catch {
    return null
  }
  try {
    const list =
      data?.records?.tropicalCyclones?.tropicalCyclone ??
      data?.records?.tropicalCyclone ??
      []
    const tc = Array.isArray(list) ? list[0] : list
    if (!tc) return null

    const name =
      String(tc.cwaTyphoonName || tc.typhoonName || (tc.cwaTdNo ? `TD${tc.cwaTdNo}` : '') || '颱風')
    const nameEn = String(tc.typhoonName || 'TYPHOON')

    const analysis = toArr(tc?.analysisData?.fix)
    const forecast = toArr(tc?.forecastData?.fix)
    const track: TyphoonPoint[] = []

    // 分析(觀測)點：hours 依 fixTime 相對現在（多為負或 0）
    for (const f of analysis) {
      const co = coordOf(f)
      if (!co) continue
      const t = Date.parse(f?.fixTime ?? f?.dateTime ?? '')
      const hours = Number.isFinite(t) ? Math.round((t - nowMs) / 3600000) : 0
      const windKt = n(f?.maxWindSpeed) * MS_TO_KT
      track.push({
        lat: co[0],
        lng: co[1],
        hours,
        windKt: Math.round(windKt),
        galeRadiusKm: Math.round(galeRadiusOf(f)),
        cat: catOf(windKt),
      })
    }
    // 預報點：tau = 未來小時
    for (const f of forecast) {
      const co = coordOf(f)
      if (!co) continue
      const hours = n(f?.tau, NaN)
      if (!Number.isFinite(hours)) continue
      const windKt = n(f?.maxWindSpeed) * MS_TO_KT
      track.push({
        lat: co[0],
        lng: co[1],
        hours,
        windKt: Math.round(windKt),
        galeRadiusKm: Math.round(galeRadiusOf(f)),
        cat: catOf(windKt),
      })
    }

    if (track.length < 2) return null
    track.sort((a, b) => a.hours - b.hours)
    return { name, nameEn, demo: false, track }
  } catch {
    return null
  }
}

function toArr(x: any): any[] {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}
