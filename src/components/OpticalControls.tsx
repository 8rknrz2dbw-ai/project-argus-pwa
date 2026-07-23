import { useState } from 'react'
import { useTacticalStore } from '../store/tacticalStore'
import { isSentinelConfigured } from '../lib/sentinel'
import { SatelliteQuickLinks } from './SatelliteQuickLinks'
import { parseCoord } from '../lib/coordParse'
import { shareReport } from '../lib/report'

/**
 * 光學模式的控制項：影像來源提示 + 雲量滑桿 + 歷史觀測日期。
 * 只在 optical 模式顯示，避免 UI 雜亂。
 */
export function OpticalControls() {
  const maxCloudCover = useTacticalStore((s) => s.maxCloudCover)
  const setMaxCloudCover = useTacticalStore((s) => s.setMaxCloudCover)
  const observationDate = useTacticalStore((s) => s.observationDate)
  const setObservationDate = useTacticalStore((s) => s.setObservationDate)
  const opticalSource = useTacticalStore((s) => s.opticalSource)
  const setOpticalSource = useTacticalStore((s) => s.setOpticalSource)
  const own = useTacticalStore((s) => s.ownPosition)
  const gotoCoord = useTacticalStore((s) => s.gotoCoord)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const bumpScan = useTacticalStore((s) => s.bumpScan)
  const scanSensitivity = useTacticalStore((s) => s.scanSensitivity)
  const setScanSensitivity = useTacticalStore((s) => s.setScanSensitivity)
  const brightSpots = useTacticalStore((s) => s.brightSpots)
  const today = new Date().toISOString().slice(0, 10)
  const hd = isSentinelConfigured()

  // 座標查詢：輸入經緯度（可貼萬用格式）→ 地圖飛過去 + 影像連結以此為中心
  const [qLat, setQLat] = useState('')
  const [qLng, setQLng] = useState('')
  // 先試萬用解析（可把整串座標貼在緯度欄），失敗再退回兩欄十進位。
  const queried =
    parseCoord(`${qLat} ${qLng}`.trim()) ??
    (Number.isFinite(parseFloat(qLat)) && Number.isFinite(parseFloat(qLng))
      ? { lat: parseFloat(qLat), lng: parseFloat(qLng) }
      : null)
  const goToCoord = () => {
    if (queried && Math.abs(queried.lat) <= 90 && Math.abs(queried.lng) <= 180) {
      gotoCoord(queried.lat, queried.lng, 11)
      setStatus(`已跳到 ${queried.lat.toFixed(3)}, ${queried.lng.toFixed(3)}｜選日期看當時影像`)
    } else {
      setStatus('⚠ 座標格式錯誤（可用十進位/度分/度分秒，或用 📌 座標管理貼萬用格式）')
    }
  }
  const linkCenter = queried ?? own ?? undefined

  const exportDetections = async () => {
    if (brightSpots.length === 0) return
    const lines = [`【阿爾戈斯 目標掃描清單】共 ${brightSpots.length} 個`]
    brightSpots.forEach((s, i) => {
      const tag = s.ais === 'none' ? '⚠無AIS' : s.ais === 'known' ? `✓已知(${s.aisName || 'AIS'})` : ''
      lines.push(`#${i + 1} ${tag} ${s.cls}｜~${Math.round(s.sizeM)}m｜${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`)
    })
    lines.push('※ 亮點輔助分流，非確認身分；請並用雷達/目視。')
    const how = await shareReport(lines.join('\n'))
    setStatus(how === 'shared' ? '目標清單已分享' : how === 'copied' ? '目標清單已複製' : '⚠ 分享失敗')
  }

  const SRC_INFO: Record<string, string> = {
    esri: '高解析空拍鑲嵌 · 岸際/島礁最銳利，但⚠外海是空的（黑）——外海請切每日/無雲/海底',
    eox: 'Sentinel-2 無雲真彩色 · 10m 乾淨平滑、含外海（年度合成，非每日）',
    nasa: 'VIIRS/MODIS 每日真彩色（等同 NASA Worldview）· 含外海每日雲況（可選歷史日期）',
    ocean: '海底地形（Esri Ocean）· 覆蓋外海：水深/海脊/淺灘，適合漁區/航道/暗礁',
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/80 p-3">
      <div className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-[11px] leading-relaxed">
        {hd ? (
          <span className="text-tactical-green">🛰️ 高解析度：Sentinel-2（10m）· 雲量過濾生效</span>
        ) : (
          <span className="text-tactical-cyan">🛰️ 免金鑰影像來源：{SRC_INFO[opticalSource]}</span>
        )}
      </div>

      {/* 「看特定日期那艘船」：座標 + 日期合成一區，地圖直接換成該日影像 */}
      <div className="rounded-lg border border-tactical-cyan/40 bg-tactical-cyan/5 p-2">
        <div className="mb-1 text-[11px] font-semibold text-tactical-cyan">
          🔎 看「案發當時那艘船」：① 座標 ② 日期
        </div>
        <div className="flex items-center gap-1">
          <input
            inputMode="decimal"
            placeholder="緯度 24.5"
            value={qLat}
            onChange={(e) => setQLat(e.target.value)}
            className="w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200"
          />
          <input
            inputMode="decimal"
            placeholder="經度 122.0"
            value={qLng}
            onChange={(e) => setQLng(e.target.value)}
            className="w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200"
          />
          <button
            onClick={goToCoord}
            className="shrink-0 rounded border border-tactical-cyan bg-tactical-cyan/10 px-2 py-1.5 text-xs font-bold text-tactical-cyan active:scale-95"
          >
            ① 跳過去
          </button>
        </div>
        <label className="mb-1 mt-2 block text-[11px] font-semibold text-tactical-green">
          📅 ② 觀測日期（要看哪一天）
        </label>
        <input
          type="date"
          max={today}
          value={observationDate}
          onChange={(e) => setObservationDate(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-200"
        />
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          {hd
            ? '✅ 有 Sentinel 金鑰：地圖直接換成該日 Sentinel-2（10m）影像——這就是「當時那艘船」的畫面。看到船後按下方 🔍 掃描自動框。'
            : '免金鑰：地圖顯示該日 MODIS（250m，只看得到大船/船隊）。要 10m 全解析，貼 Sentinel 金鑰，或用本頁最下方「外部全解析衛星」連結。'}
        </p>
      </div>

      {/* 免金鑰四選一：高解析空拍(陸) / 無雲S2 / 每日MODIS / 海底地形(外海) */}
      {!hd && (
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-700 p-1">
          {(
            [
              ['esri', '高解析', '陸/岸'],
              ['eox', '無雲', 'S2·10m'],
              ['nasa', '每日', 'MODIS'],
              ['ocean', '海底', '外海'],
            ] as const
          ).map(([id, t1, t2]) => (
            <button
              key={id}
              onClick={() => setOpticalSource(id)}
              className={`flex flex-col items-center rounded py-1.5 active:scale-95 ${
                opticalSource === id ? 'bg-tactical-cyan/20 text-tactical-cyan' : 'text-slate-400'
              }`}
            >
              <span className="text-xs font-bold">{t1}</span>
              <span className="text-[9px] opacity-70">{t2}</span>
            </button>
          ))}
        </div>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-tactical-green">☁ 最大雲量</label>
          <span className="font-mono text-sm text-tactical-cyan">{maxCloudCover}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={maxCloudCover}
          onChange={(e) => setMaxCloudCover(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <p className="mt-1 text-[10px] text-slate-500">
          {hd ? '交給 ESA 伺服器過濾（MAXCC 參數）' : '雲量過濾需 Sentinel 金鑰；NASA 免費影像為每日合成'}
        </p>
      </div>

      {/* 亮點掃描：在暗海上標選疑似船/物體 */}
      <div className="rounded-lg border border-tactical-cyan/40 bg-tactical-cyan/5 p-2">
        <button
          onClick={bumpScan}
          className="w-full rounded-lg border border-tactical-cyan bg-tactical-cyan/15 py-2 text-sm font-bold text-tactical-cyan active:scale-95"
        >
          🔍 掃描並標注目標{brightSpots.length ? `（${brightSpots.length}）` : ''}
        </button>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-slate-400">靈敏度</span>
          <input
            type="range"
            min={2}
            max={4.5}
            step={0.1}
            value={scanSensitivity}
            // 拉桿右=更敏感（門檻低），故反向
            onChange={(e) => setScanSensitivity(6.5 - Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <span className="shrink-0 font-mono text-[10px] text-slate-500">
            {scanSensitivity <= 2.6 ? '高' : scanSensitivity >= 3.6 ? '低' : '中'}
          </span>
        </div>
        {brightSpots.length > 0 && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                共 {brightSpots.length} 目標
                {brightSpots.some((s) => s.ais === 'none') &&
                  `，⚠${brightSpots.filter((s) => s.ais === 'none').length} 無AIS`}
              </span>
              <button onClick={exportDetections} className="text-[10px] text-tactical-green active:scale-95">
                📤 匯出目標清單
              </button>
            </div>
            <div className="mt-1 flex max-h-32 flex-col gap-0.5 overflow-y-auto">
              {brightSpots.slice(0, 16).map((s, i) => {
                const col =
                  s.ais === 'none' ? 'text-tactical-alert' : s.ais === 'known' ? 'text-tactical-green' : 'text-tactical-cyan'
                return (
                  <button
                    key={i}
                    onClick={() => gotoCoord(s.lat, s.lng, 14)}
                    className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-left active:scale-95"
                  >
                    <span className={`font-mono text-[11px] font-bold ${col}`}>#{i + 1}</span>
                    <span className="flex-1 truncate text-[10px] text-slate-300">
                      {s.ais === 'none' ? '⚠無AIS' : s.ais === 'known' ? `✓${s.aisName || 'AIS'}` : ''} {s.cls}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-slate-500">~{Math.round(s.sizeM)}m</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          分析目前畫面：把暗海上突出目標畫框標注、估尺度分類，並與 AIS 比對——
          <b className="text-tactical-alert">紅框=無AIS訊號(可疑優先查)</b>、綠框=已知AIS。
          <b className="text-slate-400">輔助分流</b>，非確認身分；白浪/反光也可能中。
        </p>
      </div>

      {/* 以查詢座標（或我的位置）為中心，鎖定觀測日期開免費衛星檔案 */}
      <SatelliteQuickLinks
        lat={linkCenter?.lat}
        lng={linkCenter?.lng}
        date={observationDate}
        title={`🛰️ 外部全解析衛星檔案（${observationDate} · Sentinel 雷達/光學）`}
      />
    </div>
  )
}
