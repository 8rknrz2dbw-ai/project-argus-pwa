import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { detectBrightSpots } from '../lib/brightSpot'

/**
 * 亮點掃描圖層：把目前畫面上的衛星影像圖磚畫到離屏 canvas，做亮點偵測，
 * 在暗海上突出的小亮點（疑似船/殘骸/反光）標成編號記號，幫助快速分辨。
 * 只在光學模式作用；靠 scanTick 觸發（按鈕按一次掃一次）。
 */
export function BrightSpotLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const scanTick = useTacticalStore((s) => s.scanTick)
  const sensitivity = useTacticalStore((s) => s.scanSensitivity)
  const brightSpots = useTacticalStore((s) => s.brightSpots)
  const setBrightSpots = useTacticalStore((s) => s.setBrightSpots)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const groupRef = useRef<L.LayerGroup | null>(null)

  // 掃描（scanTick 改變時執行一次）
  useEffect(() => {
    if (mode !== 'optical' || scanTick === 0) return
    const container = map.getContainer()
    const imgs = container.querySelectorAll<HTMLImageElement>('img.gibs-imagery')
    if (!imgs.length) {
      setStatus('請先切到有衛星影像的來源（高解析/無雲/每日）再掃描')
      return
    }
    const size = map.getSize()
    const canvas = document.createElement('canvas')
    canvas.width = size.x
    canvas.height = size.y
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const mapRect = container.getBoundingClientRect()
    let drew = 0
    imgs.forEach((img) => {
      if (!img.complete || !img.naturalWidth) return
      const r = img.getBoundingClientRect()
      try {
        ctx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height)
        drew++
      } catch {
        /* 個別圖磚繪製失敗略過 */
      }
    })
    if (!drew) {
      setStatus('影像尚未載入完成，稍候再掃描')
      return
    }
    let data: ImageData
    try {
      data = ctx.getImageData(0, 0, size.x, size.y)
    } catch {
      setStatus('此影像來源不支援畫面分析（跨網域）；請切到「高解析(Esri)」或「每日(NASA)」')
      return
    }
    setStatus('亮點掃描中…')
    const spots = detectBrightSpots(data, {
      step: 2,
      kStd: sensitivity,
      ringMargin: 14,
      minSize: 1,
      maxSize: 40,
      maxSpots: 60,
    })
    const results = spots.map((s) => {
      const ll = map.containerPointToLatLng(L.point(s.x, s.y))
      return { lat: ll.lat, lng: ll.lng, score: s.score }
    })
    setBrightSpots(results)
    setStatus(
      results.length
        ? `亮點掃描：找到 ${results.length} 個疑似亮點（點記號看位置；白浪/反光也可能中）`
        : '亮點掃描：此畫面沒有明顯亮點（可調高靈敏度或放大）',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTick])

  // 依 brightSpots 畫記號
  useEffect(() => {
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map)
    const g = groupRef.current
    g.clearLayers()
    if (mode !== 'optical') return
    brightSpots.forEach((s, i) => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="bright-spot">${i + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1400,
      })
        .bindPopup(
          `<b style="color:#22d3ee">疑似亮點 #${i + 1}</b><br/>突出度 ${s.score.toFixed(1)}σ<br/>${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}<br/><span style="color:#94a3b8">輔助判讀，非確認為船</span>`,
        )
        .addTo(g)
    })
  }, [brightSpots, mode, map])

  useEffect(
    () => () => {
      if (groupRef.current) {
        groupRef.current.clearLayers()
        map.removeLayer(groupRef.current)
        groupRef.current = null
      }
    },
    [map],
  )

  return null
}
