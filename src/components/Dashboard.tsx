import { useTacticalStore } from '../store/tacticalStore'
import { ModeButtons } from './ModeButtons'
import { OpticalControls } from './OpticalControls'
import { SarControls } from './SarControls'
import { AisControls } from './AisControls'
import { RescueControls } from './RescueControls'
import { SeaStateControls } from './SeaStateControls'

/**
 * Dashboard —— 底部（手機）/ 左側（平板以上）的控制面板。
 * 依當前模式顯示對應的控制項，保持畫面精簡。
 */
export function Dashboard() {
  const mode = useTacticalStore((s) => s.mode)

  return (
    <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[1000] md:inset-y-0 md:left-0 md:right-auto md:w-80 md:p-4">
      <div className="pointer-events-auto flex flex-col gap-2 md:h-full md:justify-end">
        {/* 模式專屬控制項：內容過高時本區塊自行捲動，不擠掉下方按鈕 */}
        <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto overscroll-contain md:max-h-[60vh]">
          {mode === 'optical' && <OpticalControls />}
          {mode === 'sar' && <SarControls />}
          {mode === 'ais' && <AisControls />}
          {mode === 'rescue' && <RescueControls />}
          {mode === 'seastate' && <SeaStateControls />}
        </div>

        {/* 戰術模式按鈕：永遠可見 */}
        <ModeButtons />
      </div>
    </div>
  )
}
