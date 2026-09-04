/**
 * The stored theme preference, and the snippet that applies it before paint.
 *
 * Deliberately not in `theme.ts`: that file is `'use client'`, and everything a
 * client module exports becomes a client reference when a server component
 * imports it — including a plain string. The root layout is a server component
 * and needs the literal text of the script, so it lives here, where both sides
 * can read it.
 */
export const THEME_KEY = 'whiteboard:theme'

/**
 * Runs from the document head, before the first paint.
 *
 * Without it the page paints light, React mounts, and it turns dark: a white
 * flash on every single load for anyone who chose dark, which nothing done
 * afterwards can undo. Wrapped in try/catch because a browser with storage
 * blocked should still get a board, just a light one.
 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_KEY}')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`
