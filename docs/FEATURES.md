# FEATURES.md

## 功能完成狀態總覽

| 功能區塊 | 狀態 |
|---------|------|
| 使用者認證（註冊 / 登入 / 個人資料） | 完成 |
| 商品瀏覽（列表 / 詳情） | 完成 |
| 購物車（訪客 + 會員雙模式） | 完成 |
| 訂單建立與管理 | 完成 |
| ECPay AIO 金流串接（信用卡、ATM、網路ATM） | 完成 |
| 後台商品管理（CRUD） | 完成 |
| 後台訂單查詢 | 完成 |
| 前台 EJS 頁面渲染 | 完成 |

---

## 使用者認證

### 行為描述

**註冊（POST /api/auth/register）**

使用者提供 `email`、`password`、`name` 即可建立帳號。Email 必須符合 `^[^\s@]+@[^\s@]+\.[^\s@]+$` 格式，密碼最短 6 個字元。帳號建立後伺服器自動簽發 JWT，回傳 user 物件與 token，不需要再呼叫一次登入。新帳號的 `role` 固定為 `'user'`，無法透過 API 自行設定為 admin。

**登入（POST /api/auth/login）**

提供 Email 與密碼，伺服器以 bcrypt.compareSync 驗證雜湊後簽發 JWT。無論是 Email 不存在還是密碼錯誤，統一回傳 `'Email 或密碼錯誤'`，避免帳號枚舉攻擊。

**個人資料（GET /api/auth/profile）**

需攜帶 JWT，回傳 `id`、`email`、`name`、`role`、`created_at`。`authMiddleware` 除了驗證 JWT 本身，還會額外查詢 DB 確認 user 仍存在，防止已刪除帳號的 token 仍然有效。

### 請求 / 回應規格

**POST /api/auth/register — Request Body**

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|---------|
| email | string | 是 | Email 格式 |
| password | string | 是 | 最少 6 個字元 |
| name | string | 是 | 非空 |

**回應（201）**

```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "user" },
    "token": "eyJ..."
  },
  "error": null,
  "message": "註冊成功"
}
```

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 400 | `VALIDATION_ERROR` | email / password / name 缺失或格式錯誤 |
| 409 | `CONFLICT` | Email 已被其他帳號使用 |
| 401 | `UNAUTHORIZED` | 登入密碼錯誤、JWT 無效或過期 |

---

## 商品瀏覽

### 行為描述

**商品列表（GET /api/products）**

公開路由，無需認證。支援 `page`（預設 1）和 `limit`（預設 10，最大 100）查詢參數分頁。回傳陣列與 pagination 物件，包含 `total`、`page`、`limit`、`totalPages`。商品依 `created_at DESC` 排序。

**商品詳情（GET /api/products/:id）**

公開路由。以 UUID 查詢單一商品，不存在時回 404。回傳完整欄位（含 `description`、`stock`、`image_url`）。

### 請求規格

**GET /api/products — Query 參數**

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數（最大 100） |

**回應（200）**

