import './index.css'

export const metadata = {
  title: '知識庫瀏覽器',
  description: '連接你的 Google Drive 知識庫，快速瀏覽與搜尋',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
