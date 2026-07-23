// ── 時間格式化（搜救時間軸/漂流標籤用）─────────────────────

/** epoch → 「M/D HH:mm」。 */
export function fmtClock(epoch: number): string {
  const d = new Date(epoch)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

/** epoch → 「M/D HH時」（地圖標籤用，較短）。 */
export function fmtClockShort(epoch: number): string {
  const d = new Date(epoch)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}時`
}

/**
 * 漂流時刻換算：forward=回報時間 + hours；reverse=現在 - hours。
 * 回傳該漂流點對應的實際 epoch。
 */
export function driftEpoch(
  incidentTime: number,
  hours: number,
  reverse: boolean,
  now: number,
): number {
  return reverse ? now - hours * 3600000 : incidentTime + hours * 3600000
}
