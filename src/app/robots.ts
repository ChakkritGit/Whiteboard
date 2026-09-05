import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/**
 * The crawlers that draw a link preview, which are not search crawlers.
 *
 * When somebody pastes a board link into a chat, the app on the other end
 * fetches the page to read its `og:` tags — and the ones listed here check
 * `robots.txt` before they do. A blanket `Disallow: /b/` therefore did not only
 * keep boards out of search results: it also meant a shared board link arrived
 * as bare text, with no title, no description and no image, because the fetch
 * never happened.
 *
 * They get their own group. A crawler that matches a group of its own ignores
 * the `*` group entirely, so this hands the preview bots the board pages and
 * leaves every search crawler where it was. Nothing is given away by it: the
 * board itself is never in the HTML — it arrives over the socket after the page
 * loads — so all these fetch is the same invitation card every board shows.
 *
 * `facebookexternalhit` covers more than Facebook: Messenger, Instagram and
 * LINE's preview fetcher all identify with that token.
 */
const PREVIEW_BOTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'Slackbot-LinkExpanding',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'Applebot',
  'SkypeUriPreview',
  'redditbot',
]

/**
 * Boards are not for crawling.
 *
 * A room id is the whole of the access control, so a crawler that followed one
 * would be walking into somebody's board — and since `/b/` is an unbounded space
 * of random ids, it would also be an infinite crawl for no gain. Only the front
 * page is offered.
 *
 * The board pages also carry `noindex` in their own metadata, so a preview bot
 * that doubles as an indexer still cannot put one in a search result.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: '/b/' },
      { userAgent: PREVIEW_BOTS, allow: '/' },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
