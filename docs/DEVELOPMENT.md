# DEVELOPMENT.md

## 環境變數

`.env` 設定說明（參考 `.env.example`）：

| 變數名稱 | 用途 | 必要性 | 範例值 |
|---------|------|--------|--------|
| `JWT_SECRET` | JWT 簽章金鑰 | **必填** | 任意長字串（建議 32+ 字元） |
| `BASE_URL` | 伺服器 base URL | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許來源 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | seed 管理員帳號 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | seed 管理員帳號密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界商店 ID | 選填（金流功能用） | `3002607` |
| `ECPAY_HASH_KEY` | 綠界 Hash Key | 選填（金流功能用） | — |
| `ECPAY_HASH_IV` | 綠界 Hash IV | 選填（金流功能用） | — |
| `ECPAY_ENV` | 綠界環境 | 選填 | `staging` |
| `NODE_ENV` | 執行環境 | 選填 | `test`（測試時自動設定） |

> **重要**：`NODE_ENV=test` 時，bcrypt 的 `saltRounds` 降為 1，避免測試速度過慢。

---

## 命名規則對照表

### API

| 項目 | 規則 | 範例 |
|------|------|------|
| 路徑 | kebab-case | `/api/admin/products` |
| Query 參數 | camelCase | `?page=1&limit=10` |
| Request body 欄位 | camelCase | `productId`、`recipientName` |
| Response 欄位 | snake_case | `product_id`、`created_at` |
| 錯誤代碼（error 欄位） | SCREAMING_SNAKE_CASE | `VALIDATION_ERROR`、`NOT_FOUND` |

### 資料庫

| 項目 | 規則 | 範例 |
|------|------|------|
| 表名 | snake_case 複數 | `cart_items`、`order_items` |
| 欄位名 | snake_case | `user_id`、`created_at` |
| 主鍵 | UUID v4，TEXT 型別 | `id` |
| 外鍵 | `{referenced_table_singular}_id` | `user_id`、`product_id` |

### 檔案與目錄

| 項目 | 規則 | 範例 |
|------|------|------|
| 路由檔案 | camelCase + Routes | `cartRoutes.js`、`adminProductRoutes.js` |
| Middleware 檔案 | camelCase + Middleware | `authMiddleware.js` |
| 頁面 JS 檔案 | kebab-case | `product-detail.js`、`admin-orders.js` |
| EJS 頁面 | kebab-case | `product-detail.ejs`、`order-detail.ejs` |

---

## 模組系統說明

本專案混用 CommonJS（`require`/`module.exports`）與 ES Module（`import`/`export`）：

- **後端（Node.js）**：全部使用 CommonJS，`package.json` 未設定 `"type": "module"`
- **Vitest 設定**：`vitest.config.js` 使用 ES Module 語法（`import/export`），這是 Vitest 的預期格式
- **前端 JS**（`public/js/`）：直接透過 `<script>` 標籤載入，使用全域變數溝通，非模組化

---

## 新增 API 端點步驟

1. **確認路由歸屬**：找到對應的路由檔案（如 `src/routes/productRoutes.js`），或建立新檔案

2. **撰寫路由 handler**：
   ```js
   /**
    * @openapi
    * /api/products/{id}:
    *   get:
    *     summary: 商品詳情
    *     tags: [Products]
    *     ...
    */
   router.get('/:id', (req, res) => {
     // 1. 驗證輸入
     // 2. 查詢 DB
     // 3. 回傳統一格式
     res.json({ data: ..., error: null, message: '成功' });
   });
   ```

3. **若需要新路由檔案**，在 `app.js` 中掛載：
   ```js
   app.use('/api/new-resource', require('./src/routes/newRoutes'));
   ```

4. **錯誤回傳格式**：
   ```js
   // 驗證失敗
   return res.status(400).json({ data: null, error: 'VALIDATION_ERROR', message: '欄位描述' });
   // 找不到
   return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '資源不存在' });
   ```

5. **撰寫對應測試**（見 [TESTING.md](./TESTING.md)）

---

## 新增 Middleware 步驟

1. 在 `src/middleware/` 建立新檔案
2. 實作為標準 Express middleware 函式：
   ```js
   function myMiddleware(req, res, next) {
     // 邏輯...
     next(); // 或 return res.status(xxx).json(...)
   }
   module.exports = myMiddleware;
   ```
3. 在需要的路由中套用：
   ```js
   // 套用至單一路由
   router.get('/protected', myMiddleware, handler);
   // 套用至整個 router
   router.use(myMiddleware);
   ```
4. 全域套用在 `app.js` 的 `app.use(myMiddleware)` 處

---

## 新增資料表步驟

1. 在 `src/database.js` 的 `initializeDatabase()` 函式中的 `db.exec(...)` 區塊加入：
   ```sql
   CREATE TABLE IF NOT EXISTS new_table (
     id TEXT PRIMARY KEY,
     ...
   );
   ```
2. 確認 `FOREIGN KEY` 參照正確，且 `PRAGMA foreign_keys = ON` 已啟用
3. 若需要 seed 資料，新增對應的 `seedXxx()` 函式並在 `initializeDatabase()` 末端呼叫
4. **注意**：資料庫重啟時 `CREATE TABLE IF NOT EXISTS` 才不會報錯；若修改已存在的表結構，必須手動刪除 `database.sqlite` 或撰寫 migration 邏輯

---

## JSDoc / OpenAPI 格式

路由檔案中每個端點都需要撰寫 `@openapi` JSDoc 註解，供 `swagger-jsdoc` 解析。固定格式：

```js
/**
 * @openapi
 * /api/resource:
 *   get:
 *     summary: 簡短說明（中文）
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []   # 若需要 JWT
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
```

執行 `npm run openapi` 後產生 `openapi.json`，可匯入 Postman 或 Swagger UI 使用。

---

## 計畫歸檔流程

1. **計畫檔案命名格式**：`YYYY-MM-DD-<feature-name>.md`
   - 範例：`2026-04-19-admin-dashboard.md`

2. **計畫文件結構**：
   ```markdown
   # 功能名稱

   ## User Story
   身為...，我想要...，以便...

   ## Spec
   - 端點設計
   - 資料結構
   - 業務邏輯說明

   ## Tasks
   - [ ] 建立路由
   - [ ] 撰寫 DB 查詢
   - [ ] 前端頁面
   - [ ] 撰寫測試
   ```

3. **功能完成後**：
   - 將計畫檔案從 `docs/plans/` 移至 `docs/plans/archive/`
   - 更新 `docs/FEATURES.md`（修改完成狀態）
   - 更新 `docs/CHANGELOG.md`（新增版本記錄）
