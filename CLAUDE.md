# CLAUDE.md

## 專案概述

花卉電商網站 — Express.js + SQLite3 + EJS + Tailwind CSS

提供完整的花卉商品購物流程，包含：前台商品瀏覽與購物車、JWT 會員認證、訂單建立與模擬付款、後台商品與訂單管理。前後端整合於同一 Express 服務，頁面使用 EJS 伺服器端渲染，API 提供 RESTful 端點。

## 常用指令

```bash
# 開發（需分開兩個終端）
npm run dev:server      # 啟動 Express server（port 3001）
npm run dev:css         # 監聽 Tailwind CSS 變更並即時編譯

# 生產啟動（先 build CSS 再啟動）
npm start

# 測試
npm test                # 執行所有測試（依序）

# 產生 OpenAPI 規格
npm run openapi         # 輸出 openapi.json
```

## 關鍵規則

- **購物車雙模式**：API 路由同時支援 Bearer JWT（會員）與 `X-Session-Id` header（訪客），兩種模式都有效時以 JWT 優先；若 Authorization header 存在但 token 無效，直接回傳 401，不 fallback 至 session
- **訂單建立使用 Transaction**：`POST /api/orders` 一次性完成「建立訂單→寫入明細→扣減庫存→清空購物車」，任何步驟失敗都完整 rollback
- **價格單位為整數（新台幣元）**：`price` 欄位存整數，非分或浮點數，前端顯示時直接呈現
- **測試順序有依賴**：`vitest.config.js` 中定義固定執行順序，後面的 test 檔案依賴前面產生的資料（如 orders.test.js 依賴 cart.test.js 建立的購物車），不可變更順序或啟用並行
- **功能開發使用 docs/plans/ 記錄計畫；完成後移至 docs/plans/archive/**

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
