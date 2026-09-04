'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { nanoid } from 'nanoid'

/**
 * The one button on the page.
 *
 * The room id is minted in the browser rather than on the server, so the page
 * itself is fully static and cacheable — which is what lets it be indexed at
 * all. It also means no request is made until somebody actually wants a board.
 */
export function StartBoard({ label = 'Start a board' }: { label?: string }) {
  const router = useRouter()
  const [going, setGoing] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        setGoing(true)
        router.push(`/b/${nanoid(10)}`)
      }}
      className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 disabled:opacity-70"
      disabled={going}
    >
      {going ? 'Opening…' : label}
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}
