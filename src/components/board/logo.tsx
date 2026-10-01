/**
 * The mark.
 *
 * A board with a stroke drawn across it and a note stuck on the corner — the two
 * things this app is for, in one shape, printed in Riso inks: the stroke is a
 * yellow underprint with the blue on top, one pixel out of register. Flat colour
 * and no gradients, so it survives being a 16px favicon as well as it reads at 32.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label="Whiteboard">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="#FF48B0" />
      {/* the stroke somebody drew: the yellow underprint, then the blue on top */}
      <path
        transform="translate(1 1)"
        d="M7.5 21.5c2.6-7.4 5.2-11.1 7.8-11.1 2 0 2.4 2 1.2 4.3-1.1 2.2-2.6 3.2-3.4 2.6-1-.8.3-2.6 3-3.4 2.3-.7 4.6-.5 7 .6"
        fill="none"
        stroke="#FFE800"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 21.5c2.6-7.4 5.2-11.1 7.8-11.1 2 0 2.4 2 1.2 4.3-1.1 2.2-2.6 3.2-3.4 2.6-1-.8.3-2.6 3-3.4 2.3-.7 4.6-.5 7 .6"
        fill="none"
        stroke="#0078BF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the note, with its corner turned up */}
      <path d="M19.5 20.5h6v4.2l-2.6 2.3h-3.4v-6.5Z" fill="#FFB511" />
      <path d="M25.5 24.7h-2.6v2.3" fill="none" stroke="#6B4500" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
