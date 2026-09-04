import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Whiteboard',
  description: 'A shared board. Send the link, start moving things around.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  )
}
