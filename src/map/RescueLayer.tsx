import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { fetchEnvAt, fetchEnvGrid, type MarineEnv } from '../lib/marineEnv'
import { predictDrift, bearingToText } from '../lib/drift'

/**
 * 搜救推演圖層。只在 rescue 模式運行：
 *  1. 進模式 / 平移地圖 → 抓當前視野的風場 + 洋流網格 → 畫箭頭
 *  2. 點地圖 → 標記落海點 → 抓該點海象 → 算漂流 → 畫預測點與搜索圈
 *
 * 洋流箭頭（綠）＝水流去向；風箭頭（青、虛線）＝風吹去向。
 */
export function RescueLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setManOverboard = useTacticalStore((s) => s.setManOverboard)
  const setRescueResult = useTacticalStore((s) => s.setRescueResult)
  const setRescueStatus = useTacticalStore((s) => s.setRescueStatus)
  const setStatus = useTacticalStore((s) => s.setStatus)

  const fieldRef = useRef<L.LayerGroup | null>(null) // 風/流箭頭
  const driftRef = useRef<L.LayerGroup | null>(null) // 落海點 + 漂流
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'rescue') return

    const field = L.layerGroup().addTo(map)
    const drift = L.layerGroup().addTo(map)
    fieldRef.current = field
    driftRef.current = drift

    const refreshField = async () => {
      const pts = sampleGrid(map.getBounds(), 5, 4)
      const envs = await fetchEnvGrid(pts)
      if (!fieldRef.current) return // 期間已卸載
      field.clearLayers()
      for (const e of envs) drawEnvArrows(field, e)
      if (envs[0] && !envs[0].live) setStatus('搜救推演：海象資料源離線，使用預設值')
    }

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(refreshField, 700)
    }

    const onClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      setManOverboard({ lat, lng })
      setRescueStatus('loading')
      setStatus('已標記落海點，計算漂流中…')
      drift.clearLayers()
      drawManOverboard(drift, lat, lng)

      const env = await fetchEnvAt(lat, lng)
      const points = predictDrift({
        lat,
        lng,
        wind: { speed: env.windSpeed, dirDeg: env.windDir },
        current: { speed: env.currentSpeed, dirDeg: env.currentDir },
        hoursList: [1, 3, 6],
      })
      if (!driftRef.current) return
      drawDrift(drift, lat, lng, points)
      setRescueResult(env, points)
      setRescueStatus('done')
      const last = points[points.length - 1]
      setStatus(
        `漂流預判：6h 後約在 ${bearingToText(last.bearingDeg)}方 ${(last.driftMeters / 1852).toFixed(1)} 浬，搜索半徑 ${(last.radiusMeters / 1852).toFixed(1)} 浬`,
      )
    }

    map.on('moveend', onMoveEnd)
    map.on('click', onClick)
    refreshField()

    return () => {
      map.off('moveend', onMoveEnd)
      map.off('click', onClick)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      field.clearLayers()
      drift.clearLayers()
      map.removeLayer(field)
      map.removeLayer(drift)
      fieldRef.current = null
      driftRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return null
}

// ── 幾何工具 ────────────────────────────────────────────────
const DEG = Math.PI / 180
const R = 6371000

function dest(lat: number, lng: number, bearingDeg: number, distM: number) {
  const b = bearingDeg * DEG
  const dN = distM * Math.cos(b)
  const dE = distM * Math.sin(b)
  return {
    lat: lat + (dN / R) / DEG,
    lng: lng + (dE / (R * Math.cos(lat * DEG))) / DEG,
  }
}

/** 在 bounds 內取 cols×rows 網格點（邊緣內縮）。 */
function sampleGrid(bounds: L.LatLngBounds, cols: number, rows: number): [number, number][] {
  const s = bounds.getSouth()
  const n = bounds.getNorth()
  const w = bounds.getWest()
  const e = bounds.getEast()
  const pts: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = s + ((n - s) * (r + 0.5)) / rows
      const lng = w + ((e - w) * (c + 0.5)) / cols
      pts.push([lat, lng])
    }
  }
  return pts
}

/** 畫一支帶箭頭的向量（方向為 toward）。 */
function drawArrow(
  group: L.LayerGroup,
  lat: number,
  lng: number,
  bearingToward: number,
  lengthM: number,
  color: string,
  dashed = false,
) {
  const tip = dest(lat, lng, bearingToward, lengthM)
  const style: L.PolylineOptions = {
    color,
    weight: 2,
    opacity: 0.85,
    ...(dashed ? { dashArray: '4 3' } : {}),
  }
  L.polyline([[lat, lng], [tip.lat, tip.lng]], style).addTo(group)
  // 箭頭兩翼
  const wingLen = lengthM * 0.32
  const left = dest(tip.lat, tip.lng, bearingToward + 150, wingLen)
  const right = dest(tip.lat, tip.lng, bearingToward - 150, wingLen)
  L.polyline([[tip.lat, tip.lng], [left.lat, left.lng]], style).addTo(group)
  L.polyline([[tip.lat, tip.lng], [right.lat, right.lng]], style).addTo(group)
}

/** 一個網格點畫「洋流（綠）＋風（青虛線）」兩支箭頭。 */
function drawEnvArrows(group: L.LayerGroup, e: MarineEnv) {
  // 洋流：流向 = toward，長度隨流速
  drawArrow(group, e.lat, e.lng, e.currentDir, 6000 + e.currentSpeed * 12000, '#34d399', false)
  // 風：來向 + 180 = 去向，長度隨風速
  const windToward = (e.windDir + 180) % 360
  drawArrow(group, e.lat, e.lng, windToward, 4000 + e.windSpeed * 900, '#22d3ee', true)
}

function drawManOverboard(group: L.LayerGroup, lat: number, lng: number) {
  L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="mob-marker">✚</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    zIndexOffset: 1000,
  })
    .bindPopup('<b style="color:#f43f5e">落海點 (最後已知位置)</b>')
    .addTo(group)
}

function drawDrift(
  group: L.LayerGroup,
  lat0: number,
  lng0: number,
  points: { hours: number; lat: number; lng: number; radiusMeters: number }[],
) {
  // 漂流軌跡線
  const line: [number, number][] = [[lat0, lng0], ...points.map((p) => [p.lat, p.lng] as [number, number])]
  L.polyline(line, { color: '#f43f5e', weight: 2, dashArray: '6 4' }).addTo(group)

  points.forEach((p, i) => {
    const emphasis = i === points.length - 1
    // 搜索圈
    L.circle([p.lat, p.lng], {
      radius: p.radiusMeters,
      color: '#f43f5e',
      weight: emphasis ? 2 : 1,
      opacity: 0.8,
      fillColor: '#f43f5e',
      fillOpacity: emphasis ? 0.12 : 0.06,
    }).addTo(group)
    // 時間標籤
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div class="drift-label">${p.hours}h</div>`,
        iconSize: [30, 18],
        iconAnchor: [15, 9],
      }),
    }).addTo(group)
  })
}
