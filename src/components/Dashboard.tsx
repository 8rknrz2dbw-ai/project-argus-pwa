import { useState } from 'react'
import { useTacticalStore } from '../store/tacticalStore'
import { fmtClock, driftEpoch } from '../lib/timefmt'
import { ModeButtons } from './ModeButtons'
import { OpticalControls } from './OpticalControls'
import { SarControls } from './SarControls'
import { AisControls } from './AisControls'
import { RescueControls } from './RescueControls'
import { SeaStateControls } from './SeaStateControls'
import { EnvAnimControls } from './EnvAnimControls'
import { TyphoonControls } from './TyphoonControls'

/**
 * Dashboard —— 底部（手機）/ 左側（平板以上）的控制面板。
 * 依當前模式顯示對應的控制項；可收合以看清地圖。
 */
export function Dashboard() {
  const mode = useTacticalStore((s) => s.mode)
  const scrubHours = useTacticalStore((s) => s.scrubHours)
  const setScrubHours = useTacticalStore((s) => s.setScrubHours)
  const driftPoints = useTacticalStore((s) => s.driftPoints)
  const incidentTime = useTacticalStore((s) => s.incidentTime)
  const driftMode = useTacticalStore((s) => s.driftMode)
  const [collapsed, setCollapsed] = useState(false)

  const hasPanel =
    mode === 'optical' ||
    mode === 'sar' ||
    mode === 'ais' ||
    mode === 'rescue' ||
    mode === 'seastate' ||
    mode === 'envanim' ||
    mode === 'typhoon'
  // 收合時、搜救有結果 → 顯示浮動迷你時間軸（拉桿時不擋地圖）
  const showMiniScrub = collapsed && mode === 'rescue' && driftPoints.length > 0

  return (
    <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[1000] md:inset-y-0 md:left-0 md:right-auto md:w-80 md:p-4">
      <div className="pointer-events-auto flex flex-col gap-2 md:h-full md:justify-end">
        {/* 收合/展開條 */}
        {hasPanel && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg border border-slate-700 bg-tactical-panel/90 px-3 py-1.5 text-xs font-bold text-slate-200 active:scale-95"
            >
              {collapsed ? '▲ 展開控制面板' : '▾ 收合面板（看地圖）'}
            </button>
          </div>
        )}

        {/* 收合時的浮動迷你時間軸 */}
        {showMiniScrub && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-tactical-panel/95 px-3 py-2">
            <span className="shrink-0 font-mono text-[11px] text-amber-400">
              ⏱{' '}
              {scrubHours === 0
                ? '關'
                : fmtClock(driftEpoch(incidentTime, scrubHours, driftMode === 'backward', Date.now()))}
            </span>
            <input
              type="range"
              min={0}
              max={72}
              step={1}
              value={scrubHours}
              onChange={(e) => setScrubHours(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>
        )}

        {/* 模式專屬控制項：內容過高時本區塊自行捲動；收合時隱藏 */}
        {!collapsed && (
          <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto overscroll-contain md:max-h-[60vh]">
            {mode === 'optical' && <OpticalControls />}
            {mode === 'sar' && <SarControls />}
            {mode === 'ais' && <AisControls />}
            {mode === 'rescue' && <RescueControls />}
            {mode === 'seastate' && <SeaStateControls />}
            {mode === 'envanim' && <EnvAnimControls />}
            {mode === 'typhoon' && <TyphoonControls />}
          </div>
        )}

        {/* 戰術模式按鈕：永遠可見 */}
        <ModeButtons />
      </div>
    </div>
  )
}
