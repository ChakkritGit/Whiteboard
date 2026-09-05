import type { Metadata } from 'next'
import { Shell } from '@/components/shell'
import { siteMetadata } from '@/lib/metadata'
import '../globals.css'

export const metadata: Metadata = siteMetadata('th')

export default function ThaiLayout({ children }: { children: React.ReactNode }) {
  return <Shell lang="th">{children}</Shell>
}
