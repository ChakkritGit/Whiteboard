import type { Swatch } from './types'

/**
 * Board colours, as Riso inks: `line` is the full ink (outlines, the picker, the
 * minimap, the highlighter), `tint` is the screened fill, and `deep` is the text
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
    fill: 'bg-[#FBC4C9]',
    ink: 'text-[#7A1626]',
    dot: '#F15060',
    deep: '#7A1626',
    line: '#F15060',
    tint: '#FBC4C9',
    night: '#F15060',
  },
  peach: {
    fill: 'bg-[#FFD3BF]',
    ink: 'text-[#7A2A08]',
    dot: '#FF6C2F',
    deep: '#7A2A08',
    line: '#FF6C2F',
    tint: '#FFD3BF',
    night: '#FF6C2F',
  },
  amber: {
    fill: 'bg-[#FFE6A6]',
    ink: 'text-[#6B4500]',
    dot: '#FFB511',
    deep: '#6B4500',
    line: '#FFB511',
    tint: '#FFE6A6',
    night: '#FFB511',
  },
  yellow: {
    fill: 'bg-[#FFF59E]',
    ink: 'text-[#5C5200]',
    dot: '#FFE800',
    deep: '#5C5200',
    line: '#FFE800',
    tint: '#FFF59E',
    night: '#FFE800',
  },
  green: {
    fill: 'bg-[#A8E6C6]',
    ink: 'text-[#00512B]',
    dot: '#00A95C',
    deep: '#00512B',
    line: '#00A95C',
    tint: '#A8E6C6',
    night: '#00A95C',
  },
  mint: {
    fill: 'bg-[#CFF1EF]',
    ink: 'text-[#0E5654]',
    dot: '#82D8D5',
    deep: '#0E5654',
    line: '#82D8D5',
    tint: '#CFF1EF',
    night: '#82D8D5',
  },
  sky: {
    fill: 'bg-[#CDEFF8]',
    ink: 'text-[#0B4F63]',
    dot: '#5EC8E5',
    deep: '#0B4F63',
    line: '#5EC8E5',
    tint: '#CDEFF8',
    night: '#5EC8E5',
  },
  indigo: {
    fill: 'bg-[#B3D7EE]',
    ink: 'text-[#003C61]',
    dot: '#0078BF',
    deep: '#003C61',
    line: '#0078BF',
    tint: '#B3D7EE',
    night: '#5FB4E8',
  },
  lavender: {
    fill: 'bg-[#E0D5F2]',
    ink: 'text-[#44267A]',
    dot: '#9D7AD2',
    deep: '#44267A',
    line: '#9D7AD2',
    tint: '#E0D5F2',
    night: '#9D7AD2',
  },
  magenta: {
    fill: 'bg-[#FFC7E6]',
    ink: 'text-[#8A0F55]',
    dot: '#FF48B0',
    deep: '#8A0F55',
    line: '#FF48B0',
    tint: '#FFC7E6',
    night: '#FF48B0',
  },
  pink: {
    fill: 'bg-[#FDDDEF]',
    ink: 'text-[#7E1F57]',
    dot: '#F984CA',
    deep: '#7E1F57',
    line: '#F984CA',
    tint: '#FDDDEF',
    night: '#F984CA',
  },
  slate: {
    fill: 'bg-[#DCDDE3]',
    ink: 'text-[#22253A]',
    dot: '#3A3F5C',
    deep: '#22253A',
    line: '#3A3F5C',
    tint: '#DCDDE3',
    night: '#DCDDE3',
  },
}

export const SWATCHES = Object.keys(PALETTE) as Swatch[]

/** Colours for the ring round somebody's avatar and their cursor. */
export const PEOPLE_COLORS = [
  '#FF48B0',
  '#0078BF',
  '#00A95C',
  '#FF6C2F',
  '#9D7AD2',
  '#5EC8E5',
  '#F15060',
  '#FFB511',
]
