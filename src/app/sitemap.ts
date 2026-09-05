import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/**
 * Two pages, one in each language, each naming the other.
 *
 * The `alternates` block is what tells a search engine these are the same page
 * in two languages rather than two pages that happen to overlap — without it the
 * Thai one competes with the English one instead of serving Thai readers.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { th: SITE.url, en: `${SITE.url}/en` }
  const common = {
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    alternates: { languages },
  }
  return [
    { url: SITE.url, priority: 1, ...common },
    { url: `${SITE.url}/en`, priority: 0.9, ...common },
  ]
}
