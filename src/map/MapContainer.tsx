import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LayerControl } from './LayerControl'
import { BBoxSelector } from './BBoxSelector'

/**
 * MapContainer —— 唯一的地圖實體。
 *
 * 這裡只負責建立 L.map 和 Base Layer（OSM 暗色底圖）。
 * 其餘所有圖層的增減都交給 <LayerControl> 依戰術模式狀態去做，
 * 避免把所有邏輯塞進同一個檔案而互相打架。
 */
export function MapContainer() {
  const elRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)

  useEffect(() => {
    if (!elRef.current) return
    const m = L.map(elRef.current, {
      center: [24.5, 122.0], // 台灣東部海域
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    })

    // Base Layer：OSM 暗色底圖（軍事雷達幕質感）
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      className: 'base-tiles-dark', // CSS filter 壓暗
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)

    L.control.zoom({ position: 'topright' }).addTo(m)
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m)

    setMap(m)
    return () => {
      m.remove() // 卸載時徹底移除地圖，釋放所有資源
      setMap(null)
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={elRef} className="h-full w-full" />
      {map && <LayerControl map={map} />}
      {map && <BBoxSelector map={map} />}
    </div>
  )
}