```json
{
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "粉色玫瑰花束",
        "description": "...",
        "price": 1680,
        "stock": 30,
        "image_url": "https://...",
        "created_at": "2026-04-19T00:00:00",
        "updated_at": "2026-04-19T00:00:00"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 404 | `NOT_FOUND` | 商品 ID 不存在 |

---

## 購物車（雙模式）

### 行為描述

購物車是本系統最特殊的機制，同時支援「訪客模式（Session）」與「會員模式（JWT）」，兩者資料儲存方式不同。

**訪客模式**：前端在 localStorage 存一組 `crypto.randomUUID()` 生成的 session ID，每次請求透過 `X-Session-Id` header 傳送，購物車資料以 `session_id` 欄位儲存。

**會員模式**：攜帶 `Authorization: Bearer <token>`，購物車以 `user_id` 儲存。

**認證優先級**（dualAuth 函式）：若 `Authorization` header 存在，不論是否有效都不 fallback 至 session——token 無效直接 401。

**加入購物車的累加邏輯**：若購物車已存在同一商品，會將新的 `quantity` 累加到現有數量（`existingItem.quantity + qty`），而非覆蓋。累加後若超過庫存上限，回傳 `STOCK_INSUFFICIENT`。

**跨模式資料不共享**：訪客加入的商品在登入後不會自動合併。訂單建立時只讀取 `user_id` 對應的購物車。

### 請求規格

**POST /api/cart — Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| productId | string | 是 | 商品 UUID |
| quantity | integer | 否（預設 1） | 正整數，加入數量 |

**GET /api/cart — Response**

```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": {
          "name": "粉色玫瑰花束",
          "price": 1680,
          "stock": 30,
          "image_url": "https://..."
        }
      }
    ],
    "total": 3360
  },
  "error": null,
  "message": "成功"
}
```

> `total` 為 `sum(price * quantity)`，由伺服器計算回傳。

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 400 | `VALIDATION_ERROR` | productId 未提供、quantity 非正整數 |
| 400 | `STOCK_INSUFFICIENT` | 加入或更新後數量超過庫存 |
| 401 | `UNAUTHORIZED` | 未提供 token 或 session，或 token 無效 |
| 404 | `NOT_FOUND` | 商品不存在、購物車項目不存在 |

---

## 訂單建立與管理

### 行為描述

**建立訂單（POST /api/orders）**

**需要 JWT**，訪客無法下單。系統從資料庫讀取該 user 的所有購物車項目，驗證所有商品庫存充足後，在**單一 DB Transaction** 中執行：

1. `INSERT INTO orders`（含自動生成的 order_no）
2. `INSERT INTO order_items`（每筆購物車項目一條記錄，快照商品名稱與單價）
3. `UPDATE products SET stock = stock - quantity`（逐一扣減庫存）
4. `DELETE FROM cart_items WHERE user_id = ?`（清空購物車）

若任何步驟失敗，Transaction 自動 rollback，庫存不會被錯誤扣除。

**訂單編號格式**：`ORD-YYYYMMDD-XXXXX`，其中 `XXXXX` 為 UUID v4 前 5 碼大寫（如 `ORD-20260419-A3F9B`）。

**訂單狀態流**：

```
pending（建立後）
  ├─ → paid（ECPay 付款成功，RtnCode=1）
  ├─ → failed（ECPay 付款失敗或取消，RtnCode≠1,2）
  └─ 保持 pending（ATM 取號成功，RtnCode=2，等待轉帳）
