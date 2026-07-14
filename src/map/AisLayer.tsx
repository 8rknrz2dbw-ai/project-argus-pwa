import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { subscribeAIS, isAisConfigured, type Vessel } from '../lib/ais'
import { analyzeVessel, RESTRICTED_ZONE } from '../lib/aisAnomaly'

/**
 * AIS 船舶圖層。只在 ais 模式運行：訂閱 AIS → 畫出船隻（三角形依航向旋轉）
 * → 點擊看船名/MMSI/航速/船種。離開模式時取消訂閱（關 WebSocket / 清 timer）。
 */
export function AisLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setVessels = useTacticalStore((s) => s.setVessels)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (mode !== 'ais') return

    const group = L.layerGroup().addTo(map)
    groupRef.current = group
    setStatus(
      isAisConfigured()
        ? 'AIS：連線 aisstream.io 即時船位'
        : 'AIS：模擬船隻展示中（設定 VITE_AISSTREAM_KEY 可接真實資料）',
    )

    // 限制水域（禁區）—— 常駐顯示
    drawRestrictedZone(group)

    const unsub = subscribeAIS((vessels) => {
      setVessels(vessels)
      group.clearLayers()
      drawRestrictedZone(group)
      for (const v of vessels) drawVessel(group, v)
    })

    return () => {
      unsub() // 取消訂閱：關 WebSocket / 清 interval
      group.clearLayers()
      map.removeLayer(group)
      groupRef.current = null
      setVessels([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return null
}

/** 畫限制水域方框。 */
function drawRestrictedZone(group: L.LayerGroup) {
  L.rectangle(
    [
      [RESTRICTED_ZONE.south, RESTRICTED_ZONE.west],
      [RESTRICTED_ZONE.north, RESTRICTED_ZONE.east],
    ],
    { color: '#f59e0b', weight: 1, dashArray: '6 4', fillColor: '#f59e0b', fillOpacity: 0.05 },
  )
    .bindPopup(`<b style="color:#f59e0b">${RESTRICTED_ZONE.name}</b><br/>駛入將觸發示警`)
    .addTo(group)
}

function drawVessel(group: L.LayerGroup, v: Vessel) {
  const { alerts, level } = analyzeVessel(v)
  const color = level === 'alert' ? '#f43f5e' : level === 'warn' ? '#f59e0b' : '#22d3ee'
  const pulse = level === 'alert' ? ' ais-alert' : ''
  const marker = L.marker([v.lat, v.lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="ais-vessel${pulse}" style="transform:rotate(${v.cog}deg);color:${color}">▲</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
  })
  const alertHtml = alerts.length
    ? `<br/><span style="color:${color}">⚠ ${alerts.join('、')}</span>`
    : ''
  marker.bindPopup(
    `<div style="font-family:ui-monospace,monospace;line-height:1.5">
       <b style="color:${color}">${v.name}</b><br/>
       MMSI ${v.mmsi}<br/>
       船種：${v.type}<br/>
       航速 ${v.sog.toFixed(1)} kn · 航向 ${Math.round(v.cog)}°
       ${alertHtml}
     </div>`,
  )
  marker.addTo(group)
}
