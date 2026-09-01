'use server'

import { z } from 'zod'
import { platformServerFetch } from '@/lib/api/platform-server'

const tokenSchema = z.string().min(32).max(100).regex(/^[a-zA-Z0-9_-]+$/)
const fieldsSchema = z.array(z.object({ id: z.string().uuid(), value: z.string().min(1).max(400_000), signatureMethod: z.enum(['typed', 'drawn', 'uploaded']).nullable().optional() })).min(1).max(200)

export type PublicSignatureEnvelope = {
  request: { id: string; title: string; message: string; status: string; expiresAt: string }
  recipient: { id: string; name: string; email: string; status: string }
  document: { filename: string; pageCount: number; url: string }
  fields: Array<{ id: string; field_type: 'signature' | 'date' | 'name' | 'text'; page_number: number; x: number; y: number; width: number; height: number; required: boolean; label: string; completed_at: string | null }>
}

export async function getPublicSignatureEnvelope(token: string): Promise<PublicSignatureEnvelope | { error: string }> {
  const parsed = tokenSchema.safeParse(token); if (!parsed.success) return { error: 'This signing link is invalid.' }
  try { return await platformServerFetch<PublicSignatureEnvelope>(`/api/v1/public/signatures/${encodeURIComponent(parsed.data)}`) }
  catch (error) { return { error: error instanceof Error ? error.message : 'This signing request is unavailable.' } }
}

export async function markPublicSignatureViewed(token: string) {
  const parsed = tokenSchema.safeParse(token); if (!parsed.success) return { error: 'This signing link is invalid.' }
  try { return await platformServerFetch<{ success: boolean }>(`/api/v1/public/signatures/${encodeURIComponent(parsed.data)}/view`, { method: 'POST' }) }
  catch (error) { return { error: error instanceof Error ? error.message : 'The view could not be recorded.' } }
}

export async function completePublicSignature(token: string, fields: z.infer<typeof fieldsSchema>) {
  const parsedToken = tokenSchema.safeParse(token); const parsedFields = fieldsSchema.safeParse(fields)
  if (!parsedToken.success || !parsedFields.success) return { error: 'Complete every required field before submitting.' }
  try { return await platformServerFetch<{ success: boolean; status: string }>(`/api/v1/public/signatures/${encodeURIComponent(parsedToken.data)}/complete`, { method: 'POST', body: JSON.stringify({ fields: parsedFields.data }) }) }
  catch (error) { return { error: error instanceof Error ? error.message : 'The signature could not be submitted.' } }
}

export async function declinePublicSignature(token: string, reason: string) {
  const parsed = tokenSchema.safeParse(token); const parsedReason = z.string().trim().max(1_000).safeParse(reason)
  if (!parsed.success || !parsedReason.success) return { error: 'This signing link is invalid.' }
  try { return await platformServerFetch<{ success: boolean; status: string }>(`/api/v1/public/signatures/${encodeURIComponent(parsed.data)}/decline`, { method: 'POST', body: JSON.stringify({ reason: parsedReason.data }) }) }
  catch (error) { return { error: error instanceof Error ? error.message : 'The request could not be declined.' } }
}
