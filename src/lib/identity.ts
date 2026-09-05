'use client'

import { nanoid } from 'nanoid'
import { PEOPLE_COLORS } from './palette'

const KEY = 'whiteboard:me'

const ADJECTIVES = ['Quick', 'Calm', 'Bright', 'Bold', 'Kind', 'Sharp', 'Warm', 'Clear']
const ANIMALS = ['Otter', 'Heron', 'Fox', 'Marten', 'Falcon', 'Ibis', 'Lynx', 'Crane']

/**
 * `id` is this browser, not this tab.
 *
 * It survives a refresh, which is the whole point of it: a page that reloads
 * comes back with a new Yjs client id and, for a moment, the room holds both —
 * the one that just left and the one that just arrived. They are the same
 * person, and this is how the board can tell.
 */
export type Me = { id: string; name: string; initials: string; color: string }

/**
 * Who you are on a board, with nobody having signed in.
 *
 * A name and a colour, drawn once and kept in local storage so you are the same
 * person to the room when you come back or open a second board. There is no
 * account behind it and nothing to identify you off this machine — the point of
 * the room is that a link is the only credential.
 */
export function loadMe(): Me {
  if (typeof window === 'undefined') {
    return { id: 'server', name: 'Guest', initials: 'G', color: PEOPLE_COLORS[0] }
  }

  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved) {
      const me = JSON.parse(saved) as Partial<Me>
      // Anyone who was here before ids existed gets one now, once.
      if (me.name && me.color) {
        const whole: Me = {
          id: me.id ?? nanoid(10),
          name: me.name,
          initials: me.initials ?? '?',
          color: me.color,
        }
        if (!me.id) saveMe(whole)
        return whole
      }
    }
  } catch {
    // Private-mode Safari throws on read as well as write; fall through and
    // make somebody up for this session.
  }

  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
  const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
  const me: Me = {
    id: nanoid(10),
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
