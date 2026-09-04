import { BoardApp } from '@/components/board/board-app'

export default async function BoardPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params
  return <BoardApp room={room} />
}
