import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafeCircle — Shelby County Safety Check',
  description: 'Public safety lookup tool for Shelby County, Tennessee',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
