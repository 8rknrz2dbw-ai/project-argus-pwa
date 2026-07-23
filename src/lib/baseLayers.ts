import L from 'leaflet'

// ── 底圖圖層 ────────────────────────────────────────────────
//
// dark：CARTO dark_matter 戰術暗色（英文標註、全球）。
// nlsc：內政部國土測繪中心「通用版電子地圖」——繁體中文地名，官方免費，
//        涵蓋台灣及周邊海域（遠洋無資料）。海巡看得懂中文地名。
// nlscPhoto：NLSC 正射影像＋中文注記（衛星底＋中文地名）。

export type BaseLayerId = 'dark' | 'nlsc' | 'nlscPhoto' | 'satColor'

export const BASE_LABELS: Record<BaseLayerId, string> = {
  dark: '戰術暗色（英文）',
  nlsc: '中文電子地圖（NLSC）',
  nlscPhoto: '中文衛星混合（NLSC）',
  satColor: '彩色衛星（無雲 · 含外海 10m）',
}

export function buildBaseLayer(id: BaseLayerId): L.TileLayer {
  if (id === 'satColor') {
    // Sentinel-2 cloudless（EOX）：全球連續、無雲、含外海的 10m 彩色鑲嵌，
    // 當「主底圖」讓 AIS 船位/雷達/漁火/漂流全疊在真實影像上。
    // 選它的關鍵：不像 Esri 在外海/內陸偏遠處會出現白色「無資料」佔位塊——
    // 這是全球完整鑲嵌，外海也有圖；超過原生 16 層時平滑放大（會糊不會白）。
    const url =
      'https://tiles.maps.eox.at/wmts?layer=s2cloudless-2023_3857&style=default' +
      '&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0' +
      '&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'
    return L.tileLayer(url, {
      maxNativeZoom: 16,
      maxZoom: 20,
      attribution: 'Sentinel-2 cloudless 2023 © EOX（含 Copernicus 資料）',
    })
  }
  if (id === 'nlsc') {
    return L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: '© 內政部國土測繪中心 NLSC',
      // NLSC 只涵蓋台灣周邊，遠洋無圖磚；底下墊深色避免全白。
    })
  }
  if (id === 'nlscPhoto') {
    return L.tileLayer(
      'https://wmts.nlsc.gov.tw/wmts/PHOTO_MIX/default/GoogleMapsCompatible/{z}/{y}/{x}',
      {
        maxZoom: 20,
        attribution: '© 內政部國土測繪中心 NLSC（正射影像＋中文注記）',
      },
    )
  }
  // dark（預設）
  return L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    maxZoom: 19,
    detectRetina: false,
    className: 'base-tiles-tactical',
    attribution: '© OpenStreetMap © CARTO',
  })
}
