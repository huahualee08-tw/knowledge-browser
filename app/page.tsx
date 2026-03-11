import App from '@/src/App'

export const metadata = {
  title: '知識庫瀏覽器',
  description: '連接你的 Google Drive 知識庫，快速瀏覽與搜尋',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <App />
    </main>
  )
}
