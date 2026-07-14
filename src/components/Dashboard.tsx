import { useTacticalStore } from '../store/tacticalStore'
import { ModeButtons } from './ModeButtons'
import { OpticalControls } from './OpticalControls'
import { SarControls } from './SarControls'

/**
 * Dashboard —— 底部（手機）/ 左側（平板以上）的控制面板。
 * 依當前模式顯示對應的控制項，保持畫面精簡。
 */
export function Dashboard() {
  const mode = useTacticalStore((s) => s.mode)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 md:inset-y-0 md:left-0 md:right-auto md:w-80 md:p-4">
      <div className="pointer-events-auto flex flex-col gap-3 md:h-full md:justify-end">
        {/* 模式專屬控制項（在按鈕上方浮現）*/}
        {mode === 'optical' && <OpticalControls />}
        {mode === 'sar' && <SarControls />}

        {/* 三大戰術模式按鈕 */}
        <ModeButtons />
      </div>
    </div>
  )
}
