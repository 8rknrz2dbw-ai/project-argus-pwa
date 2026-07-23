// ── 海象環境資料源 (Open-Meteo，免金鑰、免費) ────────────────
//
// 抓風（來向）、洋流（流向）、浪高。給風場箭頭、洋流箭頭、漂流預判用。
// Open-Meteo 有 CORS，瀏覽器可直接呼叫；支援多座標一次請求（grid 批次）。

export interface MarineEnv {
  lat: number
  lng: number
  /** 風速 m/s */
  windSpeed: number
  /** 風的來向（度，氣象慣例 from）。 */
  windDir: number
  /** 洋流速 m/s */
  currentSpeed: number
  /** 洋流流向（度，海洋慣例 toward）。 */
  currentDir: number
  /** 浪高 m */
  waveHeight: number
  /** 海表溫度 °C */
  sst: number
  /** 資料是否為即時抓取（false = 用了離線 fallback）。 */
  live: boolean
}

const WEATHER = 'https://api.open-meteo.com/v1/forecast'
const MARINE = 'https://marine-api.open-meteo.com/v1/marine'

/** 海上網路不穩時的溫和預設值（輕微西南風、微弱北向流）。 */
function fallback(lat: number, lng: number): MarineEnv {
  return { lat, lng, windSpeed: 5, windDir: 225, currentSpeed: 0.3, currentDir: 20, waveHeight: 1, sst: 26, live: false }
}

async function getJson(url: string, signal: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  return res.json()
}

/** 抓單一座標的完整海象（風 + 洋流 + 浪）。 */
export async function fetchEnvAt(lat: number, lng: number): Promise<MarineEnv> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const wUrl = `${WEATHER}?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
    const mUrl = `${MARINE}?latitude=${lat}&longitude=${lng}&current=ocean_current_velocity,ocean_current_direction,wave_height,sea_surface_temperature`
    const [w, m] = await Promise.all([getJson(wUrl, controller.signal), getJson(mUrl, controller.signal)])
    return {
      lat,
      lng,
      windSpeed: num(w?.current?.wind_speed_10m, 5),
      windDir: num(w?.current?.wind_direction_10m, 225),
      currentSpeed: kmhToMs(num(m?.current?.ocean_current_velocity, 1.08)),
      currentDir: num(m?.current?.ocean_current_direction, 20),
      waveHeight: num(m?.current?.wave_height, 1),
      sst: num(m?.current?.sea_surface_temperature, 26),
      live: true,
    }
  } catch {
    return fallback(lat, lng)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 批次抓一整個網格的海象（風場/洋流箭頭用）。
 * Open-Meteo 支援 comma 分隔多座標，一次請求拿回全部。
 */
export async function fetchEnvGrid(points: [number, number][]): Promise<MarineEnv[]> {
  if (points.length === 0) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  const lats = points.map((p) => p[0].toFixed(4)).join(',')
  const lngs = points.map((p) => p[1].toFixed(4)).join(',')
  try {
    const wUrl = `${WEATHER}?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`
    const mUrl = `${MARINE}?latitude=${lats}&longitude=${lngs}&current=ocean_current_velocity,ocean_current_direction,wave_height,sea_surface_temperature`
    const [w, m] = await Promise.all([getJson(wUrl, controller.signal), getJson(mUrl, controller.signal)])
    const wArr = Array.isArray(w) ? w : [w]
    const mArr = Array.isArray(m) ? m : [m]
    return points.map((p, i) => ({
      lat: p[0],
      lng: p[1],
      windSpeed: num(wArr[i]?.current?.wind_speed_10m, 5),
      windDir: num(wArr[i]?.current?.wind_direction_10m, 225),
      currentSpeed: kmhToMs(num(mArr[i]?.current?.ocean_current_velocity, 1.08)),
      currentDir: num(mArr[i]?.current?.ocean_current_direction, 20),
      waveHeight: num(mArr[i]?.current?.wave_height, 1),
      sst: num(mArr[i]?.current?.sea_surface_temperature, 26),
      live: true,
    }))
  } catch {
    return points.map((p) => fallback(p[0], p[1]))
  } finally {
    clearTimeout(timeout)
  }
}

function num(v: unknown, fallbackVal: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallbackVal
}
function kmhToMs(kmh: number): number {
  return kmh / 3.6
}
