import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { subscribeAIS, aisConfigured, type Vessel } from '../lib/ais'

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
      aisConfigured
        ? 'AIS：連線 aisstream.io 即時船位'
        : 'AIS：模擬船隻展示中（設定 VITE_AISSTREAM_KEY 可接真實資料）',
    )

    const unsub = subscribeAIS((vessels) => {
      setVessels(vessels)
      group.clearLayers()
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

function drawVessel(group: L.LayerGroup, v: Vessel) {
  const suspicious = v.name === '(無船名)' || v.type === '不明'
  const color = suspicious ? '#f43f5e' : '#22d3ee'
  const marker = L.marker([v.lat, v.lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="ais-vessel" style="transform:rotate(${v.cog}deg);color:${color}">▲</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
  })
  marker.bindPopup(
    `<div style="font-family:ui-monospace,monospace;line-height:1.5">
       <b style="color:${color}">${v.name}</b><br/>
       MMSI ${v.mmsi}<br/>
       船種：${v.type}<br/>
       航速 ${v.sog.toFixed(1)} kn · 航向 ${Math.round(v.cog)}°
       ${suspicious ? '<br/><span style="color:#f43f5e">⚠ 無船名/不明，建議查證</span>' : ''}
     </div>`,
  )
  marker.addTo(group)
}
