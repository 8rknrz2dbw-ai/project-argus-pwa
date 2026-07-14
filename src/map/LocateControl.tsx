import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'

/**
 * 「我的位置」GPS 定位。點按鈕取得裝置座標，畫出自身藍點（含精度圈），
 * 並把地圖移到自己身上。位置存進 store，供搜救模式計算與落海點的距離。
 */
export function LocateControl({ map }: { map: L.Map }) {
  const ownPosition = useTacticalStore((s) => s.ownPosition)
  const setOwnPosition = useTacticalStore((s) => s.setOwnPosition)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const [busy, setBusy] = useState(false)
  const markerRef = useRef<L.LayerGroup | null>(null)

  // 依 store 的 ownPosition 畫/更新藍點
  useEffect(() => {
    if (!ownPosition) return
    if (!markerRef.current) markerRef.current = L.layerGroup().addTo(map)
    const g = markerRef.current
    g.clearLayers()
    L.circle([ownPosition.lat, ownPosition.lng], {
      radius: ownPosition.accuracy,
      color: '#38bdf8',
      weight: 1,
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
    }).addTo(g)
    L.marker([ownPosition.lat, ownPosition.lng], {
      icon: L.divIcon({ className: '', html: `<div class="own-pos"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
    })
      .bindPopup('📍 我的位置')
      .addTo(g)
    return () => {
      g.clearLayers()
    }
  }, [ownPosition, map])

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('⚠ 此裝置不支援定位')
      return
    }
    setBusy(true)
    setStatus('定位中…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setOwnPosition({ lat: latitude, lng: longitude, accuracy })
        map.setView([latitude, longitude], Math.max(map.getZoom(), 11))
        setStatus(`已定位：精度約 ${Math.round(accuracy)} m`)
        setBusy(false)
      },
      (err) => {
        setStatus(`⚠ 定位失敗：${err.message}`)
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
  }

  return (
    <button
      onClick={locate}
      className="pointer-events-auto absolute bottom-32 right-3 z-[1100] flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-tactical-panel/90 text-xl active:scale-95 md:bottom-20"
      aria-label="我的位置"
    >
      {busy ? '⏳' : '📍'}
    </button>
  )
}