```

`pending` 與 `failed` 狀態的訂單皆可再次發起付款（允許重試）；`paid` 狀態的訂單無法再次付款（回 400）。

**查詢訂單**：使用者只能看到自己的訂單（WHERE user_id = req.user.userId），防止橫向越權。

### 請求規格

**POST /api/orders — Request Body**

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|---------|
| recipientName | string | 是 | 非空 |
| recipientEmail | string | 是 | Email 格式 |
| recipientAddress | string | 是 | 非空 |

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 400 | `VALIDATION_ERROR` | 收件人資訊缺失或格式錯誤 |
| 400 | `CART_EMPTY` | 購物車沒有任何商品 |
| 400 | `STOCK_INSUFFICIENT` | 有商品庫存不足，回傳商品名稱清單 |
| 401 | `UNAUTHORIZED` | 未攜帶有效 JWT |
| 404 | `NOT_FOUND` | 訂單 ID 不存在或不屬於該用戶 |

---

## ECPay AIO 金流串接

### 行為描述

使用綠界科技 AIO 全方位金流（測試環境）取代原有的模擬付款按鈕，讓用戶可透過信用卡、ATM 轉帳、網路 ATM 等方式完成真實付款流程。

**發起付款（GET /ecpay/pay/:orderId）**

需要 JWT 認證。伺服器驗證訂單屬於當前用戶且狀態為 `pending` 或 `failed`（允許失敗後重試）後：

1. 以 `Unix timestamp（10碼）+ orderId 前 10 碼英數` 組成唯一的 `MerchantTradeNo`（max 20 chars）
2. 將 `MerchantTradeNo` 寫入訂單的 `merchant_trade_no` 欄位
3. 組合 AIO 必填參數（含 `CheckMacValue` SHA256 簽章）並以 JSON 回傳

前端接收 JSON 後動態建立隱藏 input 表單，自動 POST 至綠界付款頁面（`https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`）。

**付款結果接收（POST /ecpay/return）**

ECPay 完成付款後將瀏覽器 POST 至此路由（`OrderResultURL`）。以 `RtnCode` 判斷結果：

| RtnCode | 意義 | 訂單狀態更新 | 前端跳轉 |
|---------|------|------------|---------|
| `1` | 付款成功 | `paid` | `?payment=success` |
| `2` | ATM 虛擬帳號已開立（等待轉帳） | 不變（維持 `pending`） | `?payment=atm_created` |
| 其他 | 付款失敗或取消 | `failed` | `?payment=failed` |

> **說明**：ATM 轉帳為非同步付款，用戶取得虛擬帳號後須自行至 ATM 完成轉帳。ECPay 確認轉帳完成後會呼叫 `ReturnURL`（本機開發環境無法接收）。信用卡與網路 ATM 為即時付款，結果可由 `RtnCode` 直接判斷。

**ReturnURL handler（POST /ecpay/notify）**

ECPay 伺服器端通知，直接回傳純字串 `1|OK`（本機環境 ECPay 無法到達，僅為滿足必填參數要求）。

### ECPay 工具函式（src/utils/ecpay.js）

| 函式 | 說明 |
|------|------|
| `generateCheckMacValue(params)` | 過濾→排序→URL encode→SHA256→大寫，計算 CheckMacValue |
| `verifyCheckMacValue(params)` | timing-safe 比較驗證 CheckMacValue |
| `generateMerchantTradeNo(orderId)` | 產生唯一 MerchantTradeNo（Unix timestamp + orderId 前 10 碼） |
| `getTaiwanTimeString()` | 回傳 UTC+8 時間字串（`yyyy/MM/dd HH:mm:ss`） |
| `buildAioParams(order, items, merchantTradeNo)` | 組合 AIO 必填參數，含 `ItemName`（`#` 分隔商品名稱） |

### 環境變數

| 變數 | 說明 |
|------|------|
| `ECPAY_MERCHANT_ID` | 商店代號 |
| `ECPAY_HASH_KEY` | CheckMacValue 用 HashKey |
| `ECPAY_HASH_IV` | CheckMacValue 用 HashIV |
| `ECPAY_ENV` | `staging`（測試）或 `production`（正式） |
| `BASE_URL` | 本機服務 URL（預設 `http://localhost:3001`），用於組合 ReturnURL / OrderResultURL |

### 前端行為（訂單詳情頁）

訂單狀態為 `pending` 或 `failed` 時顯示「前往綠界付款」按鈕。按下後前端呼叫 `GET /ecpay/pay/:orderId`（帶 JWT），取得 AIO 參數後自動提交表單跳轉至綠界付款頁。付款完成後依 `?payment=` 參數顯示對應 banner：

| 參數值 | Banner 訊息 |
|--------|------------|
| `success` | 付款成功！感謝您的購買。 |
| `failed` | 付款失敗，請重試。 |
| `atm_created` | ATM 虛擬帳號已開立，請在期限內完成轉帳。完成轉帳後訂單狀態將自動更新。 |

### ECPay 路由錯誤碼

| HTTP | 情境 |
|------|------|
| 400 | 訂單已付款（`status === 'paid'`），不可再次付款 |
| 403 | 訂單不屬於當前用戶 |
| 404 | 訂單 ID 不存在 |

