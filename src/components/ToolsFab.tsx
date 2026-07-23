import { useTacticalStore } from '../store/tacticalStore'

/**
 * 工具列開關（🧰）。收合時只露出「設定 ⚙️」與此鈕；展開才顯示其餘工具鈕
 * （定位/離線/領海/座標/量測），讓手機版面清爽。
 */
export function ToolsFab() {
  const expanded = useTacticalStore((s) => s.toolsExpanded)
  const toggle = useTacticalStore((s) => s.toggleTools)

  return (
    <button
      onClick={toggle}
      className={`safe-float-top2 pointer-events-auto absolute z-[1100] flex h-11 w-11 items-center justify-center rounded-full border text-lg active:scale-95 ${
        expanded
          ? 'border-tactical-cyan bg-tactical-cyan/20 text-tactical-cyan'
          : 'border-slate-600 bg-tactical-panel/90'
      }`}
      aria-label="工具列"
      title={expanded ? '收合工具' : '展開工具（定位/離線/領海/座標/量測）'}
    >
      {expanded ? '✕' : '🧰'}
    </button>
  )
}
