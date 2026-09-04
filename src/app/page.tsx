import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

/**
 * There is no home page to speak of, because there is nothing to sign in to.
 * Arriving at the root means you want a board, so you get one — a fresh room id,
 * and the URL you are sent to is the only thing anyone needs to join you.
 */
export default async function Home() {
  redirect(`/b/${nanoid(10)}`)
}
