export function normalizeExternalUrl(input: string) {
  const raw = input.trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function openExternalSafely(input: string) {
  const normalized = normalizeExternalUrl(input)
  if (!normalized) return false
  window.open(normalized, '_blank', 'noopener,noreferrer')
  return true
}
