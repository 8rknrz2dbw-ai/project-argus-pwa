import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LayerControl } from './LayerControl'
import { BBoxSelector } from './BBoxSelector'
import { AisLayer } from './AisLayer'
import { RescueLayer } from './RescueLayer'
import { LocateControl } from './LocateControl'
import { OfflineControl } from './OfflineControl'

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

    // Base Layer：CARTO dark_matter 真・深色底圖（軍事雷達幕質感）。
    // 直接用專業深色圖磚，不再用 CSS invert 濾鏡（會把 OSM 洗成灰白）。
    // 固定 subdomain 'a' 且非 retina，讓離線下載的 URL 與顯示用完全一致（才會命中快取）。
    L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      maxZoom: 19,
      detectRetina: false,
      className: 'base-tiles-tactical',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(m)

    // 手機以雙指縮放為主，移除佔版面的縮放按鈕；保留比例尺。
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
      <div className="radar-vignette" />
      {map && <LayerControl map={map} />}
      {map && <BBoxSelector map={map} />}
      {map && <AisLayer map={map} />}
      {map && <RescueLayer map={map} />}
      {map && <LocateControl map={map} />}
      {map && <OfflineControl map={map} />}
    </div>
  )
}
