# TESTING.md

## 測試框架與工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 2.x | 測試執行器、斷言函式庫（`describe`、`it`、`expect`） |
| Supertest | 7.x | HTTP 請求模擬（直接對 Express app 發送請求，不需啟動 server） |

---

## 測試檔案

| 測試檔案 | 測試範圍 |
|---------|---------|
| `tests/auth.test.js` | 註冊（成功、重複 email）、登入（成功、錯誤密碼）、取得個人資料 |
| `tests/products.test.js` | 商品列表（分頁）、商品詳情、查詢不存在商品 |
| `tests/cart.test.js` | 訪客購物車 CRUD、會員購物車、錯誤商品 ID |
| `tests/orders.test.js` | 建立訂單、查詢訂單列表、訂單詳情、模擬付款（成功/失敗） |
| `tests/adminProducts.test.js` | 後台商品列表、新增、更新、刪除（含 pending 訂單拒絕） |
| `tests/adminOrders.test.js` | 後台所有訂單列表、狀態篩選、訂單詳情 |
| `tests/setup.js` | 共用輔助函式（不含測試 case） |

---

## 執行順序與依賴關係

測試**不可並行**，`vitest.config.js` 強制指定以下順序：

```
1. auth.test.js          ← 獨立，不依賴其他測試
2. products.test.js      ← 依賴 database seed 的 8 筆商品
3. cart.test.js          ← 依賴 products 存在；認證模式使用 registerUser() 建立新帳號
4. orders.test.js        ← 依賴 cart.test.js 中會員購物車留下的商品（userToken + 商品）
5. adminProducts.test.js ← 依賴 admin seed 帳號
6. adminOrders.test.js   ← 依賴 orders.test.js 建立的訂單資料
```

> **重要**：勿更改順序，也勿在 `vitest.config.js` 中啟用並行（`fileParallelism: false` 是刻意設定）。後面的測試依賴前面測試建立的 DB 狀態。

---

## 輔助函式（tests/setup.js）

```js
// 使用 seed 管理員帳號登入並取得 JWT
async function getAdminToken()
// 回傳: string（token）

// 動態建立一個新測試用帳號並回傳 token 與 user
async function registerUser(overrides = {})
// overrides 可傳入: { email, password, name }
// 回傳: { token: string, user: object }
// 若未傳 email，自動生成唯一 email（避免重複衝突）
```

**使用範例：**

```js
const { app, request, getAdminToken, registerUser } = require('./setup');

describe('My Feature', () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const { token } = await registerUser();
    userToken = token;
  });

  it('should work', async () => {
    const res = await request(app)
      .get('/api/some-endpoint')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
```

---

## 執行測試

```bash
npm test             # 依序執行全部測試
```

> 測試使用**同一個 `database.sqlite`**（非記憶體 DB，非 mock）。每次測試前不 reset 資料庫，測試的正確性依賴執行順序和各 test case 自行管理的狀態。

---

## 撰寫新測試步驟

1. **決定測試位置**：

   - 若測試新功能，在 `tests/` 建立新檔案（如 `tests/newFeature.test.js`）
   - 若是擴充現有功能，在對應檔案中增加 `it(...)` case

2. **若新增測試檔案**，必須在 `vitest.config.js` 的 `sequence.files` 陣列中加入，並放置在正確的依賴位置：

   ```js
   sequence: {
     files: [
       'tests/auth.test.js',
       'tests/products.test.js',
       'tests/cart.test.js',
       'tests/orders.test.js',
       'tests/adminProducts.test.js',
       'tests/adminOrders.test.js',
       'tests/newFeature.test.js',  // ← 加在這裡
     ],
   },
   ```

3. **基本測試結構**：

   ```js
   const { app, request, getAdminToken, registerUser } = require('./setup');

   describe('Feature Name', () => {
     // 跨 test case 共享的狀態
     let token;
     let createdId;

     beforeAll(async () => {
       const { token: t } = await registerUser();
       token = t;
     });

     it('should 預期行為描述', async () => {
       const res = await request(app)
         .post('/api/endpoint')
         .set('Authorization', `Bearer ${token}`)
         .send({ field: 'value' });

       expect(res.status).toBe(201);
       expect(res.body).toHaveProperty('data');
       expect(res.body).toHaveProperty('error', null);
       createdId = res.body.data.id;
     });

     it('should fail when ...', async () => {
       const res = await request(app)
         .post('/api/endpoint')
         .set('Authorization', `Bearer ${token}`)
         .send({ /* 缺必填欄位 */ });

       expect(res.status).toBe(400);
       expect(res.body).toHaveProperty('data', null);
       expect(res.body.error).not.toBeNull();
     });
   });
   ```

4. **驗證購物車 API（雙模式）**：

   ```js
   // 訪客模式
   const sessionId = 'test-session-' + Date.now();
   await request(app)
     .post('/api/cart')
     .set('X-Session-Id', sessionId)
     .send({ productId, quantity: 1 });

   // 會員模式
   const { token } = await registerUser();
   await request(app)
     .post('/api/cart')
     .set('Authorization', `Bearer ${token}`)
     .send({ productId, quantity: 1 });
   ```

---

## 常見陷阱

| 陷阱 | 說明 | 解法 |
|------|------|------|
| `registerUser()` email 衝突 | 測試順序或多次執行可能重複 email | `registerUser()` 預設使用 `Date.now() + Math.random()` 確保唯一，勿傳固定 email |
| 訂單測試依賴購物車狀態 | `orders.test.js` 需要 cart 中已有商品 | 確保 `cart.test.js` 的會員購物車 case 執行後 `userToken` 有商品（cart.test.js 的最後一個 case 加入 2 件商品但未刪除） |
| admin 刪除商品被拒絕 | 商品有 `pending` 訂單時 DELETE 回 409 | 測試需確保訂單已付款或使用未被訂購的商品 |
| DB 非 mock 警告 | 測試共用真實 SQLite 檔案 | 若 test 間資料互相干擾，在 `beforeAll` 中清理目標資料，或使用不同 ID |
| bcrypt 速度 | 生產環境 10 rounds，測試跑很慢 | `NODE_ENV=test` 時自動降為 1 round（在 `database.js` 的 `seedAdminUser` 中控制） |
