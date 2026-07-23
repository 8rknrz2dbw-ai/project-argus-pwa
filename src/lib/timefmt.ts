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
 * 漂流時刻換算（以 datum=回報/落海時間為基準）：
 * forward=datum + hours；reverse(來源)=datum − hours。
 */
export function driftEpoch(incidentTime: number, hours: number, reverse: boolean): number {
  return incidentTime + (reverse ? -1 : 1) * hours * 3600000
}
