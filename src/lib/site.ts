/**
 * What the site says about itself, in one place.
 *
 * The canonical origin is read from the environment where there is one, so a
 * preview deployment does not advertise the production URL as its canonical and
 * quietly ask search engines to ignore it.
 */
export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://whiteboard.chakkritton.com',
  name: 'Whiteboard',
  tagline: 'A shared whiteboard with nothing to sign in to',
  description:
    'A free online whiteboard you can share with a link. No account, no install — open a board, send the URL, and everyone draws, writes and moves sticky notes together in real time. Export and import your board as a file.',
  repo: 'https://github.com/ChakkritGit/Whiteboard',
} as const
