import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { subscribeAIS, isAisConfigured, type Vessel } from '../lib/ais'
import { analyzeVessel } from '../lib/aisAnomaly'

// AIS 訂閱與顯示的台灣周邊範圍
const TW_BOUNDS: L.LatLngBoundsExpression = [
  [21.5, 119.0],
  [26.0, 123.5],
]

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
        ? 'AIS：連線 aisstream.io 即時船位（等船回報，約數十秒）'
        : 'AIS：模擬船隻展示中（⚙️ 設定填 AISStream 金鑰可接真實資料）',
    )

    // 進 AIS 若地圖放太大（看不到船），自動縮到台灣周邊範圍。
    if (map.getZoom() > 8) map.fitBounds(TW_BOUNDS)

    const unsub = subscribeAIS(
      (vessels) => {
        setVessels(vessels)
        group.clearLayers()
        for (const v of vessels) drawVessel(group, v)
      },
      (s) => setStatus(s), // 連線狀態回報到狀態列
    )

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
