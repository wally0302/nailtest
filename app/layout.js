import './globals.css';

export const metadata = {
  title: '美甲預約 | LINE 美甲',
  description: '透過 LINE 預約美甲服務',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
} 