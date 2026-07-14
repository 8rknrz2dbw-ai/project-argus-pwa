# Changelog

## v1.2.0-beta.1 — Tactical Earth Observation & Edge AI

### 新增
- Sentinel Hub / CDSE WMS 圖磚串接模組（支援 Sentinel-1 SAR 與 Sentinel-2 光學）。
- UI 面板：雲量篩選滑桿 (0%~100%) 與歷史觀測日期選擇器。
- 邊緣 AI 辨識架構（Cloudflare Worker proxy），接收 bbox 影像並回傳目標物件 GeoJSON。
- 三大「一鍵戰術模式」：軌道預警 / 雷達盲搜 / 岸際光學（互斥切換）。
- Web Worker 軌道運算 + Canvas 動態層（即時衛星白點與軌跡）。
- PWA 支援（manifest + service worker，OSM 底圖離線快取）。

### 優化
- LayerManager 記憶體回收：圖層關閉時強制 `remove()` 並清空 `_tiles` 快取，防手機發燙。
- Canvas 防爆：切離軌道模式呼叫 `cancelAnimationFrame()` + `worker.terminate()`，
  徹底中止渲染迴圈與背景執行緒（非 `display:none`）。
- 雲量過濾改為注入 WMS `MAXCC` 參數，交給 ESA 伺服器篩選。

### 修正 / 防錯
- 圖磚載入失敗（該區/時間無資料）加上 error handling 與透明替代圖，
  顯示「此區域/時間無可用影像」，不再出現破圖灰塊。
- 邊緣 AI 呼叫加上 8 秒 timeout 與錯誤回饋，海上網路不穩時 UI 不卡死。
- 未設定金鑰時顯示明確提示，而非嘗試載入而失敗。

### 設計決策（修正原規格的邏輯衝突）
- **互斥模式取代「60→10fps 降頻共存」**：原規格一邊要降頻共存、一邊要互斥關閉，
  兩者衝突。改採「同一時間只有一種重度資源」的互斥模式，更省電、邏輯更單純。
- **CDSE 需金鑰**：新版 Copernicus Data Space 的 WMS 需要 instance ID，
  改為 env 設定並提供 mock fallback，確保開箱即用。
- **輕量軌道模型**：Worker 內用圓軌道近似取代完整 SGP4，可無痛換成 satellite.js + 真 TLE。
