# 知識庫瀏覽器 (Knowledge Browser)

Google Drive 知識庫管理 Web App - Phase 1 MVP

## 🛠 技術堆疊

- **前端**: React + Vite + Tailwind CSS + TypeScript
- **後端**: Cloudflare Worker
- **認證**: Google OAuth 2.0 (Server-side session)
- **儲存**: Google Drive API (Read-only)

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd /tmp/knowledge-app-design
npm install
```

### 2. 設定 Google OAuth

1. 去 [Google Cloud Console](https://console.cloud.google.com/) 
2. 建立專案 → API 服務 → 憑證
3. 建立 OAuth 2.0 Client ID
4. 設定 Authorized redirect URI:
   - 開發: `http://localhost:8787/auth/callback`
   - 生產: `https://your-worker.workers.dev/auth/callback`

### 3. 設定環境變數

```bash
cp .env.example .dev.vars
# 編輯 .dev.vars 填入你的 Google OAuth 憑證
```

### 4. 啟動開發伺服器

```bash
# 啟動前端 (Vite)
npm run dev

# 啟動後端 (Cloudflare Worker) - 另一個終端機
npx wrangler dev
```

### 5. 部署

```bash
# 部署後端
npx wrangler deploy

# 部署前端 (Vercel / Cloudflare Pages)
npm run build
```

## 📁 專案結構

```
knowledge-app-design/
├── api/
│   └── index.ts          # Cloudflare Worker 後端
├── src/
│   ├── components/        # React 元件
│   │   ├── LoginPage.tsx
│   │   ├── Sidebar.tsx
│   │   ├── FileList.tsx
│   │   ├── FileCard.tsx
│   │   ├── SearchBar.tsx
│   │   └── Preview.tsx
│   ├── hooks/
│   │   └── useAuth.ts    # 認證 hook
│   ├── lib/
│   │   └── api.ts        # API 呼叫
│   ├── types/
│   │   └── index.ts      # TypeScript 類型
│   ├── App.tsx
│   └── main.tsx
├── wrangler.toml         # Cloudflare Worker 設定
├── vite.config.ts
└── tailwind.config.js
```

## 🔐 安全特性

- OAuth token 存伺服器端 (HttpOnly cookie)
- 所有 AI API 呼叫經過後端代理
- CORS 保護
- Session 過期機制

## 📝 待辦

- [ ] 設定 Google OAuth 憑證
- [ ] 設定 KV Namespace for sessions
- [ ] 測試本地開發
- [ ] 部署到 Cloudflare Workers
- [ ] 部署前端到 Vercel/Cloudflare Pages
