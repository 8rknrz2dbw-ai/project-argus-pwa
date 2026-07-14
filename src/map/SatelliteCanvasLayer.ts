import L from 'leaflet'
import type { SatelliteState, WorkerMessage } from '../types'

/**
 * Canvas 動態層（Z-index 最高）
 *
 * 用 Leaflet 的 canvas overlay 畫「即時衛星白點 + 軌跡」。資料來自
 * orbit.worker（背景執行緒），本層只負責畫。
 *
 * 防爆重點（對應指令）：
 *  - onRemove() 時 **cancelAnimationFrame()** 徹底中止渲染迴圈，不是 display:none。
 *  - onRemove() 時 **worker.terminate()** 關掉背景運算，手機不再發熱。
 *  - 清空 satellites 陣列，釋放記憶體。
 */
export class SatelliteCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private worker: Worker | null = null
  private satellites: SatelliteState[] = []
  private rafId: number | null = null
  private running = false

  onAdd(map: L.Map): this {
    // 1. 建立與地圖 overlayPane 同尺寸的 canvas
    const size = map.getSize()
    this.canvas = L.DomUtil.create('canvas', 'leaflet-satellite-canvas') as HTMLCanvasElement
    this.canvas.width = size.x
    this.canvas.height = size.y
    this.canvas.style.position = 'absolute'
    this.canvas.style.pointerEvents = 'none'
    this.ctx = this.canvas.getContext('2d')
    map.getPanes().overlayPane!.appendChild(this.canvas)

    // 2. 地圖平移/縮放時重新對齊 canvas
    map.on('moveend zoomend resize', this.reset, this)
    this.reset()

    // 3. 啟動背景 Worker
    this.worker = new Worker(new URL('../workers/orbit.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      if (e.data.type === 'positions') this.satellites = e.data.satellites
    }
    this.worker.postMessage({ type: 'setRate', fps: 30 })
    this.worker.postMessage({ type: 'start' })

    // 4. 啟動渲染迴圈
    this.running = true
    this.rafId = requestAnimationFrame(this.render)
    return this
  }

  onRemove(map: L.Map): this {
    // ── 徹底停機（防止背景繼續運算發熱）──
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId) // 關鍵：不是 display:none
      this.rafId = null
    }
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' })
      this.worker.terminate() // 關閉背景執行緒
      this.worker = null
    }
    map.off('moveend zoomend resize', this.reset, this)
    if (this.canvas) {
      L.DomUtil.remove(this.canvas)
      this.canvas = null
    }
    this.ctx = null
    this.satellites = [] // 清空陣列釋放記憶體
    return this
  }

  /** 地圖視野改變時，把 canvas 平移回左上角原點並重設尺寸。 */
  private reset = () => {
    const map = this._map
    if (!map || !this.canvas) return
    const topLeft = map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this.canvas, topLeft)
    const size = map.getSize()
    if (this.canvas.width !== size.x || this.canvas.height !== size.y) {
      this.canvas.width = size.x
      this.canvas.height = size.y
    }
  }

  private render = () => {
    if (!this.running) return
    const map = this._map
    const ctx = this.ctx
    if (map && ctx && this.canvas) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      for (const sat of this.satellites) {
        this.drawTrail(ctx, map, sat)
        this.drawDot(ctx, map, sat)
      }
    }
    this.rafId = requestAnimationFrame(this.render)
  }

  private drawTrail(ctx: CanvasRenderingContext2D, map: L.Map, sat: SatelliteState) {
    if (sat.trail.length < 2) return
    ctx.beginPath()
    sat.trail.forEach(([lat, lng], i) => {
      const p = map.latLngToContainerPoint([lat, lng])
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)' // cyan 尾巴
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  private drawDot(ctx: CanvasRenderingContext2D, map: L.Map, sat: SatelliteState) {
    const p = map.latLngToContainerPoint([sat.lat, sat.lng])
    // 光暈
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(52, 211, 153, 0.25)'
    ctx.fill()
    // 亮點
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ecfeff'
    ctx.fill()
    // 標籤
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#34d399'
    ctx.fillText(sat.id, p.x + 8, p.y + 3)
  }
}
