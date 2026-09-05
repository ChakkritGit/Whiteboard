import type { Metadata } from 'next'
import { Shell } from '@/components/shell'
import { siteMetadata } from '@/lib/metadata'
import '../globals.css'

export const metadata: Metadata = siteMetadata('en')

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <Shell lang="en">{children}</Shell>
}
