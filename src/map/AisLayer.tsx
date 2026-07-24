import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { subscribeAIS, isAisConfigured, type Vessel } from '../lib/ais'
import { analyzeVessel } from '../lib/aisAnomaly'
import { buildGibsBoatLights } from '../lib/gibs'
import { buildWmsConfig, LAYERS, isSentinelConfigured } from '../lib/sentinel'

// AIS 訂閱與顯示的台灣周邊範圍
const TW_BOUNDS: L.LatLngBoundsExpression = [
  [21.5, 119.0],
  [26.0, 123.5],
]

/** 前一天日期（YYYY-MM-DD）——夜間漁火/雷達影像用最近可用日最保險。 */
function yesterdayYmd(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10)
}

/**
 * AIS 船舶圖層。只在 ais 模式運行：訂閱 AIS → 畫出船隻（三角形依航向旋轉）
 * → 點擊看船名/MMSI/航速/船種。離開模式時取消訂閱（關 WebSocket / 清 timer）。
 */
export function AisLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setVessels = useTacticalStore((s) => s.setVessels)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const showBoatLights = useTacticalStore((s) => s.showBoatLights)
  const showRadarVessels = useTacticalStore((s) => s.showRadarVessels)
  const groupRef = useRef<L.LayerGroup | null>(null)
  const lightsRef = useRef<L.TileLayer | null>(null)
  const radarRef = useRef<L.TileLayer | null>(null)

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
      // 注意：不清空 store 的 vessels——保留最後已知 AIS，供光學亮點掃描做
      //「無AIS=可疑暗船」比對（見 BrightSpotLayer / store setMode 的說明）。
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── 🌙 VIIRS 夜間漁火 疊層（免金鑰）──────────────────
  useEffect(() => {
    const remove = () => {
      if (lightsRef.current) {
        map.removeLayer(lightsRef.current)
        // @ts-expect-error 清 Leaflet 內部圖磚快取，釋放記憶體
        lightsRef.current._tiles = {}
        lightsRef.current = null
      }
    }
    if (mode === 'ais' && showBoatLights) {
      const layer = buildGibsBoatLights(yesterdayYmd())
      layer.addTo(map)
      lightsRef.current = layer
      setStatus('🌙 已疊夜間漁火（VIIRS）：外海亮點＝開燈作業漁船；夜間才有、白天無效')
    } else {
      remove()
    }
    return remove
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showBoatLights])

  // ── 📡 Sentinel-1 雷達暗船 疊層（需金鑰）─────────────
  useEffect(() => {
    const remove = () => {
      if (radarRef.current) {
        map.removeLayer(radarRef.current)
        // @ts-expect-error 清 Leaflet 內部圖磚快取，釋放記憶體
        radarRef.current._tiles = {}
        radarRef.current = null
      }
    }
    if (mode === 'ais' && showRadarVessels && isSentinelConfigured()) {
      const { url, params } = buildWmsConfig({ layer: LAYERS.sarVV, date: yesterdayYmd() })
      const wms = L.tileLayer.wms(url, {
        ...params,
        opacity: 0.75,
        errorTileUrl:
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      } as L.WMSOptions)
      wms.addTo(map)
      radarRef.current = wms
      setStatus('📡 已疊 Sentinel-1 雷達：亮點＝金屬船身。雷達有亮點但無 AIS 三角形＝可疑暗船')
    } else {
      remove()
    }
    return remove
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showRadarVessels])

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
