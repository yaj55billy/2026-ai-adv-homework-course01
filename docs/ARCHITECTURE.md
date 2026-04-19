# ARCHITECTURE.md

## 目錄結構

每個檔案的用途說明如下：

```
.
├── app.js                          # Express 應用程式初始化（middleware 掛載、路由註冊）
├── server.js                       # 進入點，呼叫 app.js 並 listen port
├── package.json                    # 依賴與 npm scripts
├── vitest.config.js                # 測試執行順序設定
├── swagger-config.js               # swagger-jsdoc 設定物件
├── generate-openapi.js             # 執行後輸出 openapi.json
├── database.sqlite                 # SQLite 資料庫檔案（由程式自動建立）
├── .env                            # 環境變數（本機，不進 git）
├── .env.example                    # 環境變數範本
│
├── src/
│   ├── database.js                 # DB 初始化：建表、執行 seed data、匯出 db 實例
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT 驗證，驗證失敗回 401，成功寫入 req.user
│   │   ├── adminMiddleware.js      # 角色驗證，req.user.role !== 'admin' 時回 403
│   │   ├── sessionMiddleware.js    # 從 X-Session-Id header 提取 session，寫入 req.sessionId
│   │   └── errorHandler.js        # 全域錯誤處理，捕捉未處理例外回傳 500
│   └── routes/
│       ├── authRoutes.js           # /api/auth — 註冊、登入、個人資料
│       ├── productRoutes.js        # /api/products — 前台商品列表與詳情（公開）
│       ├── cartRoutes.js           # /api/cart — 購物車 CRUD（雙模式認證）
│       ├── orderRoutes.js          # /api/orders — 訂單建立、查詢、付款模擬（需 JWT）
│       ├── adminProductRoutes.js   # /api/admin/products — 後台商品 CRUD（需 admin）
│       ├── adminOrderRoutes.js     # /api/admin/orders — 後台訂單查詢（需 admin）
│       └── pageRoutes.js           # / — EJS 頁面渲染路由
│
├── public/
│   ├── css/
│   │   ├── input.css               # Tailwind CSS 進入點（含自訂指令）
│   │   └── output.css              # 編譯後的完整 CSS（由 @tailwindcss/cli 產生）
│   ├── js/
│   │   ├── api.js                  # fetch 封裝：自動注入 auth header、401 自動登出
│   │   ├── auth.js                 # localStorage 存取 token / user、session ID 管理
│   │   ├── notification.js         # Toast 通知顯示與隱藏
│   │   ├── header-init.js          # Header 元件初始化（登入狀態、購物車數量）
│   │   └── pages/                  # 每個頁面的獨立 JS 邏輯
│   │       ├── index.js            # 首頁：商品格狀列表載入
│   │       ├── login.js            # 登入 / 註冊表單邏輯
│   │       ├── product-detail.js   # 商品詳情：加入購物車
│   │       ├── cart.js             # 購物車：數量調整、刪除項目
│   │       ├── checkout.js         # 結帳：收件資訊表單送出
│   │       ├── orders.js           # 訂單列表顯示
│   │       ├── order-detail.js     # 訂單詳情：付款模擬按鈕
│   │       ├── admin-products.js   # 後台商品管理：CRUD 操作
│   │       └── admin-orders.js     # 後台訂單管理：列表與狀態篩選
│   └── stylesheets/
│       └── style.css               # 全域自訂樣式（Tailwind 以外的補充）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs               # 前台頁面 layout（含 head、header、footer）
│   │   └── admin.ejs               # 後台頁面 layout（含 sidebar）
│   ├── pages/                      # 各頁面的 body 區塊
│   │   ├── index.ejs
│   │   ├── login.ejs
│   │   ├── product-detail.ejs
│   │   ├── cart.ejs
│   │   ├── checkout.ejs
│   │   ├── orders.ejs
│   │   ├── order-detail.ejs
│   │   ├── admin/
│   │   │   ├── products.ejs
│   │   │   └── orders.ejs
│   │   └── 404.ejs
│   └── partials/                   # 共用片段元件
│       ├── head.ejs                # <head> 含 CSS link
│       ├── header.ejs              # 前台頂部導覽
│       ├── admin-header.ejs        # 後台頂部導覽
│       ├── admin-sidebar.ejs       # 後台側邊欄
│       ├── footer.ejs              # 前台底部
│       └── notification.ejs        # Toast 通知 HTML 結構
│
└── tests/
    ├── setup.js                    # 共用輔助函式（getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

---

## 啟動流程

```
node server.js
  └─ require('./app')
       ├─ dotenv.config()            # 載入 .env
       ├─ require('./src/database')  # 連接 SQLite、CREATE TABLE IF NOT EXISTS、seed
       │    ├─ PRAGMA journal_mode = WAL
       │    ├─ PRAGMA foreign_keys = ON
       │    ├─ 建立 users / products / cart_items / orders / order_items 表
       │    ├─ seedAdminUser()       # 若 admin email 不存在則插入
       │    └─ seedProducts()        # 若 products 為空則插入 8 筆花卉商品
       ├─ 掛載全域 middleware（cors、json、urlencoded、sessionMiddleware）
       ├─ 掛載 API 路由
       ├─ 掛載頁面路由（pageRoutes）
       ├─ 掛載 404 handler
       └─ 掛載 errorHandler
  └─ app.listen(3001)
