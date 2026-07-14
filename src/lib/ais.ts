// ── AIS 船舶識別資料源 ──────────────────────────────────────
//
// 預設：本機「模擬船隻」持續移動，讓你先看效果（免金鑰、開箱即用）。
// 進階：設定 VITE_AISSTREAM_KEY 後，連 aisstream.io 免費 WebSocket 取即時真實船舶。
//
// 介面用 subscribe(callback) 回傳「取消訂閱」函式，方便圖層卸載時徹底停掉
// （關掉 WebSocket / 清 interval），符合本專案的防爆原則。

export interface Vessel {
  mmsi: string
  name: string
  lat: number
  lng: number
  /** 航向（度） */
  cog: number
  /** 航速（節 kn） */
  sog: number
  /** 船種（漁船/貨船/油輪…） */
  type: string
}

import { getConfig, isAisConfigured } from './config'

export { isAisConfigured }

type Listener = (vessels: Vessel[]) => void

/** 台灣周邊模擬船隻。 */
const SIM_FLEET: Vessel[] = [
  { mmsi: '416001001', name: 'HAI HUNG', lat: 24.9, lng: 121.9, cog: 210, sog: 11, type: '貨船' },
  { mmsi: '416002002', name: 'FU YUAN 66', lat: 24.2, lng: 121.6, cog: 340, sog: 6, type: '漁船' },
  { mmsi: '477553000', name: 'COSCO STAR', lat: 25.3, lng: 122.4, cog: 260, sog: 15, type: '貨櫃輪' },
  { mmsi: '416003003', name: 'SHENG LI', lat: 23.8, lng: 121.3, cog: 30, sog: 9, type: '油輪' },
  { mmsi: '416004004', name: '(無船名)', lat: 24.6, lng: 122.2, cog: 150, sog: 4, type: '不明' },
  { mmsi: '416005005', name: 'DA CHANG', lat: 25.0, lng: 121.4, cog: 300, sog: 12, type: '漁船' },
]

const DEG = Math.PI / 180

/** 訂閱 AIS。回傳取消訂閱函式。 */
export function subscribeAIS(onUpdate: Listener): () => void {
  const key = getConfig().aisKey
  if (key) return subscribeReal(onUpdate, key)
  return subscribeSim(onUpdate)
}

/** 模擬：每 2 秒依航向/航速推進船位。 */
function subscribeSim(onUpdate: Listener): () => void {
  const fleet: Vessel[] = SIM_FLEET.map((v) => ({ ...v }))
  const step = () => {
    for (const v of fleet) {
      // 1 節 ≈ 0.5144 m/s；2 秒位移；換算成經緯度
      const dist = v.sog * 0.5144 * 2
      const dNorth = dist * Math.cos(v.cog * DEG)
      const dEast = dist * Math.sin(v.cog * DEG)
      v.lat += (dNorth / 6371000) / DEG
      v.lng += (dEast / (6371000 * Math.cos(v.lat * DEG))) / DEG
      // 偶爾微調航向，看起來自然些（用 mmsi 尾數當偽隨機，避免用 Math.random）
      v.cog = (v.cog + ((Number(v.mmsi) % 7) - 3) * 0.5 + 360) % 360
    }
    onUpdate(fleet.map((v) => ({ ...v })))
  }
  step()
  const timer = setInterval(step, 2000)
  return () => clearInterval(timer)
}

/** 真實：連 aisstream.io WebSocket。 */
function subscribeReal(onUpdate: Listener, key: string): () => void {
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
  const byMmsi = new Map<string, Vessel>()

  ws.onopen = () => {
    // 訂閱台灣周邊 bounding box（可自行調整）。
    ws.send(
      JSON.stringify({
        APIKey: key,
        BoundingBoxes: [[[21.5, 119.0], [26.0, 123.5]]],
        FilterMessageTypes: ['PositionReport'],
      }),
    )
  }
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string)
      const meta = msg?.MetaData
      const pr = msg?.Message?.PositionReport
      if (!meta || !pr) return
      const mmsi = String(meta.MMSI)
      byMmsi.set(mmsi, {
        mmsi,
        name: (meta.ShipName || '(無船名)').trim(),
        lat: pr.Latitude,
        lng: pr.Longitude,
        cog: pr.Cog ?? 0,
        sog: pr.Sog ?? 0,
        type: '—',
      })
      onUpdate([...byMmsi.values()])
    } catch {
      /* 忽略單筆解析錯誤 */
    }
  }
  ws.onerror = () => {
    /* 交給 onclose 收尾 */
  }
  return () => {
    try {
      ws.close()
    } catch {
      /* noop */
    }
  }
}
