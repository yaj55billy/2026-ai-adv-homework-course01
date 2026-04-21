# CHANGELOG.md

## [Unreleased]

## [1.1.0] — 2026-04-21

### 新增

- ECPay AIO 全方位金流串接（測試環境）：支援信用卡、ATM 轉帳、網路 ATM
- `GET /ecpay/pay/:orderId`：驗證訂單後產生 AIO 表單參數（含 CheckMacValue SHA256 簽章），以 JSON 回傳供前端自動提交
- `POST /ecpay/return`：接收 ECPay 付款結果（OrderResultURL），依 RtnCode 更新訂單狀態
- `POST /ecpay/notify`：ReturnURL handler，回傳 `1|OK`
- `src/utils/ecpay.js`：CheckMacValue 計算、MerchantTradeNo 產生、AIO 參數組合等工具函式
- orders 表新增 `merchant_trade_no TEXT UNIQUE` 欄位，並支援 runtime migration（舊 DB 自動 ALTER TABLE）
- 訂單詳情頁 `?payment=atm_created` banner：提示用戶 ATM 虛擬帳號已開立，請在期限內完成轉帳

### 變更

- 訂單詳情頁「付款成功 / 付款失敗」模擬按鈕替換為「前往綠界付款」
- 訂單狀態為 `failed` 時仍顯示付款按鈕，允許重試（原先只有 `pending` 才顯示）
- `/ecpay/pay/:orderId` 改為 `status === 'paid'` 才拒絕，`failed` 訂單可重新發起付款

### 修正

- ATM / 網路 ATM 選擇後，因直接以 `queryTradeInfo` 的 TradeStatus 判斷（ATM 取號當下為 `0`），訂單被錯誤設為 `failed` — 改用 ECPay POST body 的 `RtnCode` 判斷，RtnCode=2 保持 `pending`

## [1.0.0] — 2026-04-19

### 新增

- 使用者認證系統（JWT，7 天效期）：註冊、登入、個人資料查詢
- 商品瀏覽：前台列表（分頁）與詳情頁
- 購物車雙模式：訪客（X-Session-Id）與會員（JWT）各自獨立管理
- 訂單建立：Transaction 一次性完成扣庫存、寫明細、清購物車
- 訂單付款模擬：支援 success / fail 兩種 action
- 後台商品 CRUD：新增、編輯、刪除（保護 pending 訂單商品）
- 後台訂單查詢：全站訂單列表與狀態篩選
- EJS 伺服器端渲染頁面：首頁、商品詳情、購物車、結帳、訂單列表、訂單詳情、後台
- Tailwind CSS 4.x 樣式系統
- Vitest + Supertest 整合測試（6 個測試檔案，固定執行順序）
- swagger-jsdoc OpenAPI 3.0 文件（`npm run openapi` 產生規格檔）
- SQLite WAL 模式與外鍵約束
- 8 筆花卉商品 seed 資料與 1 個管理員帳號 seed
