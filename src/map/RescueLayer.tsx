import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useTacticalStore } from '../store/tacticalStore'
import { fetchEnvAt, fetchEnvGrid, type MarineEnv } from '../lib/marineEnv'
import { predictDrift, bearingToText } from '../lib/drift'
import { simulateMonteCarlo } from '../lib/montecarlo'
import { buildSearchPattern } from '../lib/searchPattern'

/**
 * 搜救推演圖層。只在 rescue 模式運行：
 *  1. 進模式 / 平移地圖 → 抓當前視野的風場 + 洋流網格 → 畫箭頭
 *  2. 點地圖 → 標記落海點 → 抓該點海象 → 算漂流 → 畫預測點與搜索圈
 *
 * 洋流箭頭（綠）＝水流去向；風箭頭（青、虛線）＝風吹去向。
 */
export function RescueLayer({ map }: { map: L.Map }) {
  const mode = useTacticalStore((s) => s.mode)
  const setManOverboard = useTacticalStore((s) => s.setManOverboard)
  const setRescueResult = useTacticalStore((s) => s.setRescueResult)
  const setRescueStatus = useTacticalStore((s) => s.setRescueStatus)
  const setStatus = useTacticalStore((s) => s.setStatus)

  const manOverboard = useTacticalStore((s) => s.manOverboard)
  const rescueEnv = useTacticalStore((s) => s.rescueEnv)
  const scrubHours = useTacticalStore((s) => s.scrubHours)
  const driftLeeway = useTacticalStore((s) => s.driftLeeway)
  const driftMode = useTacticalStore((s) => s.driftMode)
  const showProbability = useTacticalStore((s) => s.showProbability)
  const showSearchPattern = useTacticalStore((s) => s.showSearchPattern)
  const trackSpacingNm = useTacticalStore((s) => s.trackSpacingNm)
  const mcSummary = useTacticalStore((s) => s.mcSummary)
  const setMcSummary = useTacticalStore((s) => s.setMcSummary)
  const driftPoints = useTacticalStore((s) => s.driftPoints)
  const setDriftPoints = useTacticalStore((s) => s.setDriftPoints)
  const reverse = driftMode === 'backward'

  const fieldRef = useRef<L.LayerGroup | null>(null) // 風/流箭頭
  const driftRef = useRef<L.LayerGroup | null>(null) // 落海點 + 漂流
  const scrubRef = useRef<L.LayerGroup | null>(null) // 時間軸 scrubber
  const probRef = useRef<L.LayerGroup | null>(null) // 蒙地卡羅機率密度
  const searchRef = useRef<L.LayerGroup | null>(null) // 搜索航線
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'rescue') return

    const field = L.layerGroup().addTo(map)
    const drift = L.layerGroup().addTo(map)
    fieldRef.current = field
    driftRef.current = drift

    const refreshField = async () => {
      const pts = sampleGrid(map.getBounds(), 5, 4)
      const envs = await fetchEnvGrid(pts)
      if (!fieldRef.current) return // 期間已卸載
      field.clearLayers()
      for (const e of envs) drawEnvArrows(field, e)
      if (envs[0] && !envs[0].live) setStatus('搜救推演：海象資料源離線，使用預設值')
    }

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(refreshField, 700)
    }

    // 點地圖只設標記點；海象抓取交給下方 effect（點選或手動輸入座標都適用）。
    const onClick = (e: L.LeafletMouseEvent) => {
      setManOverboard({ lat: e.latlng.lat, lng: e.latlng.lng })
    }

    map.on('moveend', onMoveEnd)
    map.on('click', onClick)
    refreshField()

    return () => {
      map.off('moveend', onMoveEnd)
      map.off('click', onClick)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      field.clearLayers()
      drift.clearLayers()
      map.removeLayer(field)
      map.removeLayer(drift)
      if (scrubRef.current) {
        scrubRef.current.clearLayers()
        map.removeLayer(scrubRef.current)
        scrubRef.current = null
      }
      if (probRef.current) {
        probRef.current.clearLayers()
        map.removeLayer(probRef.current)
        probRef.current = null
      }
      if (searchRef.current) {
        searchRef.current.clearLayers()
        map.removeLayer(searchRef.current)
        searchRef.current = null
      }
      fieldRef.current = null
      driftRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── 標記點一變（點選或手動輸入）就抓該點海象；必要時把地圖移過去 ──
  useEffect(() => {
    if (mode !== 'rescue' || !manOverboard) return
    let cancelled = false
    setRescueStatus('loading')
    setStatus('已標記位置，讀取海象中…')
    // 若標記點在畫面外（多半是手動輸入座標），把地圖移過去。
    if (!map.getBounds().contains([manOverboard.lat, manOverboard.lng])) {
      map.setView([manOverboard.lat, manOverboard.lng], Math.max(map.getZoom(), 8))
    }
    fetchEnvAt(manOverboard.lat, manOverboard.lng).then((env) => {
      if (!cancelled) setRescueResult(env, [])
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, manOverboard])

  // ── 漂流計算：落海點 / 海象 / 物體類型(leeway) 任一改變就重算重畫 ──
  useEffect(() => {
    if (mode !== 'rescue') return
    const drift = driftRef.current
    if (!drift) return
    drift.clearLayers()
    if (!manOverboard) {
      setDriftPoints([])
      return
    }
    drawManOverboard(drift, manOverboard.lat, manOverboard.lng, reverse)
    if (!rescueEnv) return
    const points = predictDrift({
      lat: manOverboard.lat,
      lng: manOverboard.lng,
      wind: { speed: rescueEnv.windSpeed, dirDeg: rescueEnv.windDir },
      current: { speed: rescueEnv.currentSpeed, dirDeg: rescueEnv.currentDir },
      leewayFactor: driftLeeway,
      reverse,
      // 落海可能是數小時前甚至數天前，預判/回推到 72 小時（3 天）。
      hoursList: [1, 6, 12, 24, 48, 72],
    })
    drawDrift(drift, manOverboard.lat, manOverboard.lng, points, reverse)
    setDriftPoints(points)
    setRescueStatus('done')
    const last = points[points.length - 1]
    const when = reverse ? `${last.hours}h 前` : `${last.hours}h 後`
    const verb = reverse ? '回推來源' : '漂流預判'
    setStatus(
      `${verb}：${when}約在 ${bearingToText(last.bearingDeg)}方 ${(last.driftMeters / 1852).toFixed(1)} 浬，範圍半徑 ${(last.radiusMeters / 1852).toFixed(1)} 浬`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, manOverboard, rescueEnv, driftLeeway, reverse])

  // ── 時間軸 scrubber：拉桿到任意小時，畫出該時刻的漂流位置 ──
  useEffect(() => {
    if (mode !== 'rescue') return
    if (!scrubRef.current) scrubRef.current = L.layerGroup().addTo(map)
    const g = scrubRef.current
    g.clearLayers()
    if (scrubHours > 0 && manOverboard && rescueEnv) {
      const [p] = predictDrift({
        lat: manOverboard.lat,
        lng: manOverboard.lng,
        wind: { speed: rescueEnv.windSpeed, dirDeg: rescueEnv.windDir },
        current: { speed: rescueEnv.currentSpeed, dirDeg: rescueEnv.currentDir },
        leewayFactor: driftLeeway,
        reverse,
        hoursList: [scrubHours],
      })
      L.circle([p.lat, p.lng], {
        radius: p.radiusMeters,
        color: '#fbbf24',
        weight: 2,
        fillColor: '#fbbf24',
        fillOpacity: 0.12,
      }).addTo(g)
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="scrub-label">${scrubHours}h ${reverse ? '前' : '後'}</div>`,
          iconSize: [46, 18],
          iconAnchor: [23, 9],
        }),
        zIndexOffset: 1100,
      }).addTo(g)
    }
    return () => {
      g.clearLayers()
    }
  }, [mode, scrubHours, manOverboard, rescueEnv, driftLeeway, reverse, map])

  // ── 蒙地卡羅機率密度圖 (SAROPS 式) ──────────────────────
  useEffect(() => {
    if (mode !== 'rescue') return
    if (!probRef.current) probRef.current = L.layerGroup().addTo(map)
    const g = probRef.current
    g.clearLayers()
    if (!showProbability || !manOverboard || !rescueEnv) {
      setMcSummary(null)
      return
    }

    const hours = scrubHours > 0 ? scrubHours : 6
    const mc = simulateMonteCarlo({
      lat: manOverboard.lat,
      lng: manOverboard.lng,
      windSpeed: rescueEnv.windSpeed,
      windDir: rescueEnv.windDir,
      currentSpeed: rescueEnv.currentSpeed,
      currentDir: rescueEnv.currentDir,
      leeway: driftLeeway,
      hours,
      reverse,
      n: 1200,
    })
    // 機率密度格：越密→越紅
    for (const cell of mc.cells) {
      const t = cell.count / mc.maxCount
      L.rectangle(
        [
          [cell.south, cell.west],
          [cell.north, cell.east],
        ],
        { stroke: false, fillColor: densityColor(t), fillOpacity: 0.45 + t * 0.4 },
      ).addTo(g)
    }
    // 最高機率點
    if (mc.peak) {
      L.marker([mc.peak.lat, mc.peak.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="mc-peak">◎</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        zIndexOffset: 1200,
      })
        .bindPopup(
          `<b style="color:#f43f5e">最高機率位置</b><br/>${hours}h ${reverse ? '前' : '後'}｜95% 範圍半徑 ${(mc.radius95 / 1852).toFixed(1)} 浬<br/>1200 粒子蒙地卡羅`,
        )
        .addTo(g)
    }
    setMcSummary({ peak: mc.peak, centroid: mc.centroid, radius95: mc.radius95 })
    setStatus(
      `蒙地卡羅機率圖：${hours}h${reverse ? '前' : '後'}，1200 粒子，95% 範圍半徑 ${(mc.radius95 / 1852).toFixed(1)} 浬`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showProbability, manOverboard, rescueEnv, driftLeeway, reverse, scrubHours])

  // ── 平行梳掃搜索航線 ──────────────────────────────────
  useEffect(() => {
    if (mode !== 'rescue') return
    if (!searchRef.current) searchRef.current = L.layerGroup().addTo(map)
    const g = searchRef.current
    g.clearLayers()
    if (!showSearchPattern || !manOverboard) return

    // 搜索中心與半徑：優先用蒙地卡羅結果，否則用最後一個漂流點。
    let center = mcSummary?.centroid ?? null
    let radiusM = mcSummary?.radius95 ?? 0
    if (!center) {
      const last = driftPoints[driftPoints.length - 1]
      if (last) {
        center = { lat: last.lat, lng: last.lng }
        radiusM = last.radiusMeters
      }
    }
    if (!center || radiusM <= 0) return

    const sp = buildSearchPattern({
      centerLat: center.lat,
      centerLng: center.lng,
      radiusM,
      spacingM: trackSpacingNm * 1852,
    })
    L.polyline(sp.path, { color: '#22d3ee', weight: 2, opacity: 0.9 }).addTo(g)
    // 起點
    if (sp.path[0]) {
      L.marker(sp.path[0], {
        icon: L.divIcon({
          className: '',
          html: `<div class="search-start">▶</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1150,
      })
        .bindPopup(
          `<b style="color:#22d3ee">搜索航線起點</b><br/>平行梳掃 ${sp.legs} 條腿｜間距 ${trackSpacingNm} 浬<br/>總航程 ${(sp.lengthM / 1852).toFixed(1)} 浬`,
        )
        .addTo(g)
    }
    setStatus(
      `搜索航線：${sp.legs} 條梳掃腿，間距 ${trackSpacingNm} 浬，總航程 ${(sp.lengthM / 1852).toFixed(1)} 浬`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showSearchPattern, trackSpacingNm, mcSummary, driftPoints, manOverboard])

  return null
}

/** 機率密度色階：低(藍紫透明) → 中(黃) → 高(紅)。 */
function densityColor(t: number): string {
  if (t < 0.33) return '#38bdf8'
  if (t < 0.66) return '#fbbf24'
  return '#f43f5e'
}

// ── 幾何工具 ────────────────────────────────────────────────
const DEG = Math.PI / 180
const R = 6371000

function dest(lat: number, lng: number, bearingDeg: number, distM: number) {
  const b = bearingDeg * DEG
  const dN = distM * Math.cos(b)
  const dE = distM * Math.sin(b)
  return {
    lat: lat + (dN / R) / DEG,
    lng: lng + (dE / (R * Math.cos(lat * DEG))) / DEG,
  }
}

/** 在 bounds 內取 cols×rows 網格點（邊緣內縮）。 */
function sampleGrid(bounds: L.LatLngBounds, cols: number, rows: number): [number, number][] {
  const s = bounds.getSouth()
  const n = bounds.getNorth()
  const w = bounds.getWest()
  const e = bounds.getEast()
  const pts: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = s + ((n - s) * (r + 0.5)) / rows
      const lng = w + ((e - w) * (c + 0.5)) / cols
      pts.push([lat, lng])
    }
  }
  return pts
}

