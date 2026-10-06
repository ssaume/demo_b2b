# Demo B2B 企業採購與供應協作平台 v1.0.3.1

部署方式：GitHub Pages 前端＋Google Apps Script 後端＋Google Sheets 資料庫。此版依使用者指定的版本號更新；前後端都需更新至 v1.0.3.1。

## 本版功能

1. 採購端上方統計卡、生命週期狀態與下方清單連動；切換狀態時回到第 1 頁，保留搜尋條件。
2. 供應端預設「供應需求管理」，以需求量、尚待交付量、供應階段與交期檢視對應客戶需求。
3. 三個供應帳號分別負責不同產品，GAS 同時限制需求查詢、型錄與生命週期更新。
4. 供應計畫模擬，可選擇負責的需求和 item，再切換單據／供應網路視角。
5. 供應網路含材料採購、內部製造、外包製造、組裝檢驗、入庫及交付。調整材料前置期、外包比例與可用產能後，重新推估交期和負荷。
6. 資源利用率提供「與我相關／所有資源」、資源類型、7／14／28 天期間；全體視角只提供彙總負荷。
7. 管理頁主要字體、表格、狀態與明細字體加大。

## 帳號

| 角色／供應組 | 帳號 | 新建時的初始密碼 | 負責產品 |
|---|---|---|---|
| 採購端 | demo123 | 123456789 | 全型錄採購，只看自己的訂單 |
| 運動控制供應組 | supplier01 | 123456789 | 變頻器、伺服系統 |
| 控制設備供應組 | supplier02 | 123456789 | PLC、人機介面、樓宇控制 |
| 電源與設備供應組 | supplier03 | 123456789 | 電源、零組件、散熱、充電設備、UPS、通訊電源、能源、生醫、顯像 |

升級時 setup 保留既有帳號密碼與訂單；已存在的供應帳號不會被重設密碼或重新啟用。舊 ops123 會停用，歷史操作紀錄保留。登入頁維持空白帳密，沒有帳號密碼提示。

## 既有網站升級

**這版需更新 GAS，並在編輯器執行 setup 建立三個供應帳號。** 新增的供應分工規則不會只靠更新前端生效。

1. GAS 更新 Code.gs、Domain.gs、Bridge.html、appsscript.json；新增 Supply 指令碼並貼上 gas/Supply.gs。
2. 保留 DB_ID 與 ALLOWED_ORIGINS，在編輯器執行 setup，開啟執行紀錄的資料庫連結確認 Users 的三個帳號。
3. 部署 → 管理部署作業 → 目前部署 → 編輯 → 新版本 → 部署。
4. GitHub root 上傳 index.html、styles.css、app.js、domain.js、supply.js、transport.js、config.js 及 .nojekyll。
5. 等 Pages 部署成功，Ctrl＋Shift＋R，確認連線設定的 /exec 網址，測試連線應顯示 1.0.3.1，再登入。

config.js 已填入 ssaume.github.io/dcompany_b2b 目前使用的公開 /exec。若更換過部署網址，請改成自己的網址。完整步驟見 docs/DEPLOYMENT.md。

## 檔案與預覽

| 檔案 | 用途 |
|---|---|
| index.html、styles.css、app.js、domain.js、supply.js、transport.js、config.js | 前端：放在 GitHub repository 最上層 |
| gas/Code.gs | GAS API、登入、資料隔離、Sheets 存取與安全升級 |
| gas/Domain.gs | 訂單與明細生命週期；與 domain.js 一致 |
| gas/Supply.gs | 供應分工、資源、模擬規則；與 supply.js 一致 |
| gas/Bridge.html | 指定來源的 iframe／新視窗訊息通道 |
| gas/appsscript.json | 既有 Sheets 與管理身分權限、V8、時區 |
| preview.html | 可離線操作的單檔示範，內嵌設定的 gasUrl 為空 |
| docs/DEPLOYMENT.md | 更新與全新部署流程 |
| docs/PROCESS_DESIGN.md | 資料、權限及模擬假設 |
| docs/VALIDATION.md | 測試與部署後驗收 |

## 模擬範圍

供應途程、單位工時、材料前置期和能力為示範參數。單據視角讀取實際資料庫紀錄；供應網路細部階段由 item 狀態推估，尚未串接 BOM、正式採購單、外包單、ERP 或 APS。

交期按本明細剩餘途程推估，未進行跨需求的有限產能排程。利用率可超過 100%，代表負荷超過規劃能力。模擬參數存在當次瀏覽器狀態，不改寫正式狀態或訂單。

原有同類產品拆單、明細生命週期、部分出貨、客戶隔離、重複下單防護、revision 衝突防護、30 秒同步與修正過的 Window 計時器都保留。

## 驗證

執行 `node --test tests/*.test.cjs`：57 項通過。涵蓋供應權限隔離、升級保留資料、計算、狀態篩選、雙視角與資源篩選。GAS／DOM 使用模擬環境；本版尚未由工具部署到使用者帳號，也尚未以實際瀏覽器驗證新畫面。
