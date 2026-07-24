import { useTacticalStore } from '../store/tacticalStore'
import type { TacticalMode } from '../types'

interface ModeDef {
  id: TacticalMode
  icon: string
  title: string
  subtitle: string
}

const MODES: ModeDef[] = [
  { id: 'orbit', icon: '🛰️', title: '衛星過境', subtitle: 'Pass · 影像時機' },
  { id: 'sar', icon: '🚢', title: '雷達盲搜', subtitle: 'SAR · AI 辨識' },
  { id: 'optical', icon: '🌤️', title: '岸際光學', subtitle: 'Optical · 低雲量' },
  { id: 'ais', icon: '📡', title: 'AIS 識別', subtitle: 'AIS · 即時船位' },
  { id: 'rescue', icon: '🆘', title: '搜救推演', subtitle: 'Rescue · 漂流預判' },
  { id: 'seastate', icon: '🌡️', title: '海況熱圖', subtitle: 'Sea · 海溫/浪高' },
  { id: 'envanim', icon: '🎬', title: '環境動畫', subtitle: 'Anim · 風/洋流時序' },
  { id: 'typhoon', icon: '🌀', title: '颱風路徑', subtitle: 'Typhoon · 暴風圈/路徑' },
]

/**
 * 戰術模式切換。互斥：點一個就切換，同時只有一種模式亮起。
 * - strip（手機）：底部橫向大按鈕，海上搖晃也好按。
 * - rail（桌面）：最左側常駐直向圖示欄，善用寬螢幕、不佔地圖。
 */
export function ModeButtons({ variant = 'strip' }: { variant?: 'strip' | 'rail' }) {
  const mode = useTacticalStore((s) => s.mode)
  const setMode = useTacticalStore((s) => s.setMode)

  if (variant === 'rail') {
    return (
      <div className="flex flex-col gap-1">
        {MODES.map((m) => {
          const active = mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={`${m.title}｜${m.subtitle}`}
              className={[
                'flex w-16 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition-all active:scale-95',
                active
                  ? 'border-tactical-cyan bg-tactical-cyan/15 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                  : 'border-transparent hover:bg-slate-800/70',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <span className={`text-[9px] leading-tight ${active ? 'text-tactical-cyan' : 'text-slate-400'}`}>
                {m.title}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // strip（手機）：底部橫向捲動大按鈕
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {MODES.map((m) => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={[
              'flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-4 text-left transition-all',
              'min-w-[124px] active:scale-95 touch-manipulation min-h-[64px]',
              active
                ? 'border-tactical-cyan bg-tactical-cyan/15 shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                : 'border-slate-700 bg-tactical-panel/80 hover:border-slate-500',
            ].join(' ')}
          >
            <span className="text-2xl">{m.icon}</span>
            <span className="flex flex-col">
              <span className={`text-base font-bold ${active ? 'text-tactical-cyan' : 'text-slate-200'}`}>
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