/** 畫一支帶箭頭的向量（方向為 toward）。 */
function drawArrow(
  group: L.LayerGroup,
  lat: number,
  lng: number,
  bearingToward: number,
  lengthM: number,
  color: string,
  dashed = false,
) {
  const tip = dest(lat, lng, bearingToward, lengthM)
  const style: L.PolylineOptions = {
    color,
    weight: 2,
    opacity: 0.85,
    ...(dashed ? { dashArray: '4 3' } : {}),
  }
  L.polyline([[lat, lng], [tip.lat, tip.lng]], style).addTo(group)
  // 箭頭兩翼
  const wingLen = lengthM * 0.32
  const left = dest(tip.lat, tip.lng, bearingToward + 150, wingLen)
  const right = dest(tip.lat, tip.lng, bearingToward - 150, wingLen)
  L.polyline([[tip.lat, tip.lng], [left.lat, left.lng]], style).addTo(group)
  L.polyline([[tip.lat, tip.lng], [right.lat, right.lng]], style).addTo(group)
}

/** 一個網格點畫「洋流（綠）＋風（青虛線）」兩支箭頭。 */
function drawEnvArrows(group: L.LayerGroup, e: MarineEnv) {
  // 洋流：流向 = toward，長度隨流速
  drawArrow(group, e.lat, e.lng, e.currentDir, 6000 + e.currentSpeed * 12000, '#34d399', false)
  // 風：來向 + 180 = 去向，長度隨風速
  const windToward = (e.windDir + 180) % 360
  drawArrow(group, e.lat, e.lng, windToward, 4000 + e.windSpeed * 900, '#22d3ee', true)
}

