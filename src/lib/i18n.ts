'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DICT, LANG_KEY, type Lang } from './dictionary'

/* ------------------------------ the preference ----------------------------- */

export function readLang(): Lang {
  if (typeof localStorage === 'undefined') return 'en'
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'en' || saved === 'th') return saved
  // Nobody has chosen yet, so ask the browser rather than assuming English.
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('th') ? 'th' : 'en'
}

const listeners = new Set<() => void>()

function subscribe(notify: () => void) {
  listeners.add(notify)
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANG_KEY) notify()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * The board's language.
 *
 * `en` during the server render and until hydration, because the answer lives in
 * local storage — anything drawn from it before then is a mismatch by
 * construction. Labels are `title`/`aria-label` text almost everywhere, so the
 * one frame of English costs nothing visible.
 */
export function useLang() {
  const lang = useSyncExternalStore(subscribe, readLang, () => 'en' as Lang)

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(LANG_KEY, next)
    document.documentElement.lang = next
    listeners.forEach((fn) => fn())
  }, [])

  return { lang, setLang, t: DICT[lang] }
}
