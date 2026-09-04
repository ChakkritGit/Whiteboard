import type { Swatch } from './types'

/**
 * Board colours: a fill, a darker ink that stays readable on it, and the flat
 * hex the picker and the minimap draw.
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
export const PALETTE: Record<Swatch, { fill: string; ink: string; dot: string; deep: string }> = {
  red: { fill: 'bg-[#FCA5A5]', ink: 'text-[#7F1D1D]', dot: '#FCA5A5', deep: '#7F1D1D' },
  peach: { fill: 'bg-[#FED7AA]', ink: 'text-[#7C2D12]', dot: '#FED7AA', deep: '#7C2D12' },
  amber: { fill: 'bg-[#FCD9A0]', ink: 'text-[#7C2D12]', dot: '#FCD9A0', deep: '#92400E' },
  yellow: { fill: 'bg-[#FDE68A]', ink: 'text-[#78350F]', dot: '#FDE68A', deep: '#78350F' },
  green: { fill: 'bg-[#86EFC5]', ink: 'text-[#065F46]', dot: '#86EFC5', deep: '#065F46' },
  mint: { fill: 'bg-[#A7F3D0]', ink: 'text-[#065F46]', dot: '#A7F3D0', deep: '#047857' },
  sky: { fill: 'bg-[#BAE0FD]', ink: 'text-[#0C4A6E]', dot: '#BAE0FD', deep: '#0C4A6E' },
  indigo: { fill: 'bg-[#C7D2FE]', ink: 'text-[#312E81]', dot: '#C7D2FE', deep: '#312E81' },
  lavender: { fill: 'bg-[#DDD6FE]', ink: 'text-[#4C1D95]', dot: '#DDD6FE', deep: '#4C1D95' },
  magenta: { fill: 'bg-[#F9A8D4]', ink: 'text-[#831843]', dot: '#F9A8D4', deep: '#9D174D' },
  pink: { fill: 'bg-[#FBCFE8]', ink: 'text-[#831843]', dot: '#FBCFE8', deep: '#831843' },
  slate: { fill: 'bg-[#E2E8F0]', ink: 'text-[#1F2430]', dot: '#E2E8F0', deep: '#1F2430' },
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
