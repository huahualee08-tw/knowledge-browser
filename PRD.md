# 知識庫瀏覽器 (Knowledge Browser) - PRD (安全版)

---

## 1. 產品背景

**痛點**：滑滑的 Google Drive 知識庫有很多文件（AI資訊、程式開發、OpenClaw 等），但難以快速找到需要的內容，每次都要一個一個點開看。

**解決方案**：做一個 Web App，讓知識庫可以被快速瀏覽、搜尋。

---

## 2. 產品目標

讓滑滑能 **30 秒內** 找到任何一篇知識庫文件，並快速了解內容摘要。

---

## 3. 使用者故事

| 故事 | 描述 |
|------|------|
| US1 | 我打開 App，可以看到所有知識庫檔案列表 |
| US2 | 我點擊一個檔案，可以看到 AI 生成的摘要 |
| US3 | 我點擊分類（AI資訊、程式開發等），只看到該分類的檔案 |
| US4 | 我輸入關鍵字，立即看到搜尋結果 |
| US5 | 我點擊檔案，可以看到完整內容 |

---

## 4. 功能清單

| ID | 功能 | 優先度 | 說明 |
|----|------|--------|------|
| F01 | Google 登入 | P0 | 用 Google 帳號 OAuth 2.0 認證 |
| F02 | 讀取 Drive 檔案 | P0 | 從 Google Drive 抓檔案列表（僅讀取權限） |
| F03 | 顯示檔案列表 | P0 | 卡片式呈現，包含標題、日期 |
| F04 | AI 摘要 | P0 | Google Gemini API 生成 50-100 字摘要 |
| F05 | 分類篩選 | P1 | 按資料夾（AI資訊、程式開發等）篩選 |
| F06 | 關鍵字搜尋 | P1 | 搜尋標題、摘要、內容 |
| F07 | 檔案預覽 | P0 | 點擊後顯示完整 Markdown 內容 |
| F08 | 收藏功能 | P2 | 標記常用檔案 |
| F09 | 深色模式 | P2 | 護眼深色主題 |

---

## 5. 資料來源

```
~/Google Drive/我的雲端硬碟/
├── AI資訊/           ← 放 AI 相關文章
├── 程式開發/         ← 放程式筆記
├── OpenClaw/         ← 放 OpenClaw 相關
├── YouTube_影片摘要/ ← 放 YouTube 筆記
├── 個人成長/
├── 投資理財/
└── 其他/
```

**支援格式**：`.md`, `.txt`

---

## 6. UI 設計

### 6.1 版面（三欄）

```
┌──────────┬──────────────────┬───────────────────┐
│ 📁 分類   │ 📋 檔案列表      │ 📄 預覽           │
│          │                  │                   │
│ 全部     │ [卡片] 檔案A     │ 標題：檔案A       │
│ AI資訊   │   摘要：...      │ 摘要：...         │
│ 程式開發 │                  │                   │
│ OpenClaw │ [卡片] 檔案B     │ # 內容...         │
│ YouTube  │   摘要：...      │                   │
│          │                  │ [打開看完整]      │
└──────────┴──────────────────┴───────────────────┘
```

### 6.2 檔案卡片

```
┌──────────────────────────────┐
│ 📄 OpenClaw API 整理          │
│                              │
│ 摘要：免費 AI API 來源整理... │
│                              │
│ 🏷️ AI資訊  📅 2026-03-09    │
└──────────────────────────────┘
```

---

## 7. 技術架構

| 層面 | 技術 |
|------|------|
| 前端 | React + Vite + Tailwind |
| 認證 | Google OAuth 2.0（使用 Firebase Auth 或 Auth.js） |
| 後端 API | Cloudflare Workers（處理 API 請求） |
| 儲存 | Google Drive API（僅讀取） |
| AI | Google Gemini API（生成摘要） |
| 部署 | Vercel + Cloudflare |

---

## 8. 安全性設計（⚠️ 重要）

### 8.1 Google OAuth 安全

| 安全措施 | 說明 |
|----------|------|
| **僅申請讀取權限** | 只請求 `drive.readonly` scope，不請求寫入權限 |
| **Token 存伺服器端** | Access Token / Refresh Token 存 Cloudflare Workers 環境變數，不存客戶端 |
| **Scope 限制** | 限制只能存取特定資料夾 |
| **HTTPS 強制** | 強制使用 HTTPS |
| **Token 過期處理** | 自動刷新過期的 Refresh Token |

### 8.2 API Key 安全

| 安全措施 | 說明 |
|----------|------|
| **環境變數存儲** | API Key 存 Cloudflare Workers / Vercel 環境變數 |
| **不暴露在前端** | 前端程式碼完全不包含任何 API Key |
| **後端代理** | 所有 AI API 呼叫都經過後端伺服器（Google Gemini） |
| **請求驗證** | 後端驗證請求來源（Origin header） |
| **日誌脫敏** | 日誌中不記錄敏感資訊 |

### 8.3 資料傳輸

```
┌──────────┐     HTTPS      ┌───────────────┐
│  Client  │ ◄────────────► │ Cloudflare    │
│ (React)  │   加密傳輸      │ Workers       │
└──────────┘                └───────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              Google Drive        Google Gemini    本地快取
                  API              API       (瀏覽器端)
```

### 8.4 權限最小化原則

- Google OAuth scope：
  ```
  https://www.googleapis.com/auth/drive.readonly
  https://www.googleapis.com/auth/userinfo.email
  ```
- 只存取用戶授權的特定資料夾

---

## 9. 開發順序

```
Phase 1：基礎功能 + 安全
├── F01 Google 登入（安全實作）
├── F02 讀取 Drive 檔案
└── F03 顯示檔案列表

Phase 2：智慧化
├── F04 AI 摘要（後端代理）
└── F05 分類篩選

Phase 3：搜尋與優化
├── F06 關鍵字搜尋
├── F07 檔案預覽
└── F08 收藏功能
```

---

## 10. 驗收標準

### 功能
- [ ] 可用 Google 帳號登入
- [ ] 顯示 Google Drive 知識庫所有 .md/.txt 檔案
- [ ] 每個檔案有 AI 摘要（50-100 字）
- [ ] 可按分類篩選
- [ ] 可關鍵字搜尋
- [ ] 點擊可看完整內容
- [ ] 手機可正常瀏覽

### 安全
- [ ] OAuth token 存伺服器端，不存客戶端
- [ ] API Key 不暴露在前端
- [ ] 所有 API 請求走 HTTPS
- [ ] 後端驗證請求來源
- [ ] 僅申請讀取權限（不含寫入）

---

## 11. 檔案結構

```
knowledge-browser/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx      # 分類側邊欄
│   │   ├── FileList.tsx    # 檔案列表
│   │   ├── FileCard.tsx    # 檔案卡片
│   │   ├── Preview.tsx     # 檔案預覽
│   │   └── SearchBar.tsx   # 搜尋列
│   ├── hooks/
│   │   └── useAuth.ts      # OAuth 認證
│   ├── lib/
│   │   └── api.ts          # API 呼叫（後端代理）
│   ├── types/
│   │   └── index.ts        # TypeScript 類型
│   ├── App.tsx
│   └── main.tsx
├── api/                    # Cloudflare Workers 後端
│   └── index.ts
├── .env.example            # 環境變數範例
├── package.json
├── vite.config.ts
└── SPEC.md
```

---

*PRD 版本：v1.1（安全強化版）| 2026-03-10*
