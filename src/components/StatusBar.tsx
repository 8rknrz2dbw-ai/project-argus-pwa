import { useTacticalStore } from '../store/tacticalStore'

const MODE_LABEL: Record<string, string> = {
  orbit: 'ORBIT',
  sar: 'SAR',
  optical: 'OPTICAL',
  ais: 'AIS',
  rescue: 'RESCUE',
}

/** 頂部狀態列：模式指示 + 即時訊息（給海上人員的單行回饋）。 */
export function StatusBar() {
  const mode = useTacticalStore((s) => s.mode)
  const statusMessage = useTacticalStore((s) => s.statusMessage)

  return (
    <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center gap-3 bg-gradient-to-b from-slate-900/95 to-transparent px-4 py-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tactical-green opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-tactical-green" />
        </span>
        <span className="font-mono text-xs font-bold tracking-widest text-tactical-green">
          阿爾戈斯 · {MODE_LABEL[mode]}
        </span>
        <span className="font-mono text-[9px] text-slate-500">v1.6.1</span>
      </div>
      <span className="truncate font-mono text-[11px] text-slate-300">{statusMessage}</span>
    </div>
  )
}
