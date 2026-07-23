// ── 颱風路徑資料 ────────────────────────────────────────────
//
// 即時 W.Pacific 颱風「預報路徑」沒有乾淨的免金鑰 CORS 來源（CWA/JTWC 都無
// 開放 CORS JSON）。這裡提供結構化的示範颱風＋渲染，真實 feed 之後可由
// Cloudflare Worker 代理 GDACS/JTWC 後以相同格式餵入。

export interface TyphoonPoint {
  lat: number
  lng: number
  /** 距現在的小時（0=現在，負=過去，正=預報）。 */
  hours: number
  /** 近中心最大風速（kt）。 */
  windKt: number
  /** 七級暴風半徑（km）。 */
  galeRadiusKm: number
  /** 分類：TD/TS/TY/STY。 */
  cat: string
}

export interface Typhoon {
  name: string
  nameEn: string
  demo: boolean
  track: TyphoonPoint[]
}

/** 依風速分類（简化，kt）。 */
export function catOf(windKt: number): string {
  if (windKt < 34) return '熱帶低壓 TD'
  if (windKt < 64) return '輕度 TS'
  if (windKt < 100) return '中度 TY'
  return '強烈 STY'
}

/** 示範颱風：自台灣東南方向西北移動、逼近台灣。 */
export function demoTyphoon(): Typhoon {
  const raw: [number, number, number, number, number][] = [
    // lat, lng, hours, windKt, galeRadiusKm
    [19.5, 126.5, -24, 45, 150],
    [20.6, 125.2, -12, 60, 180],
    [21.6, 124.0, 0, 85, 220],
    [22.6, 122.9, 12, 95, 250],
    [23.6, 121.8, 24, 90, 240],
    [24.8, 120.6, 48, 70, 200],
    [26.2, 119.6, 72, 50, 160],
  ]
  return {
    name: '示範颱風',
    nameEn: 'DEMO',
    demo: true,
    track: raw.map(([lat, lng, hours, windKt, galeRadiusKm]) => ({
      lat,
      lng,
      hours,
      windKt,
      galeRadiusKm,
      cat: catOf(windKt),
    })),
  }
}

/** 取「現在」位置點（hours===0，否則最接近 0）。 */
export function currentPoint(t: Typhoon): TyphoonPoint {
  return t.track.reduce((a, b) => (Math.abs(b.hours) < Math.abs(a.hours) ? b : a))
}
