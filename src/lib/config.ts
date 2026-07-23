// ── Runtime 設定（金鑰）──────────────────────────────────────
//
// 讓使用者在 App 內直接貼金鑰（存在瀏覽器 localStorage），不必去 Vercel
// 改環境變數再重新部署 —— 對手機操作的海巡人員友善。
//
// 優先序：localStorage 使用者輸入 > 建置時的環境變數(VITE_*) > 空。

export interface RuntimeConfig {
  sentinelInstanceId: string
  sentinelWmsUrl: string
  edgeAiUrl: string
  aisKey: string
  /** 中央氣象署 (CWA) Open Data 授權碼。經 Worker 代理使用（CWA 無 CORS）。 */
  cwaKey: string
}

const LS_KEY = 'argus.config.v1'

const ENV = {
  sentinelInstanceId: (import.meta.env.VITE_SENTINEL_INSTANCE_ID as string) ?? '',
  sentinelWmsUrl:
    (import.meta.env.VITE_SENTINEL_WMS_URL as string) ?? 'https://sh.dataspace.copernicus.eu/ogc/wms',
  edgeAiUrl: (import.meta.env.VITE_EDGE_AI_URL as string) ?? '',
  aisKey: (import.meta.env.VITE_AISSTREAM_KEY as string) ?? '',
  cwaKey: (import.meta.env.VITE_CWA_KEY as string) ?? '',
}

function readLS(): Partial<RuntimeConfig> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    return {}
  }
}

/** 取得目前生效的設定（合併 localStorage 與 env）。 */
export function getConfig(): RuntimeConfig {
  const ls = readLS()
  return {
    sentinelInstanceId: ls.sentinelInstanceId?.trim() || ENV.sentinelInstanceId,
    sentinelWmsUrl: ls.sentinelWmsUrl?.trim() || ENV.sentinelWmsUrl,
    edgeAiUrl: ls.edgeAiUrl?.trim() || ENV.edgeAiUrl,
    aisKey: ls.aisKey?.trim() || ENV.aisKey,
    cwaKey: ls.cwaKey?.trim() || ENV.cwaKey,
  }
}

/** 儲存使用者輸入的設定。只存有填的欄位。 */
export function saveConfig(patch: Partial<RuntimeConfig>) {
  const cur = readLS()
  localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...patch }))
}

/** 清除使用者輸入，回到 env 預設。 */
export function clearConfig() {
  localStorage.removeItem(LS_KEY)
}

export const isSentinelConfigured = () => Boolean(getConfig().sentinelInstanceId)
export const isEdgeAiConfigured = () => Boolean(getConfig().edgeAiUrl)
export const isAisConfigured = () => Boolean(getConfig().aisKey)
/** CWA 需同時有 Worker 網址（代理 CORS）與授權碼才可用。 */
export const isCwaConfigured = () => {
  const c = getConfig()
  return Boolean(c.edgeAiUrl && c.cwaKey)
}
