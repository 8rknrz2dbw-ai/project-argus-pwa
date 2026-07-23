import { useTacticalStore } from '../store/tacticalStore'
import type { TacticalMode } from '../types'

interface ModeDef {
  id: TacticalMode
  icon: string
  title: string
  subtitle: string
}

const MODES: ModeDef[] = [
  { id: 'orbit', icon: '🛰️', title: '軌道預警', subtitle: 'Orbit · 衛星軌跡' },
  { id: 'sar', icon: '🚢', title: '雷達盲搜', subtitle: 'SAR · AI 辨識' },
  { id: 'optical', icon: '🌤️', title: '岸際光學', subtitle: 'Optical · 低雲量' },
  { id: 'ais', icon: '📡', title: 'AIS 識別', subtitle: 'AIS · 即時船位' },
  { id: 'rescue', icon: '🆘', title: '搜救推演', subtitle: 'Rescue · 漂流預判' },
  { id: 'seastate', icon: '🌡️', title: '海況熱圖', subtitle: 'Sea · 海溫/浪高' },
  { id: 'envanim', icon: '🎬', title: '環境動畫', subtitle: 'Anim · 風/洋流時序' },
  { id: 'typhoon', icon: '🌀', title: '颱風路徑', subtitle: 'Typhoon · 暴風圈/路徑' },
]

/**
 * 三個「一鍵戰術模式」巨大按鈕。海上搖晃也好按。
 * 互斥：點一個就切換，同時只有一種模式亮起。
 */
export function ModeButtons() {
  const mode = useTacticalStore((s) => s.mode)
  const setMode = useTacticalStore((s) => s.setMode)

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
      {MODES.map((m) => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={[
              'flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-4 text-left transition-all',
              'min-w-[124px] md:min-w-0 md:flex-1',
              'active:scale-95 touch-manipulation min-h-[64px]',
              active
                ? 'border-tactical-cyan bg-tactical-cyan/15 shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                : 'border-slate-700 bg-tactical-panel/80 hover:border-slate-500',
            ].join(' ')}
          >
            <span className="text-2xl">{m.icon}</span>
            <span className="flex flex-col">
              <span
                className={`text-base font-bold ${active ? 'text-tactical-cyan' : 'text-slate-200'}`}
              >
                {m.title}
              </span>
              <span className="text-[11px] text-slate-400">{m.subtitle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
