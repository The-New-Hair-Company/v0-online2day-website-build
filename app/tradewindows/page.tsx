import type { Metadata } from 'next'
import { TradeWindowsClient } from './trade-windows-client'

export const metadata: Metadata = {
  title: 'Trade Windows Operations Platform',
  description: 'A secure demonstration of the connected Trade Windows customer and operations platform.',
  robots: { index: false, follow: false },
}

export default function TradeWindowsPage() {
  return <TradeWindowsClient />
}
