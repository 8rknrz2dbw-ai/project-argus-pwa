import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { demoTyphoon, currentPoint, type Typhoon } from '../lib/typhoon'
import { isCwaConfigured } from '../lib/config'
import { fetchCwaTyphoon } from '../lib/cwa'
import { fetchGdacsTyphoon } from '../lib/gdacs'

/**
 * 颱風路徑圖層：現在位置（旋轉符號）+ 暴風圈 + 預報路徑 + 潛勢範圍錐 + 時間點。
 * 有設定 CWA 授權碼＋Worker → 抓中央氣象署『颱風路徑潛勢預報』真實資料；
 * 否則用示範颱風。無颱風期間 CWA 會回空 → 亦退回示範以展示能力。
 */
export function TyphoonLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const setActiveTyphoon = useTacticalStore((s) => s.setActiveTyphoon)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (mode !== 'typhoon') return
    const group = L.layerGroup().addTo(map)
    groupRef.current = group
    let cancelled = false

    const render = (ty: Typhoon, source: 'cwa' | 'gdacs' | 'demo') => {
      if (cancelled || !groupRef.current) return
      group.clearLayers()
      setActiveTyphoon(ty)
      draw(group, ty)
      const cur = currentPoint(ty)
      // 有 GPS 定位 → 畫「您的位置 ↔ 颱風中心」相對線 + 距離，看相對關係。
      const own = useTacticalStore.getState().ownPosition
      if (own) drawRelative(group, own.lat, own.lng, cur.lat, cur.lng)
      map.setView([cur.lat + 1.5, cur.lng - 1.5], 6)
      setStatus(
        source === 'demo'
          ? '颱風路徑（示範）：目前查無活躍颱風資料'
          : source === 'cwa'
            ? `颱風路徑（中央氣象署 CWA 官方）：${ty.name}`
            : `颱風路徑（GDACS 即時）：${ty.name}｜官方命名/警報請設定 CWA`,
      )
    }

    // 不先畫示範（避免「示範→即時」閃跳）。查詢中先顯示載入訊息，
    // 有真實資料才畫；CWA(官方) 優先 → GDACS(即時) → 都沒有才退示範。
    setActiveTyphoon(null)
    setStatus('颱風路徑：查詢即時颱風資料中…')
    const load = async () => {
      if (isCwaConfigured()) {
        const cwa = await fetchCwaTyphoon(Date.now()).catch(() => null)
        if (cwa && !cancelled) return render(cwa, 'cwa')
      }
      const gd = await fetchGdacsTyphoon().catch(() => null)
      if (gd && !cancelled) return render(gd, 'gdacs')
      if (!cancelled) render(demoTyphoon(), 'demo')
    }
    load()

    return () => {
      cancelled = true
      setActiveTyphoon(null)
      group.clearLayers()
      map.removeLayer(group)
      groupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return null
}

const DEG = Math.PI / 180
const R = 6371000

/** 畫「您的位置 ↔ 颱風中心」的相對線與距離標籤。 */
function drawRelative(group: L.LayerGroup, ownLat: number, ownLng: number, tyLat: number, tyLng: number) {
  const a =
    Math.sin(((tyLat - ownLat) * DEG) / 2) ** 2 +
    Math.cos(ownLat * DEG) * Math.cos(tyLat * DEG) * Math.sin(((tyLng - ownLng) * DEG) / 2) ** 2
  const km = ((2 * R * Math.asin(Math.sqrt(a))) / 1000).toFixed(0)
  L.polyline(
    [
      [ownLat, ownLng],
      [tyLat, tyLng],
    ],
    { color: '#38bdf8', weight: 1.5, dashArray: '3 5', opacity: 0.7 },
  ).addTo(group)
  const mid: [number, number] = [(ownLat + tyLat) / 2, (ownLng + tyLng) / 2]
  L.marker(mid, {
    icon: L.divIcon({
      className: '',
      html: `<div class="rel-label">距您 ${km} km</div>`,
      iconSize: [80, 16],
      iconAnchor: [40, 8],
    }),
  }).addTo(group)
}

function dest(lat: number, lng: number, bearingDeg: number, distM: number) {
  const b = bearingDeg * DEG
  return {
    lat: lat + ((distM * Math.cos(b)) / R) / DEG,
    lng: lng + ((distM * Math.sin(b)) / (R * Math.cos(lat * DEG))) / DEG,
  }
}

function draw(group: L.LayerGroup, ty: Typhoon) {
  const future = ty.track.filter((p) => p.hours >= 0)
  const cur = currentPoint(ty)

  // 潛勢範圍錐（越遠越寬）：沿預報點左右各偏一個隨時間增大的半徑，連成多邊形
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < future.length; i++) {
    const p = future[i]
    const next = future[Math.min(i + 1, future.length - 1)]
    const brg = (Math.atan2((next.lng - p.lng), (next.lat - p.lat)) / DEG + 360) % 360
    const spread = (60 + p.hours * 3) * 1000 // m，隨時間擴大
    const l = dest(p.lat, p.lng, brg - 90, spread)
    const r = dest(p.lat, p.lng, brg + 90, spread)
    left.push([l.lat, l.lng])
    right.push([r.lat, r.lng])
  }
  const cone = [...left, ...right.reverse()]
  if (cone.length > 2) {
    L.polygon(cone, { color: '#f59e0b', weight: 1, opacity: 0.5, fillColor: '#f59e0b', fillOpacity: 0.08 }).addTo(
      group,
    )
  }

  // 預報路徑線
  L.polyline(
    ty.track.map((p) => [p.lat, p.lng] as [number, number]),
    { color: '#f43f5e', weight: 2, dashArray: '6 4', opacity: 0.9 },
  ).addTo(group)

  // 各時間點
  for (const p of ty.track) {
    const isNow = p === cur
    L.circleMarker([p.lat, p.lng], {
      radius: isNow ? 5 : 3,
      color: p.hours < 0 ? '#94a3b8' : '#f43f5e',
      fillColor: p.hours < 0 ? '#94a3b8' : '#f43f5e',
      fillOpacity: 1,
      weight: 1,
    })
      .bindPopup(
        `<b style="color:#f43f5e">${p.hours === 0 ? '現在' : p.hours < 0 ? `${-p.hours}h 前` : `+${p.hours}h`}</b><br/>` +
          `${p.cat}｜近中心風 ${p.windKt} kt<br/>暴風半徑 ${p.galeRadiusKm} km`,
      )
      .addTo(group)
    if (p.hours > 0) {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: `<div class="ty-time">+${p.hours}h</div>`, iconSize: [34, 16], iconAnchor: [17, -6] }),
      }).addTo(group)
    }
  }

  // 暴風圈（現在位置）
  L.circle([cur.lat, cur.lng], {
    radius: cur.galeRadiusKm * 1000,
    color: '#f43f5e',
    weight: 2,
    fillColor: '#f43f5e',
    fillOpacity: 0.1,
  }).addTo(group)

  // 颱風符號
  L.marker([cur.lat, cur.lng], {
    icon: L.divIcon({ className: '', html: `<div class="ty-eye">🌀</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
    zIndexOffset: 1300,
  })
    .bindPopup(
      `<b style="color:#f43f5e">${ty.name}${ty.demo ? '（示範）' : ''}</b><br/>${cur.cat}｜近中心風 ${cur.windKt} kt<br/>暴風半徑 ${cur.galeRadiusKm} km`,
    )
    .addTo(group)
}
