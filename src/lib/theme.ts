'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { THEME_KEY } from './theme-script'

/**
 * Light, dark, or whatever the machine says.
 *
 * "System" is a real third choice rather than the absence of a choice: it has to
 * keep tracking the OS after the page has loaded, so someone whose Mac turns
 * dark at sunset sees the board turn with it. That means a stored preference of
 * three values and a live `matchMedia` subscription, not a boolean.
 *
 * The resolved theme is written to `<html data-theme>` — one attribute the CSS
 * keys off, so nothing in the tree has to be told about the change.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = THEME_KEY

export function readMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  const saved = localStorage.getItem(KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function prefersDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolve(mode)
}

/** Everything that can change the answer, in one subscription. */
const listeners = new Set<() => void>()

function subscribe(notify: () => void) {
  listeners.add(notify)
  const media = matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => {
    // Only matters while following the system, but re-applying is harmless and
    // saves keeping the branch in two places.
    if (readMode() === 'system') applyTheme('system')
    notify()
  }
  media.addEventListener('change', onSystem)
  // Another tab is another copy of the same preference.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    applyTheme(readMode())
    notify()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    media.removeEventListener('change', onSystem)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, readMode, () => 'system' as ThemeMode)

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(KEY, next)
    applyTheme(next)
    listeners.forEach((fn) => fn())
  }, [])

  return { mode, setMode }
}
