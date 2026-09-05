import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { THEME_SCRIPT } from '@/lib/theme-script'
import type { Lang } from '@/lib/dictionary'

/**
 * The document, shared by both root layouts.
 *
 * There are two of them — one per language — because `<html lang>` is not
 * something a page can set, and a Thai page inside an `lang="en"` document is
 * lying to every screen reader and search engine that reads it. Route groups let
 * each language own a root layout without either owning a URL prefix, so the
 * board still lives at `/b/<id>` with no locale in the link people share.
 */
export function Shell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- that rule is
          for the Pages Router; a root layout in the App Router owns its head,
          and this script has to run before the first paint. */}
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
