import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { WIND_FARMS, MEDIAN_LINE, PORTS, RESTRICTED_ZONES, ENFORCEMENT_LINES } from '../lib/maritimeRef'

/**
 * 海上風電場圖層（跨模式）：由圖層視窗打勾開啟。畫各風場示意範圍圈＋風機標記，
 * 提醒作業區/限制航行/避碰熱點。
 */
/** 三葉片風機 SVG（正確的風力發電圖示，非漩渦；避免與颱風符號混淆）。 */
function turbineSvg(color: string, size = 22): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" ` +
    `stroke-width="1.7" stroke-linecap="round">` +
    `<line x1="12" y1="12" x2="12" y2="23"/>` + // 塔身
    `<line x1="12" y1="12" x2="12" y2="3"/>` + // 葉片（上）
    `<line x1="12" y1="12" x2="20.5" y2="16.5"/>` + // 葉片（右下）
    `<line x1="12" y1="12" x2="3.5" y2="16.5"/>` + // 葉片（左下）
    `<circle cx="12" cy="12" r="1.6" fill="${color}" stroke="none"/>` + // 輪轂
    `</svg>`
  )
}

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
      // 方形風場區塊（caution area）——比圓圈更貼近實際離岸風場劃設外觀
      const dLat = wf.radiusKm / 111
      const dLng = wf.radiusKm / (111 * Math.cos((wf.lat * Math.PI) / 180))
      const bounds: L.LatLngBoundsExpression = [
        [wf.lat - dLat, wf.lng - dLng],
        [wf.lat + dLat, wf.lng + dLng],
      ]
      L.rectangle(bounds, {
        color,
        weight: 1.5,
        opacity: 0.75,
        dashArray: '6 4',
        fillColor: color,
        fillOpacity: 0.08,
      }).addTo(g)
      // 區塊內灑幾支風機示意（3×3 稀疏格點，表達「風機陣列」但不宣稱精確位置）
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue
          L.marker([wf.lat + (dLat * i) / 1.6, wf.lng + (dLng * j) / 1.6], {
            interactive: false,
            icon: L.divIcon({
              className: '',
              html: `<div style="opacity:.55">${turbineSvg(color, 13)}</div>`,
              iconSize: [13, 13],
              iconAnchor: [7, 11],
            }),
          }).addTo(g)
        }
      }
      // 中央主風機圖示 + 名稱
      L.marker([wf.lat, wf.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="wf-marker">${turbineSvg(color, 24)}<div class="wf-label" style="color:${color}">${wf.name}</div></div>`,
          iconSize: [24, 34],
          iconAnchor: [12, 20],
        }),
      })
        .bindPopup(
          `<b style="color:${color}">🗼 ${wf.name}</b><br/>離岸風力發電場（${wf.status}）<br/>` +
            `示意範圍約 ${wf.radiusKm} km<br/><span style="color:#94a3b8;font-size:11px">風機作業區/限制航行，注意避碰；實際範圍以航港局公告為準</span>`,
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
 * 金馬外離島 禁止／限制水域（示意）圖層：處置大陸漁船越界抽砂/捕撈用。
 * 內圈＝禁止水域（紅實線），外圈＝限制水域（橘虛線）。
 */
export function RestrictedZoneLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showRestricted)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!show) return
    const g = L.layerGroup().addTo(map)
    groupRef.current = g
    for (const z of RESTRICTED_ZONES) {
      // 限制水域（外緣）
      L.circle([z.lat, z.lng], {
        radius: z.limitKm * 1000,
        color: '#fb923c',
        weight: 1.5,
        opacity: 0.75,
        dashArray: '6 5',
        fillColor: '#fb923c',
        fillOpacity: 0.05,
      })
        .bindPopup(`<b style="color:#fb923c">${z.name} 限制水域（示意）</b><br/>外緣約 ${z.limitKm} km；大陸船舶進入即屬越界`)
        .addTo(g)
      // 禁止水域（近岸）
      L.circle([z.lat, z.lng], {
        radius: z.banKm * 1000,
        color: '#f43f5e',
        weight: 2,
        opacity: 0.9,
        fillColor: '#f43f5e',
        fillOpacity: 0.1,
      })
        .bindPopup(`<b style="color:#f43f5e">${z.name} 禁止水域（示意）</b><br/>近岸約 ${z.banKm} km；最優先驅離/查扣範圍`)
        .addTo(g)
      L.marker([z.lat, z.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="restrict-label">🚫 ${z.name}</div>`,
          iconSize: [96, 16],
          iconAnchor: [48, 8],
        }),
      }).addTo(g)
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
 * 暫定執法線／重疊海域（示意）圖層：台日漁業協議外緣、台菲巴士海峽中線。
 * 供對外漁業執法邊界態勢參考。
 */
export function EnforcementLineLayer({ map }: { map: L.Map }) {
  const show = useTacticalStore((s) => s.showEnforceLine)
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!show) return
    const g = L.layerGroup().addTo(map)
    groupRef.current = g
    for (const line of ENFORCEMENT_LINES) {
      L.polyline(line.path, { color: line.color, weight: 2.5, dashArray: '12 7', opacity: 0.85 })
        .bindPopup(`<b style="color:${line.color}">${line.name}</b><br/><span style="color:#94a3b8;font-size:11px">概略示意，非官方劃界；以海巡署執法海域圖為準</span>`)
        .addTo(g)
      const mid = line.path[Math.floor(line.path.length / 2)]
      L.marker(mid, {
        icon: L.divIcon({
          className: '',
          html: `<div class="enforce-label" style="border-color:${line.color};color:${line.color}">${line.name}</div>`,
          iconSize: [150, 16],
          iconAnchor: [75, 8],
        }),
      }).addTo(g)
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
