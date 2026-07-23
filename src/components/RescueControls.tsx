import { useState } from 'react'
import { useTacticalStore } from '../store/tacticalStore'
import { bearingToText, DRIFT_TARGETS } from '../lib/drift'
import { buildReport, shareReport } from '../lib/report'

/**
 * 搜救推演控制面板：顯示即時海象摘要 + 漂流結果，並提示操作。
 */
export function RescueControls() {
  const env = useTacticalStore((s) => s.rescueEnv)
  const drift = useTacticalStore((s) => s.driftPoints)
  const status = useTacticalStore((s) => s.rescueStatus)
  const mob = useTacticalStore((s) => s.manOverboard)
  const own = useTacticalStore((s) => s.ownPosition)
  const scrubHours = useTacticalStore((s) => s.scrubHours)
  const setScrubHours = useTacticalStore((s) => s.setScrubHours)
  const driftTargetId = useTacticalStore((s) => s.driftTargetId)
  const setDriftTarget = useTacticalStore((s) => s.setDriftTarget)
  const driftMode = useTacticalStore((s) => s.driftMode)
  const setDriftMode = useTacticalStore((s) => s.setDriftMode)
  const incidentTime = useTacticalStore((s) => s.incidentTime)
  const setIncidentTime = useTacticalStore((s) => s.setIncidentTime)
  const showProbability = useTacticalStore((s) => s.showProbability)
  const setShowProbability = useTacticalStore((s) => s.setShowProbability)
  const showSearchPattern = useTacticalStore((s) => s.showSearchPattern)
  const setShowSearchPattern = useTacticalStore((s) => s.setShowSearchPattern)
  const trackSpacingNm = useTacticalStore((s) => s.trackSpacingNm)
  const setTrackSpacingNm = useTacticalStore((s) => s.setTrackSpacingNm)
  const reverse = driftMode === 'backward'
  const setMob = useTacticalStore((s) => s.setManOverboard)
  const setResult = useTacticalStore((s) => s.setRescueResult)
  const setStatus = useTacticalStore((s) => s.setStatus)

  const mcSummary = useTacticalStore((s) => s.mcSummary)
  const tide = useTacticalStore((s) => s.cwaTide)
  const driftTargetLabel =
    DRIFT_TARGETS.find((t) => t.id === driftTargetId)?.label ?? '落海人'

  // 手動輸入座標（實戰時座標常由無線電報來）
  const [manual, setManual] = useState(false)
  const [latStr, setLatStr] = useState('')
  const [lngStr, setLngStr] = useState('')
  const placeByCoord = () => {
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setMob({ lat, lng })
      setManual(false)
    } else {
      setStatus('⚠ 座標格式錯誤（緯度 -90~90、經度 -180~180）')
    }
  }

  const clear = () => {
    setMob(null)
    setResult(null, [])
    setScrubHours(0)
    setShowProbability(false)
    setShowSearchPattern(false)
    setStatus('搜救推演模式：點地圖標記落海點，計算漂流')
  }

  const share = async () => {
    if (!mob || !env) return
    const text = buildReport({
      mob,
      env,
      drift,
      reverse,
      targetLabel: driftTargetLabel,
      mc: mcSummary ? { peak: mcSummary.peak, radius95: mcSummary.radius95 } : null,
    })
    const how = await shareReport(text)
    setStatus(how === 'shared' ? '報告已分享' : how === 'copied' ? '報告已複製到剪貼簿' : '⚠ 分享失敗')
  }

  // 我的位置到落海點的距離（浬）
  const distNm =
    own && mob ? haversineNm(own.lat, own.lng, mob.lat, mob.lng) : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-tactical-panel/90 p-3">
      {/* 順推 / 逆推 切換 */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-700 p-1">
        <button
          onClick={() => setDriftMode('forward')}
          className={`rounded py-1.5 text-xs font-bold transition-all active:scale-95 ${
            !reverse ? 'bg-tactical-alert/20 text-tactical-alert' : 'text-slate-400'
          }`}
        >
          順推 · 落海→漂到哪
        </button>
        <button
          onClick={() => setDriftMode('backward')}
          className={`rounded py-1.5 text-xs font-bold transition-all active:scale-95 ${
            reverse ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400'
          }`}
        >
          逆推 · 發現→從哪來
        </button>
      </div>

      {/* 回報/落海時間（可為過去，用逐時歷史海象積分）*/}
      {!reverse && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400">🕐 回報/落海時間</span>
            <button
              onClick={() => setIncidentTime(Date.now())}
              className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300 active:scale-95"
            >
              設為現在
            </button>
          </div>
          <input
            type="datetime-local"
            max={toLocalInput(Date.now())}
            value={toLocalInput(incidentTime)}
            onChange={(e) => {
              const t = new Date(e.target.value).getTime()
              if (Number.isFinite(t)) setIncidentTime(t)
            }}
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {elapsedHint(incidentTime)}
            ｜用「該時刻到現在」的逐時真實海流/風積分，⌖綠圈=目標現在位置
          </p>
        </div>
      )}

      {/* 手動輸入座標 */}
      <div>
        <button
          onClick={() => setManual(!manual)}
          className="text-[11px] text-tactical-cyan underline-offset-2 hover:underline"
        >
          {manual ? '▾ 手動輸入座標' : '▸ 手動輸入座標（無線電報座標）'}
        </button>
        {manual && (
          <div className="mt-1 flex items-center gap-1">
            <input
              inputMode="decimal"
              placeholder="緯度 24.5"
              value={latStr}
              onChange={(e) => setLatStr(e.target.value)}
              className="w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200"
            />
            <input
              inputMode="decimal"
              placeholder="經度 122.0"
              value={lngStr}
              onChange={(e) => setLngStr(e.target.value)}
              className="w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200"
            />
            <button
              onClick={placeByCoord}
              className="shrink-0 rounded border border-tactical-cyan bg-tactical-cyan/10 px-2 py-1.5 text-xs font-bold text-tactical-cyan active:scale-95"
            >
              標記
            </button>
          </div>
        )}
      </div>

      {!mob && (
        <p className="text-xs leading-relaxed text-slate-300">
          {reverse ? (
            <>
              🔎 <b className="text-amber-400">點地圖上「發現漂流物 / 目擊」的位置</b>，
              系統回推當初可能的落海來源與範圍。
            </>
          ) : (
            <>
              🆘 <b className="text-tactical-alert">點地圖上的落海位置</b>，系統用風場＋洋流
              預判漂流方向與搜索範圍。
            </>
          )}
        </p>
      )}

      {/* 漂流物體類型（不同風壓係數）*/}
      <div>
        <div className="mb-1 text-[11px] font-semibold text-slate-400">漂流物體類型</div>
        <div className="grid grid-cols-3 gap-1">
          {DRIFT_TARGETS.map((t) => {
            const active = driftTargetId === t.id
            return (
              <button
                key={t.id}
                onClick={() => setDriftTarget(t.id, t.leeway)}
                className={[
                  'flex flex-col items-center rounded border py-1.5 text-[10px] transition-all active:scale-95',
                  active
                    ? 'border-tactical-alert bg-tactical-alert/15 text-tactical-alert'
                    : 'border-slate-700 bg-slate-900/60 text-slate-400',
                ].join(' ')}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 海象摘要 */}
      {env && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="🌬 風" value={`${env.windSpeed.toFixed(1)} m/s`} sub={`來自${bearingToText(env.windDir)}`} />
          <Stat
            label="🌊 洋流"
            value={`${env.currentSpeed.toFixed(2)} m/s`}
            sub={`往${bearingToText(env.currentDir)}`}
          />
          <Stat label="〰 浪高" value={`${env.waveHeight.toFixed(1)} m`} sub={env.live ? '即時' : '離線值'} />
        </div>
      )}

      {/* CWA 在地潮汐（近岸擱淺/潮流窗口）*/}
      {mob && tide && tide.length > 0 && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-300">🌙 潮汐（CWA · {tide[0].station}）</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {tide.slice(0, 4).map((e, i) => (
              <div key={i} className="flex justify-between font-mono text-[11px]">
                <span className={e.type.includes('滿') || e.type.includes('高') ? 'text-sky-200' : 'text-slate-400'}>
                  {e.type.includes('滿') || e.type.includes('高') ? '▲ 滿潮' : '▼ 乾潮'}
                </span>
                <span className="text-slate-300">{tideClock(e.time)}</span>
                <span className="text-slate-500">
                  {e.heightCm != null ? `${e.heightCm > 0 ? '+' : ''}${Math.round(e.heightCm)} cm` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 漂流結果 */}
      {status === 'loading' && <p className="text-xs text-tactical-cyan">計算漂流中…</p>}
      {status === 'done' && drift.length > 0 && (
        <div className="flex flex-col gap-1 rounded border border-rose-500/40 bg-rose-500/5 p-2">
          <div className="mb-1 text-[11px] font-semibold text-tactical-alert">
            {reverse ? '回推來源（浬）' : '漂流預判（浬）'}
          </div>
          {drift.map((p) => (
            <div key={p.hours} className="flex justify-between font-mono text-[11px] text-slate-300">
              <span className="text-tactical-alert">
                {p.hours}h {reverse ? '前' : '後'}
              </span>
              <span>
                {bearingToText(p.bearingDeg)}方 {(p.driftMeters / 1852).toFixed(1)} 浬
              </span>
              <span className="text-slate-400">半徑 {(p.radiusMeters / 1852).toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 蒙地卡羅機率密度圖 (SAROPS 式) */}
      {status === 'done' && drift.length > 0 && (
        <button
          onClick={() => setShowProbability(!showProbability)}
          className={[
            'rounded-lg border px-3 py-2 text-xs font-bold transition-all active:scale-95',
            showProbability
              ? 'border-tactical-alert bg-tactical-alert/20 text-tactical-alert'
              : 'border-slate-600 bg-slate-900/60 text-slate-300',
          ].join(' ')}
        >
          🎲 {showProbability ? '關閉機率圖' : '蒙地卡羅機率搜索圖 (SAROPS式)'}
        </button>
      )}
      {showProbability && (
        <p className="-mt-1 text-[10px] leading-relaxed text-slate-500">
          在標記點周圍灑 1200 個亂數粒子，各依偏航±風壓差+風流漂流，紅=機率最高、◎=峰值。
          比單一圈更貼近真實搜索範圍（依國研院海洋中心搜救科學方法）。
        </p>
      )}

      {/* 平行梳掃搜索航線 */}
      {status === 'done' && drift.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowSearchPattern(!showSearchPattern)}
            className={[
              'rounded-lg border px-3 py-2 text-xs font-bold transition-all active:scale-95',
              showSearchPattern
                ? 'border-tactical-cyan bg-tactical-cyan/20 text-tactical-cyan'
                : 'border-slate-600 bg-slate-900/60 text-slate-300',
            ].join(' ')}
          >
            🧭 {showSearchPattern ? '關閉搜索航線' : '產生搜索航線 (平行梳掃)'}
          </button>
          {showSearchPattern && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">航線間距</span>
              {[0.5, 1, 2].map((nm) => (
                <button
                  key={nm}
                  onClick={() => setTrackSpacingNm(nm)}
                  className={`rounded border px-2 py-1 font-mono text-[11px] active:scale-95 ${
                    trackSpacingNm === nm
                      ? 'border-tactical-cyan text-tactical-cyan'
                      : 'border-slate-600 text-slate-400'
                  }`}
                >
                  {nm} 浬
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 時間軸拉桿：拉到任意時間看漂流位置 */}
      {status === 'done' && drift.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-semibold text-amber-400">
              ⏱ 時間軸（{reverse ? '往前回推' : '落海後經過'}）
            </label>
            <span className="font-mono text-[11px] text-amber-400">
              {scrubHours === 0 ? '關' : `${scrubHours} 小時${reverse ? '前' : '後'}`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={72}
            step={1}
            value={scrubHours}
            onChange={(e) => setScrubHours(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            可拉到 72 小時（3 天）。超過數小時為近似，風流會隨時間變化。
          </p>
        </div>
      )}

      {/* 我的位置 → 落海點 距離 */}
      {distNm !== null && (
        <div className="flex items-center justify-between rounded border border-sky-500/40 bg-sky-500/5 px-2 py-1.5 text-[11px]">
          <span className="text-sky-300">📍 我 → {reverse ? '發現點' : '落海點'}</span>
          <span className="font-mono text-sky-200">{distNm.toFixed(1)} 浬</span>
        </div>
      )}

      {mob && (
        <div className="flex gap-2">
          {status === 'done' && drift.length > 0 && (
            <button
              onClick={share}
              className="flex-1 rounded border border-tactical-green/50 bg-tactical-green/10 py-1.5 text-xs font-semibold text-tactical-green active:scale-95"
            >
              📋 產生並分享報告
            </button>
          )}
          <button
            onClick={clear}
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 active:scale-95"
          >
            ✕ 清除
          </button>
        </div>
      )}

      {/* 圖例 */}
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span>
          <span className="text-tactical-green">▬</span> 洋流
        </span>
        <span>
          <span className="text-tactical-cyan">┄</span> 風向
        </span>
        <span>
          <span className="text-tactical-alert">◯</span> 搜索範圍
        </span>
      </div>
    </div>
  )
}

/** 潮汐時間顯示（月/日 時:分）。 */
function tideClock(epoch: number): string {
  const d = new Date(epoch)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

/** epoch → datetime-local input 字串（本地時區）。 */
function toLocalInput(epoch: number): string {
  const d = new Date(epoch - new Date(epoch).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}
/** 距今多久的提示。 */
function elapsedHint(epoch: number): string {
  const h = (Date.now() - epoch) / 3600000
  if (h < 0.5) return '即時（現在）'
  if (h < 24) return `回報距今約 ${h.toFixed(1)} 小時`
  return `回報距今約 ${(h / 24).toFixed(1)} 天`
}

/** 兩點大圓距離（海浬）。 */
function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const d = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * d) / 2) ** 2 +
    Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lng2 - lng1) * d) / 2) ** 2
  return (2 * R * Math.asin(Math.sqrt(a))) / 1852
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 py-1.5">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-mono text-sm font-bold text-tactical-green">{value}</div>
      <div className="text-[9px] text-slate-500">{sub}</div>
    </div>
  )
}
