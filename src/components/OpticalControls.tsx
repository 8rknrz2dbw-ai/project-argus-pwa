import { useState } from 'react'
import { useTacticalStore } from '../store/tacticalStore'
import { isSentinelConfigured } from '../lib/sentinel'
import { SatelliteQuickLinks } from './SatelliteQuickLinks'

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
  const setFlyTo = useTacticalStore((s) => s.setFlyTo)
  const setStatus = useTacticalStore((s) => s.setStatus)
  const today = new Date().toISOString().slice(0, 10)
  const hd = isSentinelConfigured()

  // 座標查詢：輸入經緯度 → 地圖飛過去 + 影像連結以此為中心
  const [qLat, setQLat] = useState('')
  const [qLng, setQLng] = useState('')
  const queried =
    Number.isFinite(parseFloat(qLat)) && Number.isFinite(parseFloat(qLng))
      ? { lat: parseFloat(qLat), lng: parseFloat(qLng) }
      : null
  const goToCoord = () => {
    if (queried && Math.abs(queried.lat) <= 90 && Math.abs(queried.lng) <= 180) {
      setFlyTo({ lat: queried.lat, lng: queried.lng, zoom: 11 })
      setStatus(`已跳到 ${queried.lat.toFixed(3)}, ${queried.lng.toFixed(3)}｜選日期看當時影像`)
    } else {
      setStatus('⚠ 座標格式錯誤（緯度 -90~90、經度 -180~180）')
    }
  }
  const linkCenter = queried ?? own ?? undefined

  const SRC_INFO: Record<string, string> = {
    esri: '高解析空拍鑲嵌 · 岸際/島礁最銳利（可放大到 ~z19，非每日、非即時）',
    eox: 'Sentinel-2 無雲真彩色 · 10m 乾淨平滑、無雲遮蔽（年度合成，非每日）',
    nasa: 'NASA MODIS 每日真彩色 · 約 250m，放大會馬賽克（可選歷史日期）',
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

      {/* 座標查詢：輸入座標跳過去，配合下方日期看「當時影像」*/}
      <div className="rounded-lg border border-tactical-cyan/30 bg-tactical-cyan/5 p-2">
        <div className="mb-1 text-[11px] font-semibold text-tactical-cyan">
          📍 座標 + 日期查詢當時影像
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
            跳過去
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          輸入座標→跳到該點；再選下方<b className="text-slate-400">觀測日期</b>＝App 內看當日 MODIS，
          下方衛星連結則鎖定該日的 Sentinel（10m）。
        </p>
      </div>

      {/* 免金鑰時可三選一：高解析空拍 / Sentinel-2無雲 / 每日MODIS */}
      {!hd && (
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-700 p-1">
          {(
            [
              ['esri', '高解析', '空拍'],
              ['eox', '無雲', 'S2·10m'],
              ['nasa', '每日', 'MODIS'],
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

      <div>
        <label className="mb-1 block text-xs font-semibold text-tactical-green">
          📅 觀測日期
        </label>
        <input
          type="date"
          max={today}
          value={observationDate}
          onChange={(e) => setObservationDate(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-200"
        />
      </div>

      {/* 以查詢座標（或我的位置）為中心，鎖定觀測日期開免費衛星檔案 */}
      <SatelliteQuickLinks
        lat={linkCenter?.lat}
        lng={linkCenter?.lng}
        date={observationDate}
        title={`🛰️ ${observationDate} 當日影像（雷達/高解析檔案）`}
      />
    </div>
  )
}
