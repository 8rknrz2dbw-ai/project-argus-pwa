import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'

/**
 * 畫面資訊條：即時顯示「畫面中心座標」，以及（光學模式）目前影像的時間注記，
 * 讓回放歷史影像時清楚知道「這張是哪時候的」。位於狀態列下方左側。
 */
export function MapInfoBar({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const opticalSource = useTacticalStore((s) => s.opticalSource)
  const observationDate = useTacticalStore((s) => s.observationDate)
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number }>(() => {
    const c = map.getCenter()
    return { lat: c.lat, lng: c.lng, zoom: map.getZoom() }
  })

  useEffect(() => {
    const update = () => {
      const c = map.getCenter()
      setCenter({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
    }
    map.on('move zoom', update)
    return () => {
      map.off('move zoom', update)
    }
  }, [map])

  const coord = `${fmt(center.lat)}${center.lat >= 0 ? 'N' : 'S'} ${fmt(center.lng)}${center.lng >= 0 ? 'E' : 'W'}`

  let imgTime: string | null = null
  if (mode === 'optical') {
    if (opticalSource === 'nasa') imgTime = `📅 影像 ${observationDate}（MODIS 當日）`
    else if (opticalSource === 'eox') imgTime = '📅 Sentinel-2 無雲 2023 年合成'
    else imgTime = '📅 高解析空拍鑲嵌（非單一時間）'
  }

  return (
    <div className="map-info-pos pointer-events-none absolute left-3 z-[1000] flex flex-col gap-0.5">
      <span className="w-fit rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-tactical-cyan">
        ◎ {coord} · z{Math.round(center.zoom)}
      </span>
      {imgTime && (
        <span className="w-fit rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] text-amber-300">
          {imgTime}
        </span>
      )}
    </div>
  )
}

function fmt(v: number): string {
  return Math.abs(v).toFixed(4)
}
