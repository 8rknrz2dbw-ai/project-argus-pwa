import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { detectVessels } from '../lib/edgeAI'

/**
 * BBoxSelector —— 讓使用者在地圖上「框選一塊海域」。
 *
 * 流程：點「AI 框選」按鈕 → selecting=true → 在地圖拖拉出矩形
 *   → 放開 → 把 bbox 丟給邊緣 AI → 回傳 GeoJSON 存進 store。
 *
 * 框選時暫時停用地圖拖曳，避免「拉地圖」和「拉框」打架。
 */
export function BBoxSelector({ map }: { map: L.Map }) {
  const selecting = useTacticalStore((s) => s.selecting)
  const setSelecting = useTacticalStore((s) => s.setSelecting)
  const setSelectedBBox = useTacticalStore((s) => s.setSelectedBBox)
  const setDetections = useTacticalStore((s) => s.setDetections)
  const setAiStatus = useTacticalStore((s) => s.setAiStatus)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const observationDate = useTacticalStore((s) => s.observationDate)

  const startRef = useRef<L.LatLng | null>(null)
  const rectRef = useRef<L.Rectangle | null>(null)

  useEffect(() => {
    if (!selecting) {
      // 離開框選模式：恢復地圖拖曳、清掉暫存矩形
      map.dragging.enable()
      map.getContainer().style.cursor = ''
      return
    }

    map.dragging.disable()
    map.getContainer().style.cursor = 'crosshair'

    const onDown = (e: L.LeafletMouseEvent) => {
      startRef.current = e.latlng
      if (rectRef.current) {
        map.removeLayer(rectRef.current)
        rectRef.current = null
      }
    }

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!startRef.current) return
      const bounds = L.latLngBounds(startRef.current, e.latlng)
      if (rectRef.current) {
        rectRef.current.setBounds(bounds)
      } else {
        rectRef.current = L.rectangle(bounds, {
          color: '#22d3ee',
          weight: 1.5,
          fillColor: '#22d3ee',
          fillOpacity: 0.1,
          dashArray: '4',
        }).addTo(map)
      }
    }

    const onUp = async () => {
      if (!startRef.current || !rectRef.current) return
      const b = rectRef.current.getBounds()
      startRef.current = null
      const bbox = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      }
      setSelectedBBox(bbox)
      setSelecting(false) // 框完自動退出框選模式

      // ── 呼叫邊緣 AI ──
      setAiStatus('loading')
      setStatus('已送出海域座標，等待邊緣 AI 辨識…')
      try {
        const fc = await detectVessels(bbox, observationDate)
        setDetections(fc)
        setAiStatus('done')
        const susp = fc.features.filter((f) => f.properties.suspicious).length
        setStatus(`AI 辨識完成：${fc.features.length} 個目標，其中 ${susp} 個疑似無名船隻`)
      } catch (err) {
        setAiStatus('error', err instanceof Error ? err.message : String(err))
        setStatus('⚠ 邊緣 AI 連線失敗，請確認網路或稍後再試')
      }
    }

    map.on('mousedown', onDown)
    map.on('mousemove', onMove)
    map.on('mouseup', onUp)

    return () => {
      map.off('mousedown', onDown)
      map.off('mousemove', onMove)
      map.off('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecting])

  return null
}
