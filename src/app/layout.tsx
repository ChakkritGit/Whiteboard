import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { THEME_SCRIPT } from '@/lib/theme-script'
import { SITE } from '@/lib/site'
import './globals.css'

/**
 * What the site tells crawlers and link previews.
 *
 * `metadataBase` is what turns the relative `opengraph-image` into the absolute
 * URL every scraper insists on; without it the preview card comes back with a
 * title, a description and no picture, which is exactly what a shared link
 * looked like.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'online whiteboard',
    'free whiteboard',
    'collaborative whiteboard',
    'whiteboard no sign up',
    'shared canvas',
    'sticky notes online',
    'realtime whiteboard',
    'open source whiteboard',
  ],
  authors: [{ name: 'Chakkrit', url: 'https://chakkritton.com' }],
  creator: 'Chakkrit',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  category: 'productivity',
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