function drawManOverboard(group: L.LayerGroup, lat: number, lng: number, reverse: boolean) {
  L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: `<div class="mob-marker">✚</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    zIndexOffset: 1000,
  })
    .bindPopup(
      reverse
        ? '<b style="color:#f43f5e">發現/目擊位置 (回推來源)</b>'
        : '<b style="color:#f43f5e">落海點 (最後已知位置)</b>',
    )
    .addTo(group)
}

function drawDrift(
  group: L.LayerGroup,
  lat0: number,
  lng0: number,
  points: { hours: number; lat: number; lng: number; radiusMeters: number }[],
  reverse: boolean,
) {
  // 漂流/回推軌跡線
  const line: [number, number][] = [[lat0, lng0], ...points.map((p) => [p.lat, p.lng] as [number, number])]
  L.polyline(line, { color: '#f43f5e', weight: 2, dashArray: '6 4' }).addTo(group)

  points.forEach((p, i) => {
    const emphasis = i === points.length - 1
    // 搜索圈
    L.circle([p.lat, p.lng], {
      radius: p.radiusMeters,
      color: '#f43f5e',
      weight: emphasis ? 2 : 1,
      opacity: 0.8,
      fillColor: '#f43f5e',
      fillOpacity: emphasis ? 0.12 : 0.06,
    }).addTo(group)
    // 時間標籤（前/後）
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div class="drift-label">${p.hours}h${reverse ? '前' : ''}</div>`,
        iconSize: [34, 18],
        iconAnchor: [17, 9],
      }),
    }).addTo(group)
  })
}
