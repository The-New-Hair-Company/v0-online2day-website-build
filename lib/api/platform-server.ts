import 'server-only'
import { buildApiHeaders } from './request-headers'

function apiBase() {
  const value = process.env.COMPANY_PLATFORM_API_URL || process.env.DOTNET_API_URL
  if (!value) throw new Error('Company Platform API is not configured')
  return new URL(value)
}

type PlatformRequestOptions = RequestInit & {
  accessToken?: string
  serviceRequest?: boolean
}

export async function platformServerFetch<T>(path: string, options: PlatformRequestOptions = {}): Promise<T> {
  const { accessToken, serviceRequest, ...requestInit } = options
  const headers = buildApiHeaders(requestInit.headers, requestInit.body, accessToken)
  if (serviceRequest) {
    const key = process.env.GATEWAY_SERVER_KEY
    if (!key) throw new Error('Gateway server authentication is not configured')
    headers.set('X-Online2Day-Gateway-Key', key)
  }

  const response = await fetch(new URL(path, apiBase()), {
    ...requestInit,
    headers,
    cache: 'no-store',
    signal: requestInit.signal ?? AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Handled as a generic upstream error below.
  }
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : `Company Platform API error ${response.status}`
    throw new Error(detail)
  }
  return body as T
}
