import type { Metadata } from 'next'
import { BoardApp } from '@/components/board/board-app'

/**
 * Kept out of the index, deliberately.
 *
 * A room id is the whole of the access control, so a board that turned up in a
 * search result would be a board handed to a stranger. `/b/` is also an
 * unbounded space of random ids — an infinite crawl that could only dilute the
 * one page actually worth ranking.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function BoardPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params
  return <BoardApp room={room} />
}
