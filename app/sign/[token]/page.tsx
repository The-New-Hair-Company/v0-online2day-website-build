import { notFound } from 'next/navigation'
import { getPublicSignatureEnvelope } from '@/lib/actions/signature-public-actions'
import { SignatureClient } from './signature-client'

export const dynamic = 'force-dynamic'

export default async function SignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const envelope = await getPublicSignatureEnvelope(token)
  if ('error' in envelope && envelope.error.toLowerCase().includes('invalid')) notFound()
  return <SignatureClient token={token} initial={envelope} />
}
