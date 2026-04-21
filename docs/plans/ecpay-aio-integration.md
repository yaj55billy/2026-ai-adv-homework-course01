# ECPay AIO 金流串接計畫

## Context

花卉電商目前的「付款成功/失敗」是模擬按鈕。本次要替換為真實的綠界 AIO 金流，讓用戶在訂單詳情頁點擊後跳轉至綠界付款頁完成交易。由於專案僅運行於本機（localhost:3001），無法接收綠界 ReturnURL 的伺服器推播；付款結果確認改為由後端主動呼叫 `QueryTradeInfo` API 查詢並驗證。

---

## 技術方案

**使用 AIO 全方位金流**（guides/01），理由：SSR+表單跳轉最簡單，不需 JS SDK，符合現有架構。

**付款確認策略**：
- `ReturnURL` = `http://localhost:3001/ecpay/notify`（ECPay 呼叫不到，回傳 `1|OK` 即可）
- `OrderResultURL` = `http://localhost:3001/ecpay/return`（瀏覽器跳轉，localhost 可用）
- 在 `/ecpay/return` 收到瀏覽器轉址後，後端主動呼叫 `QueryTradeInfo` 驗證付款狀態

---

## 流程

```
訂單詳情 /orders/:id
  → 點「前往綠界付款」
  → GET /ecpay/pay/:orderId   [需 JWT 認證]
      生成 merchant_trade_no，寫入 DB
      計算 CheckMacValue
      回傳自動提交表單 HTML
  → 瀏覽器自動 POST → payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
  → 用戶完成付款
  → ECPay 瀏覽器 POST → POST /ecpay/return   (OrderResultURL)
      呼叫 QueryTradeInfo API
      TradeStatus=1 → status='paid'，否則 status='failed'
      redirect → /orders/:orderId?payment=success/failed
  → 訂單詳情頁顯示結果 banner（已有支援）
```

---

## 新增/修改檔案

### 新增：`src/utils/ecpay.js`

- `ecpayUrlEncode(str)` — URL encode for CheckMacValue（空格→`+`，`~`→`%7e`，`'`→`%27`，.NET 字元還原，lowercase）
- `generateCheckMacValue(params, hashKey, hashIv)` — 過濾→排序→組合→URLEncode→SHA256→大寫
- `verifyCheckMacValue(params, hashKey, hashIv)` — timing-safe 比較（`crypto.timingSafeEqual`）
- `generateMerchantTradeNo(orderId)` — `String(Math.floor(Date.now()/1000))` (10 chars) + `orderId.replace(/-/g,'').substring(0,10)` (10 chars) = 20 chars 全英數
- `getTaiwanTimeString()` — 回傳 `yyyy/MM/dd HH:mm:ss`（UTC+8）
- `queryTradeInfo(merchantTradeNo)` — POST 至 `QueryTradeInfo/V5`，回傳 URL-encoded 字串，parse 後驗證 CheckMacValue，回傳 `{ tradeStatus, rtnCode, ... }`
- `buildAioParams(order, items)` — 組合 AIO 必填參數（含 EncryptType=1、ChoosePayment='ALL'）

**ECPay 環境常數**（讀自 process.env）：
```
ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV, ECPAY_ENV (staging|production)
```
測試端點：`https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`
查詢端點：`https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5`

### 新增：`src/routes/ecpayRoutes.js`

| Method | Path | Auth | 說明 |
|--------|------|------|------|
| GET | `/ecpay/pay/:orderId` | JWT | 驗證訂單屬於當前用戶且 status=pending；生成 merchant_trade_no 更新 DB；回傳自動提交 HTML 表單 |
| POST | `/ecpay/notify` | 無 | ReturnURL handler，直接回傳純字串 `1\|OK`（HTTP 200） |
| POST | `/ecpay/return` | 無 | OrderResultURL handler：取得 MerchantTradeNo → 呼叫 QueryTradeInfo → 更新訂單狀態 → redirect |

