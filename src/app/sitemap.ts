import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/** One page, because one page is all there is to find. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE.url,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
