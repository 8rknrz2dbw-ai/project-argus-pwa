import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { fetchEnvGrid, type MarineEnv } from '../lib/marineEnv'
import { sstColor, waveColor } from '../lib/colorScale'
import { isCwaConfigured } from '../lib/config'
import { fetchCwaSeaAreas } from '../lib/cwaMarine'

/**
 * 海況熱力圖：把當前視野的海溫或浪高畫成彩色網格（免金鑰，Open-Meteo）。
 * 進模式 / 平移地圖 → 抓網格 → 依數值上色。切海溫/浪高即時重畫。
 */
export function SeaStateLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const field = useTacticalStore((s) => s.seaStateField)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const setCwaSeaAreas = useTacticalStore((s) => s.setCwaSeaAreas)

  const groupRef = useRef<L.LayerGroup | null>(null)
  const envRef = useRef<MarineEnv[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'seastate') return
    const group = L.layerGroup().addTo(map)
    groupRef.current = group

    const draw = () => {
      if (!groupRef.current) return
      group.clearLayers()
      const cols = 10
      const rows = 12
      const b = map.getBounds()
      const dLat = (b.getNorth() - b.getSouth()) / rows
      const dLng = (b.getEast() - b.getWest()) / cols
      envRef.current.forEach((e, idx) => {
        const r = Math.floor(idx / cols)
        const c = idx % cols
        const south = b.getSouth() + r * dLat
        const west = b.getWest() + c * dLng
        const val = field === 'sst' ? e.sst : e.waveHeight
        const color = field === 'sst' ? sstColor(e.sst) : waveColor(e.waveHeight)
        L.rectangle(
          [
            [south, west],
            [south + dLat, west + dLng],
          ],
          { stroke: false, fillColor: color, fillOpacity: 1 },
        )
          .bindPopup(
            field === 'sst' ? `海溫 ${val.toFixed(1)} °C` : `浪高 ${val.toFixed(1)} m`,
          )
          .addTo(group)
      })
    }

    const refresh = async () => {
      const b = map.getBounds()
      const cols = 10
      const rows = 12
      const pts: [number, number][] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lat = b.getSouth() + ((b.getNorth() - b.getSouth()) * (r + 0.5)) / rows
          const lng = b.getWest() + ((b.getEast() - b.getWest()) * (c + 0.5)) / cols
          pts.push([lat, lng])
        }
      }
      setStatus('載入海況熱力圖…')
      const envs = await fetchEnvGrid(pts)
      envRef.current = envs
      draw()
      setStatus(
        field === 'sst' ? '海況：海表溫度分佈（越紅越暖）' : '海況：浪高分佈（越紅紫越大浪）',
      )
    }

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(refresh, 600)
    }

    map.on('moveend', onMoveEnd)
    refresh()

    // CWA 台灣各海域海面天氣/波浪官方預報（有設定才抓，一次即可）。
    let cancelled = false
    setCwaSeaAreas(null)
    if (isCwaConfigured()) {
      fetchCwaSeaAreas().then((s) => {
        if (!cancelled) setCwaSeaAreas(s)
      })
    }

    return () => {
      cancelled = true
      map.off('moveend', onMoveEnd)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      group.clearLayers()
      map.removeLayer(group)
      groupRef.current = null
      envRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, field])

  return null
}
