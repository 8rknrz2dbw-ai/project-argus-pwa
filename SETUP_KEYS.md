# 🔑 金鑰申請一步步教學（手機就能做）

App 裡有個 **⚙️ 齒輪按鈕**（右上角），點開就能貼金鑰。金鑰只存在你手機瀏覽器，
不會上傳。以下三個都是**免費**的，申請到就貼進去、按「儲存並套用」即可。

> 提醒：🌬️ 風場、🌊 洋流、🆘 落海漂流預判**不需要任何金鑰**，本來就能用。

---

## 1. 🛰️ 真實衛星影像（Sentinel-2 光學 / Sentinel-1 雷達）

免費，用 Copernicus Data Space 帳號。

1. 手機瀏覽器開 **https://dataspace.copernicus.eu** → 右上 **Register** 註冊（免費）
2. 登入後開 **https://shapps.dataspace.copernicus.eu/dashboard/**
3. 左側 **Configuration Utility** → **＋ New configuration**（用 Python 或空白樣板都可）
4. 建好後，複製那一串 **Instance ID**（長得像 `12345678-abcd-...`）
5. 回 App → ⚙️ → 貼進 **Sentinel Hub Instance ID** → 儲存
6. 切到 🌤️ 岸際光學 或 🚢 雷達盲搜，就會出現真實衛星影像

> WMS 位址欄留預設即可（CDSE 免費版）。

## 2. 📡 真實 AIS 船舶

免費，用 aisstream.io。

1. 手機瀏覽器開 **https://aisstream.io** → **Sign up**（免費）
2. 登入後在 **API Keys** 頁 **Create new API Key**，複製那串金鑰
3. 回 App → ⚙️ → 貼進 **AISStream 金鑰** → 儲存
4. 切到 📡 AIS 識別，就會顯示台灣周邊的真實船位

## 3. 🤖 邊緣 AI 船隻辨識（進階，需要電腦部署）

這個需要用電腦部署 Cloudflare Worker（見 `cloudflare/README.md`），
部署完會拿到一個網址，貼進 App ⚙️ 的 **邊緣 AI Worker 網址** 即可。
沒有的話，🚢 雷達盲搜的 AI 會用示範偵測，流程一樣能走。

---

## 常見問題

- **貼了金鑰卻沒影像？** 該海域/日期可能沒衛星資料，換個日期或地點；或確認 Instance ID 沒貼錯。
- **要換手機？** 金鑰存在瀏覽器本機，換裝置要重貼一次。
- **安全嗎？** 金鑰不會傳到我們的伺服器，只存在你的裝置。真正機密的東西（如 CDSE 帳密）應放在 Cloudflare Worker，不要放前端。
