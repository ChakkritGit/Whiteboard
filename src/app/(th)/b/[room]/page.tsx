import type { Metadata } from 'next'
import { BoardApp } from '@/components/board/board-app'
import { SITE } from '@/lib/site'

/**
 * What a shared board link looks like in a chat.
 *
 * A board link is almost never typed — it is pasted to somebody, so the preview
 * card is the first thing anyone sees of this app. It said the same thing the
 * front page says, and pointed at the front page's URL, so every board someone
 * shared collapsed into one card that read like an advert rather than an
 * invitation.
 *
 * Its own URL, then, and its own words. The room id goes in the link and not in
 * the text: a preview is quoted onward and pasted into other places, and the id
 * is the whole of the access control.
 *
 * Still `noindex`. Being fetchable by the app that draws the card is a different
 * thing from being listed in a search result — see `robots.ts`, which lets the
 * preview crawlers through and no one else.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ room: string }>
}): Promise<Metadata> {
  const { room } = await params
  const path = `/b/${room}`
  const title = 'มีคนชวนคุณเข้าบอร์ด'
  const description =
    'เปิดลิงก์แล้ววาด เขียน และเลื่อนโน้ตด้วยกันได้ทันทีแบบเรียลไทม์ ไม่ต้องสมัครสมาชิก ไม่ต้องติดตั้ง'

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: `${SITE.url}${path}`,
      siteName: SITE.name,
      title: `${title} · ${SITE.name}`,
      description,
      locale: 'th_TH',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE.name}`,
      description,
    },
    robots: { index: false, follow: false, nocache: true },
  }
}

export default async function BoardPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params
  return <BoardApp room={room} />
}