---

## 後台商品管理（Admin）

### 行為描述

所有 `/api/admin/products` 路由須通過 `authMiddleware + adminMiddleware`（JWT 有效且 `role === 'admin'`）。

**列表（GET /api/admin/products）**：支援 `page`（預設 1）/ `limit`（預設 10，上限 100）分頁。依 `created_at DESC` 排序。回傳完整欄位含 `updated_at`。

**新增（POST /api/admin/products）**：`name`、`price`、`stock` 為必填欄位。`description` 與 `image_url` 選填，未提供時存入 `null`。`price` 必須為正整數，`stock` 必須為非負整數。

**更新（PUT /api/admin/products/:id）**：所有欄位皆為選填（部分更新），未傳入的欄位維持原值。若傳入 `name` 為空字串會被拒絕（`'商品名稱不能為空'`）。`updated_at` 會自動更新為 `datetime('now')`。

**刪除（DELETE /api/admin/products/:id）**：刪除前先檢查是否有 `status = 'pending'` 的訂單明細關聯此商品，有則拒絕刪除（`409 CONFLICT`）。`paid` 或 `failed` 狀態的訂單不影響刪除。

### 請求規格

**POST /api/admin/products — Request Body**

| 欄位 | 型別 | 必填 | 驗證規則 |
|------|------|------|---------|
| name | string | 是 | 非空 |
| description | string | 否 | — |
| price | integer | 是 | 正整數（> 0） |
| stock | integer | 是 | 非負整數（>= 0） |
| image_url | string | 否 | — |

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 400 | `VALIDATION_ERROR` | name 空字串、price / stock 型別或範圍錯誤 |
| 401 | `UNAUTHORIZED` | 未登入或 token 無效 |
| 403 | `FORBIDDEN` | 非 admin 角色 |
| 404 | `NOT_FOUND` | 商品 ID 不存在 |
| 409 | `CONFLICT` | 商品有 pending 訂單，無法刪除 |

---

## 後台訂單查詢（Admin）

### 行為描述

**所有訂單列表（GET /api/admin/orders）**：Admin 可查看全站所有訂單，不限使用者。支援 `status` query 參數篩選（`pending`、`paid`、`failed`），不提供時回傳全部。回傳訂單資訊時一併包含下單使用者的基本資料（`user_name`、`user_email`）。依 `created_at DESC` 排序。

**訂單詳情（GET /api/admin/orders/:id）**：回傳單一訂單完整資訊，含所有 `order_items` 明細與下單使用者資訊。

### 請求規格

**GET /api/admin/orders — Query 參數**

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| status | string | 否 | `pending`、`paid`、`failed` 其中一個 |

### 錯誤碼

| HTTP | error | 情境 |
|------|-------|------|
| 401 | `UNAUTHORIZED` | 未登入或 token 無效 |
| 403 | `FORBIDDEN` | 非 admin 角色 |
| 404 | `NOT_FOUND` | 訂單 ID 不存在 |

---

## 前台 EJS 頁面

### 行為描述

頁面路由由 `pageRoutes.js` 處理，全部使用 EJS 伺服器端渲染。頁面採用兩層 layout：

1. `views/layouts/front.ejs`（或 `admin.ejs`）作為外框，包含 `<head>`、header、footer
2. `views/pages/*.ejs` 作為 body 內容，透過 `body` 變數傳入 layout

每個頁面掛載獨立的 `public/js/pages/*.js`，透過 `pageScript` 變數傳給 layout 渲染。

認證狀態由前端 `auth.js` 管理，頁面載入後由 JavaScript 動態更新 header 顯示狀態（登入/登出）和購物車數量。

後台頁面（`/admin/*`）使用 `admin.ejs` layout，包含側邊欄導覽。後台的認證由前端 JS 在呼叫 API 時自動帶上 JWT，未登入的 admin 頁面存取會在 API 呼叫失敗後被前端重導向至登入頁。
