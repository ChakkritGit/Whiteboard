import type { Swatch } from './types'

/**
 * Board colours: `line` is the full colour (outlines, the picker, the minimap,
 * the highlighter), `tint` is the pastel fill, and `deep` is the text
 * colour that stays readable on it. `night` is the text colour on the dark canvas. `fill`, `ink` and `dot` repeat `tint`, `deep`
 * and `line` as the class or hex the markup wants.
 *
 * Twelve, in hue order, so the picker is two rows of six that read as one
 * continuous spectrum — warm along the top, cool along the bottom, the neutral
 * parked at the end where it belongs. Sorted any other way the grid looks
 * shuffled even though every colour in it is fine on its own, and an odd count
 * leaves a hole in the last row.
 *
 * Kept as literal classes rather than built from the swatch name, because
 * Tailwind only ships the classes it can see written down.
 */
export const PALETTE: Record<
  Swatch,
  {
    fill: string
    ink: string
    dot: string
    deep: string
    line: string
    tint: string
    night: string
  }
> = {
  red: {
    fill: 'bg-[#FCA5A5]',
    ink: 'text-[#7F1D1D]',
    dot: '#EF4444',
    deep: '#7F1D1D',
    line: '#EF4444',
    tint: '#FCA5A5',
    night: '#F87171',
  },
  peach: {
    fill: 'bg-[#FED7AA]',
    ink: 'text-[#7C2D12]',
    dot: '#FB923C',
    deep: '#7C2D12',
    line: '#FB923C',
    tint: '#FED7AA',
    night: '#FB923C',
  },
  amber: {
    fill: 'bg-[#FCD9A0]',
    ink: 'text-[#7C2D12]',
    dot: '#F59E0B',
    deep: '#7C2D12',
    line: '#F59E0B',
    tint: '#FCD9A0',
    night: '#FBBF24',
  },
  yellow: {
    fill: 'bg-[#FDE68A]',
    ink: 'text-[#78350F]',
    dot: '#EAB308',
    deep: '#78350F',
    line: '#EAB308',
    tint: '#FDE68A',
    night: '#FACC15',
  },
  green: {
    fill: 'bg-[#86EFC5]',
    ink: 'text-[#065F46]',
    dot: '#10B981',
    deep: '#065F46',
    line: '#10B981',
    tint: '#86EFC5',
    night: '#34D399',
  },
  mint: {
    fill: 'bg-[#A7F3D0]',
    ink: 'text-[#065F46]',
    dot: '#34D399',
    deep: '#065F46',
    line: '#34D399',
    tint: '#A7F3D0',
    night: '#6EE7B7',
  },
  sky: {
    fill: 'bg-[#BAE0FD]',
    ink: 'text-[#0C4A6E]',
    dot: '#38BDF8',
    deep: '#0C4A6E',
    line: '#38BDF8',
    tint: '#BAE0FD',
    night: '#7DD3FC',
  },
  indigo: {
    fill: 'bg-[#C7D2FE]',
    ink: 'text-[#312E81]',
    dot: '#6366F1',
    deep: '#312E81',
    line: '#6366F1',
    tint: '#C7D2FE',
    night: '#818CF8',
  },
  lavender: {
    fill: 'bg-[#DDD6FE]',
    ink: 'text-[#4C1D95]',
    dot: '#8B5CF6',
    deep: '#4C1D95',
    line: '#8B5CF6',
    tint: '#DDD6FE',
    night: '#A78BFA',
  },
  magenta: {
    fill: 'bg-[#F9A8D4]',
    ink: 'text-[#831843]',
    dot: '#EC4899',
    deep: '#831843',
    line: '#EC4899',
    tint: '#F9A8D4',
    night: '#F472B6',
  },
  pink: {
    fill: 'bg-[#FBCFE8]',
    ink: 'text-[#831843]',
    dot: '#F472B6',
    deep: '#831843',
    line: '#F472B6',
    tint: '#FBCFE8',
    night: '#F9A8D4',
  },
  slate: {
    fill: 'bg-[#E2E8F0]',
    ink: 'text-[#1F2430]',
    dot: '#64748B',
    deep: '#1F2430',
    line: '#64748B',
    tint: '#E2E8F0',
    night: '#CBD5E1',
  },
}

export const SWATCHES = Object.keys(PALETTE) as Swatch[]

/** Colours for the ring round somebody's avatar and their cursor. */
export const PEOPLE_COLORS = [
  '#6366F1',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
]
