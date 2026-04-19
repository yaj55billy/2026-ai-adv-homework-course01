# 花卉電商網站

以 Express.js 建構的全端花卉電商平台，提供商品瀏覽、購物車（訪客 / 會員雙模式）、訂單管理與後台 CRUD 功能。前後端整合在同一個 Node.js 服務，頁面以 EJS 伺服器端渲染，JavaScript 與 CSS 透過 public/ 靜態檔案提供給瀏覽器。

---

## 技術棧

| 層級 | 技術 |
|------|------|
| Web 框架 | Express.js 4.x |
| 資料庫 | SQLite3（better-sqlite3，同步 API） |
| 樣板引擎 | EJS 5.x |
| CSS 框架 | Tailwind CSS 4.x |
| 身份驗證 | JWT（jsonwebtoken 9.x，HS256，7天效期） |
| 密碼雜湊 | bcrypt 6.x（10 rounds） |
| ID 生成 | uuid v4 |
| CORS | cors 2.x |
| 環境變數 | dotenv |
| 測試框架 | Vitest 2.x + Supertest 7.x |
| API 文件 | swagger-jsdoc + OpenAPI 3.0 |

---

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，至少填入 JWT_SECRET
```

### 3. 啟動開發環境

需要兩個終端並行執行：

```bash
# 終端 1：啟動 Express server
npm run dev:server

# 終端 2：監聽 CSS 變更（修改 Tailwind 時才需要）
npm run dev:css
```

開啟瀏覽器訪問：`http://localhost:3001`

### 4. 預設管理員帳號

| 欄位 | 值 |
|------|----|
| Email | `admin@hexschool.com` |
| 密碼 | `12345678` |

管理後台路徑：`http://localhost:3001/admin/products`

---

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動 Express server（port 3001） |
| `npm run dev:css` | 監聽 CSS 變更並即時編譯（開發時使用） |
| `npm start` | 建置 CSS 後啟動 server（生產用） |
| `npm test` | 執行所有測試（依固定順序） |
| `npm run openapi` | 產生 `openapi.json` API 規格檔 |
| `npm run css:build` | 單次建置並壓縮 CSS |

---

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 完整架構、目錄說明、API 路由表、資料庫 schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增 API / middleware 步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能清單與完成狀態、業務邏輯說明、錯誤碼對照 |
| [TESTING.md](./TESTING.md) | 測試規範、執行順序、輔助函式說明、撰寫新測試指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新紀錄 |
| [plans/](./plans/) | 功能開發計畫（進行中） |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
