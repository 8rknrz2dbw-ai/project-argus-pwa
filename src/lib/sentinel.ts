// ── Sentinel Hub / CDSE WMS 圖磚模組 ────────────────────────
//
// 我們不自己算雲量：直接在 WMS 請求注入 MAXCC 參數，交給歐洲太空總署
// 的伺服器篩選好再回傳。同理 Sentinel-1 SAR 也是走 WMS layer。

import { getConfig, isSentinelConfigured } from './config'

/** 是否已設定金鑰。未設定時 UI 要顯示提示，而不是嘗試載入而破圖。 */
export { isSentinelConfigured }

export interface SentinelOptions {
  /** WMS layer 名稱，例如 'TRUE-COLOR-S2L2A'（光學）或 'SAR-VV'（雷達）。 */
  layer: string
  /** 觀測日期 YYYY-MM-DD。 */
  date: string
  /** 最大雲量 %（只對光學有意義；SAR 忽略）。 */
  maxCloudCover?: number
}

/**
 * 組出 Leaflet L.tileLayer.wms 需要的 base URL 與 params。
 * TIME 參數用單一日期（該日的影像）；MAXCC 交給伺服器過濾雲量。
 */
export function buildWmsConfig(opts: SentinelOptions): {
  url: string
  params: Record<string, string | number | boolean>
} {
  const cfg = getConfig()
  const url = `${cfg.sentinelWmsUrl}/${cfg.sentinelInstanceId || 'MISSING_INSTANCE_ID'}`
  const params: Record<string, string | number | boolean> = {
    layers: opts.layer,
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    time: opts.date,
  }
  if (typeof opts.maxCloudCover === 'number') {
    params.maxcc = opts.maxCloudCover // ← 雲量過濾交給 ESA 伺服器
  }
  return { url, params }
}

/** 預設的 WMS layer 名稱（可依你的 Sentinel Hub configuration 調整）。 */
export const LAYERS = {
  opticalTrueColor: 'TRUE-COLOR-S2L2A', // Sentinel-2 光學
  sarVV: 'SAR-VV', // Sentinel-1 雷達
} as const
