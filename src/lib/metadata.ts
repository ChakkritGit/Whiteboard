import type { Metadata } from 'next'
import { DICT, type Lang } from '@/lib/dictionary'
import { SITE } from '@/lib/site'

/**
 * One metadata block, in either language.
 *
 * `alternates.languages` is the part that matters and the part easiest to get
 * wrong: each page has to name *both* itself and the other one, or a search
 * engine treats the two as unrelated pages that happen to say the same thing —
 * or worse, as duplicates of each other.
 */
export function siteMetadata(lang: Lang): Metadata {
  const t = DICT[lang]
  // Thai is the default language, so Thai owns the bare path and English is the
  // one with a prefix. Anything that builds a URL reads it from here.
  const path = lang === 'th' ? '/' : '/en'
  const title = `${SITE.name} — ${t.tagline}`

  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s · ${SITE.name}` },
    description: t.metaDescription,
    applicationName: SITE.name,
    keywords:
      lang === 'th'
        ? ['ไวท์บอร์ดออนไลน์', 'ไวท์บอร์ดฟรี', 'กระดานออนไลน์', 'ไวท์บอร์ดไม่ต้องสมัคร', 'วาดรูปออนไลน์ร่วมกัน', 'โน้ตออนไลน์', 'ทำงานร่วมกันเรียลไทม์', 'whiteboard ภาษาไทย']
        : ['online whiteboard', 'free whiteboard', 'collaborative whiteboard', 'whiteboard no sign up', 'shared canvas', 'sticky notes online', 'realtime whiteboard', 'open source whiteboard'],
    authors: [{ name: 'Chakkrit', url: 'https://chakkritton.com' }],
    creator: 'Chakkrit',
    alternates: {
      canonical: path,
      languages: { th: '/', en: '/en', 'x-default': '/' },
    },
    openGraph: {
      type: 'website',
      url: `${SITE.url}${path === '/' ? '' : path}`,
      siteName: SITE.name,
      title,
      description: t.metaDescription,
      locale: lang === 'th' ? 'th_TH' : 'en',
      alternateLocale: lang === 'th' ? 'en' : 'th_TH',
    },
    twitter: { card: 'summary_large_image', title, description: t.metaDescription },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    category: 'productivity',
  }
}
