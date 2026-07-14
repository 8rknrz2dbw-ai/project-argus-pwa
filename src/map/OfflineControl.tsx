import { useState } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { tilesForBounds, downloadTiles } from '../lib/offlineMap'

/**
 * 離線地圖包：下載目前畫面範圍的底圖圖磚進快取，沒訊號也能看這塊海域。
 */
export function OfflineControl({ map }: { map: L.Map }) {
  const setStatus = useTacticalStore((s) => s.setStatus)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)

  const download = async () => {
    if (busy) return
    const b = map.getBounds()
    const z = Math.round(map.getZoom())
    const bounds = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
    // 目前層級到 +2 層，上限 500 磚，避免吃爆流量。
    const tiles = tilesForBounds(bounds, z, Math.min(z + 2, 19), 500)
    setBusy(true)
    setPct(0)
    setStatus(`離線地圖：開始下載 ${tiles.length} 個圖磚…`)
    const { ok, fail } = await downloadTiles(tiles, (done, total) => {
      setPct(Math.round((done / total) * 100))
    })
    setBusy(false)
    setPct(0)
    setStatus(
      fail === 0
        ? `✓ 離線地圖已下載 ${ok} 圖磚，此區沒訊號也能看`
        : `離線地圖下載完成：成功 ${ok}、失敗 ${fail}（部分圖磚無資料）`,
    )
  }

  return (
    <button
      onClick={download}
      className="safe-float-top3 pointer-events-auto absolute z-[1100] flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-tactical-panel/90 text-lg active:scale-95"
      aria-label="下載離線地圖"
      title="下載此區離線地圖"
    >
      {busy ? <span className="font-mono text-[10px] text-tactical-cyan">{pct}%</span> : '💾'}
    </button>
  )
}
