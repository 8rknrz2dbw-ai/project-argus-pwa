import L from 'leaflet'

// ── NASA GIBS 免金鑰衛星影像 ────────────────────────────────
//
// GIBS（Global Imagery Browse Services）提供全球每日真彩色衛星影像，
// 完全免金鑰、免註冊、免設定。解析度約 250m（MODIS），適合當「開箱即用」
// 的光學影像。想要更高解析度（10m）再接 Sentinel-2。
//
// 影像有幾小時延遲，所以「今天」可能還沒好；用昨天或前幾天最保險。

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** 真彩色圖層（MODIS Terra，每日更新）。 */
export function buildGibsTrueColor(date: string): L.TileLayer {
  const layer = 'MODIS_Terra_CorrectedReflectance_TrueColor'
  const url = `${GIBS_BASE}/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  return L.tileLayer(url, {
    // MODIS 原生最高到第 9 層（約 250m），再放大由 Leaflet 內插
    maxNativeZoom: 9,
    maxZoom: 19,
    bounds: [
      [-85.05, -180],
      [85.05, 180],
    ],
    attribution: 'Imagery © NASA EOSDIS GIBS · MODIS',
    className: 'gibs-imagery',
  })
}
