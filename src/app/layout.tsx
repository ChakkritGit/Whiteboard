import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { THEME_SCRIPT } from '@/lib/theme-script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Whiteboard',
  description: 'A shared board. Send the link, start moving things around.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint, or dark-theme users get a white flash on
            every load that no amount of fixing up afterwards can take back.
            `suppressHydrationWarning` above because this script is what makes
            the server's `<html>` and the browser's differ, on purpose. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
