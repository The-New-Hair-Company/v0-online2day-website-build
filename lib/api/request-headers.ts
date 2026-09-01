export function buildApiHeaders(input: HeadersInit | undefined, body: BodyInit | null | undefined, bearerToken?: string) {
  const headers = new Headers(input)
  if (bearerToken) headers.set('Authorization', `Bearer ${bearerToken}`)
  if (body != null && !(body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return headers
}
