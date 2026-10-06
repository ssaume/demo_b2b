# DEMO B2B 企業採購平台 v1.0.3

可部署到 **GitHub Pages（前端）＋ Google Apps Script（後端）＋ Google Sheets（資料庫）** 的第一版功能原型。無 npm 安裝、無打包依賴、無第三方字型或圖片服務。

產品系列及分類參考供應商公開資訊；DEMO 料號、配置、價格、MOQ、交期、物流及履約紀錄皆為示範。18 項示範配置涵蓋官網 11 個產品服務分類，並不代表完整正式 SKU 型錄。

## 快速體驗

解壓後用 Chrome / Edge 開啟 `preview.html`，直接操作本機示範。若瀏覽器不允許 file:// 保存資料，可先將前端檔案上傳 GitHub Pages。`preview.html` 是整合在單一檔案中的示範，正式部署請使用 `index.html` 及分開的 JS/CSS 檔。

| 角色 | 帳號 | 初始密碼 | 操作 |
|---|---|---|---|
| 企業採購端 | demo123 | 123456789 | 選購、下單、查看自己的訂單、中止審核中的明細 |
| 供應端 | ops123 | 123456789 | 查看所有客戶訂單、逐筆推進明細、記錄備料／生產／入庫／出貨、中止未出貨明細 |

登入頁帳密欄位為空，不顯示初始帳密或原型提示。頁面右上方「設定」可登出並切換角色。

## 已實作

- 登入後預設訂單管理，左側固定產品型錄分類；主區可切換產品樹狀圖。
- 訂單總覽、六種狀態篩選、訂單／PO／產品搜尋、分頁、履約進度。
- 產品示意、官方分類連結、MOQ 整數倍檢查、購物車合併同品。
- 依**產品類型**拆單，例如 MS300＋CP2000 同為變頻器，合併為一張含兩個 item 的訂單；伺服及軌道式電源各自拆一張。
- 每張訂單保留批次號、PO、聯絡人、收貨地址及需求日；每個 item 有獨立狀態、數量與歷史紀錄。
- 順序：審核中 → 已備料 → 生產中 → 已入庫 → 已出貨。訂單中止為分支終點。
- 全數完工後入庫，入庫後可分批出貨；尚未全數出貨的 item 維持已入庫。
- 後端價格核對、登入 session、角色及客戶資料隔離、重複下單防護、版本衝突檢查、ScriptLock。
- 30 秒背景同步；F5 保留登入、購物車及尚未確認結果的下單識別碼。
- 響應式版面、鍵盤可操作的表單、彈窗焦點循環及 Escape 關閉。

## 檔案

| 檔案 | 用途 |
|---|---|
| index.html、styles.css、app.js、domain.js、transport.js、config.js | GitHub Pages 前端，這六個檔案放在同一層 |
| .nojekyll | 讓 GitHub Pages 直接提供靜態檔案 |
| preview.html | 單檔本機示範，無需分開載入檔案 |
| gas/Code.gs | GAS API、認證、Sheets 存取與初始化 |
| gas/Domain.gs | 同一套生命週期規則，與 domain.js 完全相同 |
| gas/Bridge.html | GitHub Pages 與 GAS 的 iframe / postMessage 通訊 |
| gas/appsscript.json | GAS V8、時區、權限及部署設定 |
| docs/DEPLOYMENT.md | 完整部署步驟與故障排除 |
| docs/PROCESS_DESIGN.md | 狀態規則、欄位與資料模型 |
| docs/VALIDATION.md | 已執行的測試與部署後驗收 |
| tests/*.test.cjs | 無外部依賴的 Node 自動測試 |

## 部署摘要

1. GitHub 建立 repository，把六個前端檔案上傳 root，在 Settings → Pages 選 main / root。
2. GAS 建立專案，貼上 Code.gs、Domain.gs、Bridge.html 及 manifest，執行 `setup`。
3. GAS 指令碼屬性加入 `ALLOWED_ORIGINS=https://你的帳號.github.io`，部署成「以自己執行、所有人可存取」的網頁應用程式。
4. 將 `/exec` 網址填入 `config.js` 的 `gasUrl`，或在登入頁「設定 GAS 連線」貼上。
5. 用 demo123 下單，再以 ops123 推進明細，確認 Sheets 中有寫入且另一個瀏覽器能讀到。

詳細畫面操作、更新版本及常見問題請閱讀 `docs/DEPLOYMENT.md`。

## 技術邊界

此版沒有串接 SAP、MES、WMS、ATP、信用額度、正式報價、稅務、付款、發票、退貨或 SSO；所有履約更新由供應端手動填寫。不同商品的完整規格選型、客戶議價及合約尚未建模。

目前一個購物車批次的全部訂單，以一列 JSON 保存在 Google Sheets，適合低流量 POC；為避免單一儲存格超限，單批次 JSON 超過 45,000 字元會拒絕寫入。歷史與部分出貨很多的批次也會受此限制。大量交易應改為正式資料庫與事件紀錄。

GAS 初始密碼採 salt＋SHA-256 雜湊，並非適用於正式商用的強化身分系統。本機示範資料及示範登入由瀏覽器保存；連線模式由 GAS 驗證權限。正式導入前應換掉預設密碼及接上企業身分管理。

## 驗證

在本資料夾執行：

```bash
node --test tests/*.test.cjs
```

43 項自動測試通過，涵蓋共用流程規則、模擬 GAS／Sheets、來源驗證及前端 DOM 行為。已以匿名 HTTP 檢查目前部署的 GAS v1.0.2 健康檢測與 Bridge 內容；尚未在實際瀏覽器驗證登入、畫面及跨站 iframe 通訊。部署後的驗收清單附在 docs/VALIDATION.md。

## v1.0.2 更新

- 品牌與字樣改為 Demo，登入頁移除原型說明、初始帳密提示與預填值。
- 修正 iframe 在多層嵌入環境只回報最外層視窗的限制，改為指定來源的祖先與 opener 握手。
- 白名單不符及尚未初始化時立即回報原因。
- 連線設定支援公開的唯讀健康檢測；不提供帳號、密碼、token 或訂單資料。
- 使用者可點「以新視窗連線」，避開嵌入受限的環境；需要保留該連線視窗。
- 保留原瀏覽器連線設定、session 與購物車；原 DB_ID 及資料庫不需重建。
- 既有官方產品來源網址維持有效，網站顯示品牌改為 Demo。


## v1.0.3 更新與本次部署

- 修正連線計時器的 Window 接收者，避免 iframe、新視窗、請求與清理階段出現 Illegal invocation。
- 健康檢測沿用同樣的安全計時器封裝；檢測載入失敗不再直接推定為部署權限問題。
- index.html 加上 v1.0.3 靜態檔案版本參數，避免瀏覽器沿用舊 transport.js。
- 前端 v1.0.3 搭配 GAS v1.0.2；本次 GAS 程式與通訊規格保持 v1.0.2。
- 此包 config.js 已填入 ssaume.github.io/dcompany_b2b 目前使用的公開 GAS /exec 網址。其他網站部署時請換成自己的網址。
- 既有網站更新 index.html、transport.js、config.js 即可，其他前端檔案需保留同層。
- 詳見 docs/DEPLOYMENT.md 開頭的 v1.0.3 修正部署步驟。