```

---

## API 路由總覽

### 公開路由（無需認證）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| POST | `/api/auth/register` | authRoutes.js | 註冊新帳號 |
| POST | `/api/auth/login` | authRoutes.js | 登入，回傳 JWT |
| GET | `/api/products` | productRoutes.js | 商品列表（分頁） |
| GET | `/api/products/:id` | productRoutes.js | 商品詳情 |

### 一般會員路由（需 JWT 或 X-Session-Id）

| 方法 | 路徑 | 檔案 | 認證方式 | 說明 |
|------|------|------|----------|------|
| GET | `/api/auth/profile` | authRoutes.js | JWT | 取得個人資料 |
| GET | `/api/cart` | cartRoutes.js | JWT 或 Session | 查看購物車 |
| POST | `/api/cart` | cartRoutes.js | JWT 或 Session | 加入商品 |
| PATCH | `/api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 修改數量 |
| DELETE | `/api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 移除項目 |
| POST | `/api/orders` | orderRoutes.js | JWT | 從購物車建立訂單 |
| GET | `/api/orders` | orderRoutes.js | JWT | 我的訂單列表 |
| GET | `/api/orders/:id` | orderRoutes.js | JWT | 訂單詳情 |
| PATCH | `/api/orders/:id/pay` | orderRoutes.js | JWT | 模擬付款 |

### 後台管理路由（需 JWT + role=admin）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| GET | `/api/admin/products` | adminProductRoutes.js | 後台商品列表（分頁） |
| POST | `/api/admin/products` | adminProductRoutes.js | 新增商品 |
| PUT | `/api/admin/products/:id` | adminProductRoutes.js | 更新商品（部分欄位可選） |
| DELETE | `/api/admin/products/:id` | adminProductRoutes.js | 刪除商品（有 pending 訂單時拒絕） |
| GET | `/api/admin/orders` | adminOrderRoutes.js | 所有訂單列表（可篩選 status） |
| GET | `/api/admin/orders/:id` | adminOrderRoutes.js | 訂單詳情（含使用者資訊） |

### 頁面路由

| 方法 | 路徑 | Layout | 說明 |
|------|------|--------|------|
| GET | `/` | front.ejs | 首頁（商品列表） |
| GET | `/products/:id` | front.ejs | 商品詳情頁 |
| GET | `/cart` | front.ejs | 購物車頁 |
| GET | `/checkout` | front.ejs | 結帳頁 |
| GET | `/login` | front.ejs | 登入 / 註冊頁 |
| GET | `/orders` | front.ejs | 我的訂單列表頁 |
| GET | `/orders/:id` | front.ejs | 訂單詳情頁 |
| GET | `/admin/products` | admin.ejs | 後台商品管理 |
| GET | `/admin/orders` | admin.ejs | 後台訂單管理 |

---

## 統一回應格式

所有 API 端點回傳以下固定 JSON 結構：

```json
{
  "data": { ... },    // 成功時為實際資料，失敗時為 null
  "error": null,      // 成功時為 null，失敗時為錯誤代碼字串
  "message": "成功"  // 人類可讀的訊息（繁體中文）
}
```

**HTTP 狀態碼對照：**

| 狀態碼 | 使用情境 |
|--------|---------|
| 200 | 成功讀取 / 更新 |
| 201 | 成功建立（register、建立訂單、新增商品） |
| 400 | 驗證失敗、購物車為空、庫存不足、action 無效 |
| 401 | 未提供 token、token 無效或過期 |
| 403 | 權限不足（非 admin 存取後台） |
| 404 | 資源不存在 |
| 409 | 衝突（Email 重複、商品有 pending 訂單不可刪除） |
| 500 | 伺服器錯誤 |

---

## 認證與授權機制

### JWT 認證流程

1. 使用者呼叫 `POST /api/auth/login` 或 `/api/auth/register`
2. 伺服器簽發 JWT，payload 包含 `{ userId, email, role }`，以 `HS256` 演算法 + `JWT_SECRET` 加密，有效期 `7d`
3. 前端將 token 存入 `localStorage`（key: `token`）
4. 後續請求在 `Authorization: Bearer <token>` header 中攜帶
5. `authMiddleware` 驗證 token，並額外從 DB 確認 user 仍存在，將解碼結果寫入 `req.user`

### 訪客購物車（Session 模式）

1. 前端首次載入時，`auth.js` 呼叫 `crypto.randomUUID()` 生成 session ID 並存入 `localStorage`（key: `sessionId`）
2. 每次請求購物車 API 時，在 `X-Session-Id` header 中攜帶此 ID
3. `sessionMiddleware` 提取後寫入 `req.sessionId`
4. 購物車資料以 `session_id` 欄位儲存在 `cart_items` 表中

### 雙模式購物車（dualAuth）

`cartRoutes.js` 中的 `dualAuth` 函式行為：

```
請求攜帶 Authorization header？
  ├─ 是 → 嘗試驗證 JWT
  │        ├─ 成功 → req.user 填入，繼續
  │        └─ 失敗 → 立刻回 401（不 fallback 至 session）
  └─ 否 → req.sessionId 存在？
            ├─ 是 → 繼續（guest mode）
            └─ 否 → 回 401