`GET /ecpay/pay/:orderId` 回傳的 HTML（`res.send()`，不使用 layout）：
```html
<!DOCTYPE html><html><body>
  <form id="f" action="[AIO_URL]" method="POST">
    [所有 AIO 參數的 hidden inputs]
  </form>
  <script>document.getElementById('f').submit();</script>
</body></html>
```

`POST /ecpay/return` 邏輯：
1. `const { MerchantTradeNo } = req.body`
2. `db.prepare('SELECT * FROM orders WHERE merchant_trade_no = ?').get(MerchantTradeNo)`
3. 呼叫 `queryTradeInfo(MerchantTradeNo)`
4. `tradeStatus === '1'` → 更新 status='paid'，否則 status='failed'
5. `res.redirect('/orders/' + order.id + '?payment=' + (tradeStatus === '1' ? 'success' : 'failed'))`

### 修改：`src/database.js`

**a) CREATE TABLE 新增欄位**（orders 表內）：
```sql
merchant_trade_no TEXT UNIQUE,
```

**b) 新增 migration 函式**（在 `initializeDatabase()` 後呼叫）：
```javascript
function migrateDatabase() {
  const cols = db.pragma('table_info(orders)');
  if (!cols.find(c => c.name === 'merchant_trade_no')) {
    db.exec('ALTER TABLE orders ADD COLUMN merchant_trade_no TEXT UNIQUE');
  }
}
```

### 修改：`app.js`

在 `/api/orders` 之後、pageRoutes 之前新增：
```javascript
app.use('/', require('./src/routes/ecpayRoutes'));
```

### 修改：`views/pages/order-detail.ejs`（第 74-89 行）

將模擬付款按鈕區段改為：
```html
<div v-if="order.status === 'pending'" class="flex gap-4">
  <a
    :href="'/ecpay/pay/' + order.id"
    class="bg-sage text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-sage/90 transition-colors inline-block"
  >
    前往綠界付款
  </a>
</div>
```

### 修改：`public/js/pages/order-detail.js`

移除 `simulatePay`, `handlePaySuccess`, `handlePayFail` 函式，以及 `paying` ref。

---

## 關鍵參數對照（Source: web_fetch developers.ecpay.com.tw 2026-04-20）

| 參數 | 值 |
|------|-----|
| AIO 端點（測試） | `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5` |
| QueryTradeInfo（測試） | `https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5` |
| PaymentType | `aio`（固定） |
| EncryptType | `1`（SHA256，固定） |
| ChoosePayment | `ALL` |
| TradeStatus=1 | 已付款（字串比較） |
| QueryTradeInfo TimeStamp 有效期 | 3 分鐘（必須即時產生） |
| MerchantTradeNo 格式 | 英數字，max 20 chars，永久唯一 |

---

## 注意事項

- `ItemName` 不得含 `echo`/`curl`/`wget` 等系統關鍵字（WAF 攔截）；以商品名稱拼接 `#` 分隔
- `MerchantTradeDate` 必須用 UTC+8
- `ReturnURL` 必填但 ECPay 無法到達 localhost，真正的驗證靠 QueryTradeInfo
- CheckMacValue 比對必須用 `crypto.timingSafeEqual`
- 測試信用卡：`4311-9522-2222-2222`，CVV：任意3碼，3DS：`1234`

---

## 測試驗證步驟

1. `npm run dev:server` 啟動
2. 登入 → 加商品至購物車 → 結帳 → 訂單詳情頁
3. 點「前往綠界付款」，頁面自動跳轉至綠界測試付款頁
4. 使用測試信用卡 `4311-9522-2222-2222` 完成付款
5. 跳回 `/orders/:id?payment=success`，確認顯示成功 banner 且訂單狀態更新為「已付款」
6. 重新整理訂單頁，確認 DB 狀態持久化為 `paid`
7. 嘗試對已付款訂單再次存取 `/ecpay/pay/:id`，應回 400 錯誤
