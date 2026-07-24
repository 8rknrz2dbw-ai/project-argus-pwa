import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { WIND_FARMS, MEDIAN_LINE, PORTS } from '../lib/maritimeRef'

/**
 * 海上風電場圖層（跨模式）：由圖層視窗打勾開啟。畫各風場示意範圍圈＋風機標記，
 * 提醒作業區/限制航行/避碰熱點。
 */
export function WindFarmLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showWindFarms)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!show) return
    const g = L.layerGroup().addTo(map)
    groupRef.current = g
    for (const wf of WIND_FARMS) {
      const built = wf.status === '營運'
      const color = built ? '#38bdf8' : '#a78bfa'
      L.circle([wf.lat, wf.lng], {
        radius: wf.radiusKm * 1000,
        color,
        weight: 1.5,
        opacity: 0.7,
        dashArray: '5 4',
        fillColor: color,
        fillOpacity: 0.1,
      }).addTo(g)
      L.marker([wf.lat, wf.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="wf-marker" style="border-color:${color}">🌀<div class="wf-label" style="color:${color}">${wf.name}</div></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      })
        .bindPopup(
          `<b style="color:${color}">🌀 ${wf.name}</b><br/>離岸風電場（${wf.status}）<br/>` +
            `示意半徑約 ${wf.radiusKm} km<br/><span style="color:#94a3b8;font-size:11px">作業區/限制航行，注意避碰；範圍以官方公告為準</span>`,
        )
        .addTo(g)
    }
    return () => {
      g.clearLayers()
      map.removeLayer(g)
      groupRef.current = null
    }
  }, [show, map])

  return null
}

/**
 * 主要漁港／避風港圖層：救難後送、就近調度、颱風避風用。
 */
export function PortLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showPorts)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!show) return
    const g = L.layerGroup().addTo(map)
    groupRef.current = g
    for (const port of PORTS) {
      L.marker([port.lat, port.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="port-marker">⚓<div class="port-label">${port.name}</div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .bindPopup(
          `<b style="color:#34d399">⚓ ${port.name}</b><br/>漁港／避風港<br/>` +
            `<span style="font-family:ui-monospace,monospace">${port.lat.toFixed(4)}, ${port.lng.toFixed(4)}</span>`,
        )
        .addTo(g)
    }
    return () => {
      g.clearLayers()
      map.removeLayer(g)
      groupRef.current = null
    }
  }, [show, map])

  return null
}

/**
 * 即時降雨雷達圖層（RainViewer，免金鑰）：全球雷達回波圖磚，出海避雷雨用。
 * 先抓最新影格路徑，再組圖磚 URL。
 */
export function RainRadarLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showRainRadar)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const layerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (!show) return
    let cancelled = false
    const remove = () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
    setStatus('即時降雨雷達：載入中…')
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => r.json())
      .then((data: { host: string; radar?: { past?: { path: string }[]; nowcast?: { path: string }[] } }) => {
        if (cancelled) return
        const frames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])]
        const last = frames[frames.length - 1]
        if (!last) {
          setStatus('即時降雨雷達：目前無資料')
          return
        }
        const url = `${data.host}${last.path}/256/{z}/{x}/{y}/4/1_1.png`
        const tl = L.tileLayer(url, { opacity: 0.6, maxZoom: 19, attribution: '降雨雷達 © RainViewer' })
        tl.addTo(map)
        layerRef.current = tl
        setStatus('即時降雨雷達（RainViewer）：藍→綠→黃→紅 雨勢增強')
      })
      .catch(() => {
        if (!cancelled) setStatus('⚠ 降雨雷達載入失敗')
      })
    return () => {
      cancelled = true
      remove()
    }
  }, [show, map, setStatus])

  return null
}

/**
 * 台灣海峽中線（示意）圖層：橫貫海峽的參考線，供越界態勢監控。
 */
export function MedianLineLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showMedianLine)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!show) return
    const g = L.layerGroup().addTo(map)
    groupRef.current = g
    L.polyline(MEDIAN_LINE, { color: '#f43f5e', weight: 2, dashArray: '10 6', opacity: 0.8 })
      .bindPopup('台灣海峽中線（示意，非官方劃界）：越界態勢監控參考')
      .addTo(g)
    const mid = MEDIAN_LINE[Math.floor(MEDIAN_LINE.length / 2)]
    L.marker(mid, {
      icon: L.divIcon({
        className: '',
        html: `<div class="median-label">台海中線（示意）</div>`,
        iconSize: [92, 16],
        iconAnchor: [46, 8],
      }),
    }).addTo(g)
    return () => {
      g.clearLayers()
      map.removeLayer(g)
      groupRef.current = null
    }
  }, [show, map])

  return null
}
