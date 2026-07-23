import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { buildBaseLayer, BASE_LABELS, type BaseLayerId } from '../lib/baseLayers'

const ORDER: BaseLayerId[] = ['dark', 'nlsc', 'nlscPhoto', 'satColor']

/** 各底圖的涵蓋提示（切換時顯示，讓使用者知道遠洋有沒有圖）。 */
const BASE_NOTE: Record<BaseLayerId, string> = {
  dark: '',
  nlsc: '（台灣周邊；遠洋仍為暗色）',
  nlscPhoto: '（台灣周邊；遠洋仍為暗色）',
  satColor: '（全球含外海，其它資料都疊在這張彩圖上）',
}

/**
 * 底圖管理 + 切換鈕（🗺️）。中文底圖用內政部國土測繪中心（NLSC），台灣周邊
 * 才有圖磚，故底下永遠墊一層深色 CARTO 當「遠洋/無資料」底，不會全白。
 */
export function BaseLayerControl({ map }: { map: L.Map }) {
  const baseLayer = useTacticalStore((s) => s.baseLayer)
  const setBaseLayer = useTacticalStore((s) => s.setBaseLayer)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const toolsExpanded = useTacticalStore((s) => s.toolsExpanded)
  const underRef = useRef<L.TileLayer | null>(null)
  const topRef = useRef<L.TileLayer | null>(null)

  // 專屬底圖 pane（z 低於 tilePane，確保光學/雷達影像永遠疊在底圖之上）
  useEffect(() => {
    if (!map.getPane('basePane')) {
      map.createPane('basePane')
      const pane = map.getPane('basePane')
      if (pane) pane.style.zIndex = '150'
    }
    const under = buildBaseLayer('dark')
    under.options.pane = 'basePane'
    under.addTo(map)
    underRef.current = under
    return () => {
      map.removeLayer(under)
      underRef.current = null
    }
  }, [map])

  // 依選擇疊上中文底圖（dark 時不疊）
  useEffect(() => {
    if (topRef.current) {
      map.removeLayer(topRef.current)
      topRef.current = null
    }
    if (baseLayer !== 'dark') {
      const top = buildBaseLayer(baseLayer)
      top.options.pane = 'basePane'
      top.addTo(map)
      topRef.current = top
    }
    return () => {
      if (topRef.current) {
        map.removeLayer(topRef.current)
        topRef.current = null
      }
    }
  }, [baseLayer, map])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(baseLayer) + 1) % ORDER.length]
    setBaseLayer(next)
    setStatus(`底圖：${BASE_LABELS[next]}${BASE_NOTE[next]}`)
  }

  if (!toolsExpanded && baseLayer === 'dark') return null

  return (
    <button
      onClick={cycle}
      className={`safe-float-top8 pointer-events-auto absolute z-[1100] flex h-11 w-11 items-center justify-center rounded-full border text-lg active:scale-95 ${
        baseLayer !== 'dark'
          ? 'border-tactical-cyan bg-tactical-cyan/20 text-tactical-cyan'
          : 'border-slate-600 bg-tactical-panel/90'
      }`}
      aria-label="切換底圖"
      title="切換底圖（戰術暗色 / 中文電子地圖 / 中文衛星）"
    >
      🗺️
    </button>
  )
}
