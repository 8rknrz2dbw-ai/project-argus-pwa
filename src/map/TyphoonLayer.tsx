import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { demoTyphoon, currentPoint, type Typhoon } from '../lib/typhoon'

/**
 * 颱風路徑圖層：現在位置（旋轉符號）+ 暴風圈 + 預報路徑 + 潛勢範圍錐 + 時間點。
 * 目前為示範颱風（無免金鑰即時來源）；真實 feed 可經 Worker 代理後餵入。
 */
export function TyphoonLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (mode !== 'typhoon') return
    const group = L.layerGroup().addTo(map)
    groupRef.current = group
    const ty = demoTyphoon()
    draw(group, ty)
    // 移動地圖到颱風附近
    const cur = currentPoint(ty)
    map.setView([cur.lat + 1.5, cur.lng - 1.5], 6)
    setStatus('颱風路徑（示範）：紅=暴風圈、虛線=預報路徑、錐形=潛勢範圍')

    return () => {
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
