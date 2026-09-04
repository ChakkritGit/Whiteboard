'use client'

import { PEOPLE_COLORS } from './palette'

const KEY = 'whiteboard:me'

const ADJECTIVES = ['Quick', 'Calm', 'Bright', 'Bold', 'Kind', 'Sharp', 'Warm', 'Clear']
const ANIMALS = ['Otter', 'Heron', 'Fox', 'Marten', 'Falcon', 'Ibis', 'Lynx', 'Crane']

export type Me = { name: string; initials: string; color: string }

/**
 * Who you are on a board, with nobody having signed in.
 *
 * A name and a colour, drawn once and kept in local storage so you are the same
 * person to the room when you come back or open a second board. There is no
 * account behind it and nothing to identify you off this machine — the point of
 * the room is that a link is the only credential.
 */
export function loadMe(): Me {
  if (typeof window === 'undefined') return { name: 'Guest', initials: 'G', color: PEOPLE_COLORS[0] }

  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved) return JSON.parse(saved) as Me
  } catch {
    // Private-mode Safari throws on read as well as write; fall through and
    // make somebody up for this session.
  }

  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
  const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
  const me: Me = {
    name,
    initials: name
      .split(' ')
      .map((word) => word[0])
      .join(''),
    color: pick(PEOPLE_COLORS),
  }

  try {
    window.localStorage.setItem(KEY, JSON.stringify(me))
  } catch {}

  return me
}

export function saveMe(me: Me) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(me))
  } catch {}
}
