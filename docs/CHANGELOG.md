# CHANGELOG.md

## [Unreleased]

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
