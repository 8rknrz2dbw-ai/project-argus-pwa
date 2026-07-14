import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { SatelliteCanvasLayer } from './SatelliteCanvasLayer'
import { buildWmsConfig, LAYERS, isSentinelConfigured } from '../lib/sentinel'
import type { DetectionCollection } from '../types'

/**
 * LayerControl —— 監聽三個「戰術模式狀態」，動態 add/remove 圖層。
 *
 * 圖層堆疊（Z 由低到高）：
 *   1. Base（OSM）      — 由 MapContainer 常駐
 *   2. Tile（WMS 影像） — 本檔管理，SAR / Optical 模式才掛
 *   3. Vector（AI 分析）— 本檔管理，SAR 模式的偵測框
 *   4. Canvas（動態）   — 本檔管理，Orbit 模式的即時衛星
 *
 * 互斥原則：切模式時，先把「不屬於新模式」的重度圖層卸載並清快取，
 * 再掛上新模式需要的圖層。任何時刻只有一種重度資源在跑。
 */
export function LayerControl({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const maxCloudCover = useTacticalStore((s) => s.maxCloudCover)
  const observationDate = useTacticalStore((s) => s.observationDate)
  const detections = useTacticalStore((s) => s.detections)
  const setStatus = useTacticalStore((s) => s.setStatus)

  // 各圖層的參照（用 ref 才能在 cleanup 時精準卸載）
  const tileRef = useRef<L.TileLayer.WMS | null>(null)
  const vectorRef = useRef<L.GeoJSON | null>(null)
  const canvasRef = useRef<SatelliteCanvasLayer | null>(null)

  // 徹底卸載 WMS 影像層 + 清快取（防 Leaflet memory leak）
  const removeTile = () => {
    if (tileRef.current) {
      map.removeLayer(tileRef.current)
      // Leaflet 內部 _tiles 快取在 removeLayer 後仍可能殘留，強制清空
      // @ts-expect-error 存取內部快取以釋放 <img> 記憶體
      tileRef.current._tiles = {}
      tileRef.current = null
    }
  }
  const removeVector = () => {
    if (vectorRef.current) {
      map.removeLayer(vectorRef.current)
      vectorRef.current.clearLayers()
      vectorRef.current = null
    }
  }
  const removeCanvas = () => {
    if (canvasRef.current) {
      map.removeLayer(canvasRef.current) // 觸發 onRemove → cancelAnimationFrame + worker.terminate
      canvasRef.current = null
    }
  }

  // ── 主效果：模式 / 參數改變時重建圖層 ──────────────────
  useEffect(() => {
    // 每次都先全部卸載，確保乾淨、互斥
    removeTile()
    removeVector()
    removeCanvas()

    if (mode === 'orbit') {
      // 只掛 Canvas 動態層
      canvasRef.current = new SatelliteCanvasLayer()
      canvasRef.current.addTo(map)
    } else if (mode === 'sar') {
      // Sentinel-1 SAR 影像層（Canvas 已卸載，釋放 RAM）
      mountWms(LAYERS.sarVV, undefined)
    } else if (mode === 'optical') {
      // Sentinel-2 光學 + MAXCC 雲量過濾
      mountWms(LAYERS.opticalTrueColor, maxCloudCover)
    }

    function mountWms(layer: string, maxcc: number | undefined) {
      if (!isSentinelConfigured()) {
        setStatus('⚠ 未設定 Sentinel Hub 金鑰，影像層停用（見 .env.example）')
        return
      }
      const { url, params } = buildWmsConfig({ layer, date: observationDate, maxCloudCover: maxcc })
      const wms = L.tileLayer.wms(url, {
        ...params,
        // 圖磚載入失敗（該區/時間無資料）時的 fallback，避免破圖灰塊
        errorTileUrl: transparentPixel,
      } as L.WMSOptions)

      let errorCount = 0
      wms.on('tileerror', () => {
        errorCount++
        if (errorCount === 1) setStatus('⚠ 此區域/時間無可用影像，請調整日期或範圍')
      })
      wms.on('load', () => {
        if (errorCount === 0) setStatus(mode === 'sar' ? '雷達影像載入完成' : '光學影像載入完成')
      })
      wms.addTo(map)
      tileRef.current = wms
    }

    return () => {
      // 卸載元件時（例如熱重載）也要清乾淨
      removeTile()
      removeVector()
      removeCanvas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, maxCloudCover, observationDate])

  // ── Vector 層：AI 偵測結果單獨更新（不重建影像層）──────
  useEffect(() => {
    removeVector()
    if (mode === 'sar' && detections && detections.features.length > 0) {
      vectorRef.current = buildDetectionLayer(detections).addTo(map)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detections, mode])

  return null // 純副作用元件，無 DOM 輸出
}

/** 1x1 透明 PNG，當作圖磚載入失敗的替代，避免灰色破圖方塊。 */
const transparentPixel =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** 把 AI 偵測 GeoJSON 畫成紅色警示框（疑似無名船隻）。 */
function buildDetectionLayer(fc: DetectionCollection): L.GeoJSON {
  return L.geoJSON(fc as unknown as GeoJSON.GeoJsonObject, {
    pointToLayer: (feature, latlng) => {
      const suspicious = (feature.properties as { suspicious?: boolean })?.suspicious
      const color = suspicious ? '#f43f5e' : '#22d3ee'
      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: `<div class="detection-box" style="border-color:${color};box-shadow:0 0 8px ${color}"></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
      const p = feature.properties as { label: string; confidence: number }
      marker.bindPopup(
        `<div style="font-family:ui-monospace,monospace">
           <b style="color:${color}">${p.label}</b><br/>
           信心度 ${(p.confidence * 100).toFixed(0)}%<br/>
           ${suspicious ? '⚠ 疑似無名船隻' : '一般目標'}
         </div>`,
      )
      return marker
    },
  })
}
