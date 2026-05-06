'use server'

import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getEnterpriseStateValue, setEnterpriseStateValue } from './enterprise-actions'

type AsyncFailureRecord = {
  action: string
  userId: string | null
  payloadHash: string
  errorCode: string
  errorMessage: string
  recoverable: boolean
  createdAt: string
}

function toPayloadHash(payload: unknown) {
  const raw = JSON.stringify(payload || {})
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

export async function logAsyncActionFailure(input: {
  action: string
  payload: unknown
  error: unknown
  recoverable?: boolean
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const recoverable = input.recoverable !== false
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error || 'Unknown error')
  const errorCode = input.error instanceof Error ? input.error.name : 'ACTION_ERROR'
  const row: AsyncFailureRecord = {
    action: input.action,
    userId: auth.user?.id ?? null,
    payloadHash: toPayloadHash(input.payload),
    errorCode,
    errorMessage,
    recoverable,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from('async_action_failures').insert({
    action: row.action,
    user_id: row.userId,
    payload_hash: row.payloadHash,
    error_code: row.errorCode,
    error_message: row.errorMessage,
    recoverable: row.recoverable,
    created_at: row.createdAt,
  } as any)

  if (!error) return { success: true as const }

  const key = 'failed_jobs_queue'
  const current = await getEnterpriseStateValue(key)
  const queue = Array.isArray(current) ? current : []
  const next = [row, ...queue].slice(0, 200)
  await setEnterpriseStateValue(key, next)
  return { success: true as const }
}

export async function withRetry<T>(
  action: string,
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; payload?: unknown },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3)
  const baseDelayMs = Math.max(50, options?.baseDelayMs ?? 180)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
      }
    }
  }

  await logAsyncActionFailure({
    action,
    payload: options?.payload ?? {},
    error: lastError,
    recoverable: true,
  })
  throw (lastError instanceof Error ? lastError : new Error(String(lastError || `Action ${action} failed`)))
}