```

### Admin 授權

`adminMiddleware` 在 `authMiddleware` 之後執行，檢查 `req.user.role === 'admin'`，不符合時回 403。所有 `/api/admin/*` 路由都套用 `[authMiddleware, adminMiddleware]`。

---

## 資料庫 Schema

### users 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入用 Email |
| password_hash | TEXT | NOT NULL | bcrypt 雜湊（10 rounds） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間（UTC） |

### products 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品說明 |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 售價（新台幣元，正整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 商品圖片 URL |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 最後更新時間 |

### cart_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 session ID（與 user_id 擇一填入） |
| user_id | TEXT | FK → users(id) | 會員 ID（與 session_id 擇一填入） |
| product_id | TEXT | NOT NULL, FK → products(id) | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 數量（正整數） |

> **注意**：`session_id` 與 `user_id` 不可同時為 null，也不可同時有值。程式層級保證只填其中一個。

### orders 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號（格式：ORD-YYYYMMDD-XXXXX） |
| user_id | TEXT | NOT NULL, FK → users(id) | 下單會員 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總額（新台幣元） |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 付款狀態 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### order_items 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FK → orders(id) | 所屬訂單 |
| product_id | TEXT | NOT NULL, FK → products(id) | 商品 ID（歷史記錄） |
| product_name | TEXT | NOT NULL | 下單時的商品名稱（快照） |
| product_price | INTEGER | NOT NULL | 下單時的單價（快照） |
| quantity | INTEGER | NOT NULL | 數量 |

> **設計決策**：`product_name` 與 `product_price` 為下單當下的快照，確保商品事後修改不影響歷史訂單記錄。

---

## 資料流

### 購物 → 下單流程

```
用戶瀏覽商品（GET /api/products）
  ↓
加入購物車（POST /api/cart）
  ├─ 驗證 productId 存在
  ├─ 驗證 quantity > 0
  ├─ 若購物車已有此商品 → 累加數量（quantity += qty）
  └─ 驗證累加後數量 ≤ 庫存
  ↓
確認購物車（GET /api/cart）
  ↓
結帳（POST /api/orders）
  ├─ 驗證 recipientName / recipientEmail / recipientAddress
  ├─ 取得該 user 的所有購物車項目
  ├─ 驗證所有商品庫存充足
  └─ DB Transaction：
       ├─ INSERT INTO orders
       ├─ INSERT INTO order_items（逐筆）
       ├─ UPDATE products SET stock = stock - quantity（逐筆）
       └─ DELETE FROM cart_items WHERE user_id = ?
  ↓
模擬付款（PATCH /api/orders/:id/pay）
  ├─ action = 'success' → status 改為 'paid'
  └─ action = 'fail' → status 改為 'failed'
```
