import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/**
 * Boards are not for crawling.
 *
 * A room id is the whole of the access control, so a crawler that followed one
 * would be walking into somebody's board — and since `/b/` is an unbounded space
 * of random ids, it would also be an infinite crawl for no gain. Only the front
 * page is offered.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/b/' },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
