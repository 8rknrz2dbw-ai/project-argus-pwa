import L from 'leaflet'

// ── 底圖圖層 ────────────────────────────────────────────────
//
// dark：CARTO dark_matter 戰術暗色（英文標註、全球）。
// nlsc：內政部國土測繪中心「通用版電子地圖」——繁體中文地名，官方免費，
//        涵蓋台灣及周邊海域（遠洋無資料）。海巡看得懂中文地名。
// nlscPhoto：NLSC 正射影像＋中文注記（衛星底＋中文地名）。

export type BaseLayerId = 'dark' | 'nlsc' | 'nlscPhoto' | 'esriPhoto'

export const BASE_LABELS: Record<BaseLayerId, string> = {
  dark: '戰術暗色（英文）',
  nlsc: '中文電子地圖（NLSC）',
  nlscPhoto: '中文衛星混合（NLSC）',
  esriPhoto: '彩色高清衛星（Esri · 全球含外海）',
}

export function buildBaseLayer(id: BaseLayerId): L.TileLayer {
  if (id === 'esriPhoto') {
    // Esri World Imagery：全球彩色高解析空拍/衛星鑲嵌，含外海。當「主底圖」，
    // 讓 AIS 船位、雷達、漁火、漂流全疊在真實影像上——照片若拍到船，
    // 旁邊剛好有 AIS 三角形就能直接指認。放大到岸際最銳利。
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
    )
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
