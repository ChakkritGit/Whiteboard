import type { Swatch } from './types'

/**
 * Sticky colours, as fill and a darker ink that stays readable on it.
 *
 * Kept as literal classes rather than built from the swatch name, because
 * Tailwind only ships the classes it can see written down.
 */
export const PALETTE: Record<Swatch, { fill: string; ink: string; dot: string }> = {
  yellow: { fill: 'bg-[#FDE68A]', ink: 'text-[#78350F]', dot: '#FDE68A' },
  amber: { fill: 'bg-[#FCD9A0]', ink: 'text-[#7C2D12]', dot: '#FCD9A0' },
  mint: { fill: 'bg-[#A7F3D0]', ink: 'text-[#065F46]', dot: '#A7F3D0' },
  green: { fill: 'bg-[#86EFC5]', ink: 'text-[#065F46]', dot: '#86EFC5' },
  pink: { fill: 'bg-[#FBCFE8]', ink: 'text-[#831843]', dot: '#FBCFE8' },
  magenta: { fill: 'bg-[#F9A8D4]', ink: 'text-[#831843]', dot: '#F9A8D4' },
  sky: { fill: 'bg-[#BAE0FD]', ink: 'text-[#0C4A6E]', dot: '#BAE0FD' },
  indigo: { fill: 'bg-[#C7D2FE]', ink: 'text-[#312E81]', dot: '#C7D2FE' },
  lavender: { fill: 'bg-[#DDD6FE]', ink: 'text-[#4C1D95]', dot: '#DDD6FE' },
  peach: { fill: 'bg-[#FED7AA]', ink: 'text-[#7C2D12]', dot: '#FED7AA' },
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
