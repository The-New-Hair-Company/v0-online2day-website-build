import type { FastifyInstance, FastifyRequest } from 'fastify'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import {
  MAX_PDF_BYTES, PDF_MIME, createSigningToken, normaliseSubject, parseMailbox,
  renderCompletedPdf, safeFilename, sanitiseEmailHtml, sha256,
} from './platform-utils.js'

type JsonRequest = <T>(url: string, init: RequestInit, attempts?: number) => Promise<T>
type SupabaseRequest = <T>(path: string, init?: RequestInit) => Promise<T>

type PlatformRouteDeps = {
  config: {
    supabaseUrl: string
    supabaseServiceRoleKey: string
    resendApiKey: string
    siteUrl: string
    emailFrom: string
    emailReplyTo: string
    gatewayServerKey: string
  }
  requireAdmin: (request: FastifyRequest) => Promise<Record<string, unknown>>
  requireServerKey: (request: FastifyRequest) => Promise<void>
  requestJson: JsonRequest
  supabaseFetch: SupabaseRequest
  supabaseStorageFetch: SupabaseRequest
}

type DocumentRow = {
  id: string
  owner_user_id: string
  lead_id: string | null
  filename: string
  safe_filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  sha256: string
  document_kind: string
  page_count: number | null
  created_at: string
}

const uuid = z.string().uuid()
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const addressList = z.array(email).max(50).default([])
const documentKind = z.enum(['attachment', 'signature_original'])
const documentUploadSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  mimeType: z.literal(PDF_MIME),
  sizeBytes: z.number().int().positive().max(MAX_PDF_BYTES),
  kind: documentKind.default('attachment'),
})
const completeDocumentSchema = documentUploadSchema.extend({
  storagePath: z.string().trim().min(1).max(700),
  leadId: uuid.nullable().optional(),
})

const signatureFieldSchema = z.object({
  fieldType: z.enum(['signature', 'date', 'name', 'text']),
  pageNumber: z.number().int().min(1).max(2_000),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1),
  required: z.boolean().default(true), label: z.string().trim().max(120).default(''),
}).refine((field) => field.x + field.width <= 1.000001 && field.y + field.height <= 1.000001, 'Signature field must fit on the page.')

const signatureCreateSchema = z.object({
  documentId: uuid,
  leadId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(180),
  message: z.string().trim().max(5_000).default(''),
  expiresAt: z.string().datetime().optional(),
  recipients: z.array(z.object({
    name: z.string().trim().min(1).max(160), email,
    signingOrder: z.number().int().min(1).max(100).default(1),
    fields: z.array(signatureFieldSchema).min(1).max(100),
  })).min(1).max(20),
})

const signatureCompleteSchema = z.object({
  fields: z.array(z.object({
    id: uuid,
    value: z.string().min(1).max(400_000),
    signatureMethod: z.enum(['typed', 'drawn', 'uploaded']).nullable().optional(),
  })).min(1).max(200),
})

function serviceHeaders(deps: PlatformRouteDeps, additional?: HeadersInit) {
  const headers = new Headers(additional)
  headers.set('apikey', deps.config.supabaseServiceRoleKey)
  headers.set('Authorization', `Bearer ${deps.config.supabaseServiceRoleKey}`)
  return headers
}

async function storageResponse(deps: PlatformRouteDeps, path: string, init: RequestInit = {}) {
  const response = await fetch(`${deps.config.supabaseUrl}/storage/v1/${path}`, {
    ...init,
    headers: serviceHeaders(deps, init.headers),
    signal: init.signal ?? AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw Object.assign(new Error(`Storage operation failed (${response.status}).`), { statusCode: response.status === 404 ? 404 : 502 })
  return response
}

async function fetchDocumentBytes(deps: PlatformRouteDeps, storagePath: string) {
  const response = await storageResponse(deps, `object/platform-documents/${encodeStoragePath(storagePath)}`)
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > MAX_PDF_BYTES) throw Object.assign(new Error('PDF exceeds the 25 MB limit.'), { statusCode: 413 })
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < 5 || bytes.byteLength > MAX_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') {
    throw Object.assign(new Error('The uploaded file is not a valid PDF.'), { statusCode: 400 })
  }
  return bytes
}

function encodeStoragePath(value: string) {
  return value.split('/').map(encodeURIComponent).join('/')
}

async function signedDownload(deps: PlatformRouteDeps, bucket: string, path: string, expiresIn = 900) {
  const result = await deps.supabaseStorageFetch<{ signedURL?: string; signedUrl?: string }>(
    `object/sign/${bucket}/${encodeStoragePath(path)}`,
    { method: 'POST', body: JSON.stringify({ expiresIn }) },
  )
  const relative = result.signedURL || result.signedUrl
  if (!relative) throw new Error('Secure download URL could not be created.')
  return relative.startsWith('http') ? relative : `${deps.config.supabaseUrl}/storage/v1${relative.startsWith('/') ? '' : '/'}${relative}`
}

async function uploadPdf(deps: PlatformRouteDeps, storagePath: string, bytes: Uint8Array) {
  await storageResponse(deps, `object/platform-documents/${encodeStoragePath(storagePath)}`, {
    method: 'POST', headers: { 'Content-Type': PDF_MIME, 'x-upsert': 'false' }, body: Buffer.from(bytes),
  })
}

async function ownedDocument(deps: PlatformRouteDeps, documentId: string, ownerId: string) {
  const rows = await deps.supabaseFetch<DocumentRow[]>(
    `platform_documents?id=eq.${encodeURIComponent(documentId)}&owner_user_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (!rows[0]) throw Object.assign(new Error('Document not found.'), { statusCode: 404 })
  return rows[0]
}

function requestIdentity(request: FastifyRequest, secret: string) {
  return {
    ip_hash: sha256(`${secret}:ip:${request.ip || ''}`),
    user_agent_hash: sha256(`${secret}:ua:${request.headers['user-agent'] || ''}`),
  }
}

async function sendResend(deps: PlatformRouteDeps, payload: Record<string, unknown>, idempotencyKey?: string) {
  if (!deps.config.resendApiKey) throw Object.assign(new Error('Email delivery is not configured.'), { statusCode: 503 })
  return deps.requestJson<{ id: string }>('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deps.config.resendApiKey}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: JSON.stringify(payload),
  })
}

export function registerPlatformRoutes(app: FastifyInstance, deps: PlatformRouteDeps) {
  app.post('/api/v1/online2day/documents/uploads', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub)
    const body = documentUploadSchema.parse(request.body)
    const filename = safeFilename(body.filename)
    const storagePath = `${ownerId}/${body.kind}/${crypto.randomUUID()}-${filename}`
    const signed = await deps.supabaseStorageFetch<{ url: string }>(`object/upload/sign/platform-documents/${encodeStoragePath(storagePath)}`, { method: 'POST', body: '{}' })
    const uploadUrl = new URL(signed.url, `${deps.config.supabaseUrl}/storage/v1/`).toString()
    return reply.code(201).send({ storagePath, uploadUrl, expiresIn: 7_200 })
  })

  app.post('/api/v1/online2day/documents', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub)
    const body = completeDocumentSchema.parse(request.body)
    if (!body.storagePath.startsWith(`${ownerId}/`)) throw Object.assign(new Error('Document path is not authorised.'), { statusCode: 403 })
    const bytes = await fetchDocumentBytes(deps, body.storagePath)
    if (bytes.byteLength !== body.sizeBytes) throw Object.assign(new Error('Uploaded PDF size does not match the declared file.'), { statusCode: 400 })
    let pageCount = 0
    try { pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: false })).getPageCount() } catch { throw Object.assign(new Error('The PDF is encrypted, damaged or unreadable.'), { statusCode: 400 }) }
    const rows = await deps.supabaseFetch<DocumentRow[]>('platform_documents?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ owner_user_id: ownerId, lead_id: body.leadId || null, filename: body.filename, safe_filename: safeFilename(body.filename), mime_type: body.mimeType, size_bytes: bytes.byteLength, storage_path: body.storagePath, sha256: sha256(bytes), document_kind: body.kind, page_count: pageCount }),
    })
    request.log.info({ documentId: rows[0]?.id, sizeBytes: bytes.byteLength, pageCount }, 'Document upload registered')
    return reply.code(201).send(rows[0])
  })

  app.get('/api/v1/online2day/documents', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request)
    return deps.supabaseFetch<DocumentRow[]>(`platform_documents?owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=*&order=created_at.desc&limit=200`, { headers: { Accept: 'application/json' } })
  })

  app.get('/api/v1/online2day/documents/:id/download', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params)
    const document = await ownedDocument(deps, params.id, String(user.sub))
    return { url: await signedDownload(deps, 'platform-documents', document.storage_path), filename: document.safe_filename, expiresIn: 900 }
  })

  app.delete('/api/v1/online2day/documents/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params)
    const document = await ownedDocument(deps, params.id, String(user.sub))
    await deps.supabaseFetch(`platform_documents?id=eq.${encodeURIComponent(params.id)}&owner_user_id=eq.${encodeURIComponent(String(user.sub))}`, { method: 'DELETE' })
    await storageResponse(deps, `object/platform-documents/${encodeStoragePath(document.storage_path)}`, { method: 'DELETE' }).catch((error) => request.log.warn({ err: error, documentId: params.id }, 'Orphan document cleanup failed'))
    return reply.code(204).send()
  })

  app.post('/api/v1/online2day/signature-requests', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub); const body = signatureCreateSchema.parse(request.body)
    const document = await ownedDocument(deps, body.documentId, ownerId)
    if (body.recipients.some((recipient) => recipient.fields.some((field) => field.pageNumber > (document.page_count || 0)))) throw Object.assign(new Error('A signature field is outside the uploaded PDF.'), { statusCode: 400 })
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 14 * 86_400_000)
    if (expiresAt.getTime() <= Date.now() + 300_000) throw Object.assign(new Error('Expiry must be at least five minutes in the future.'), { statusCode: 400 })
    const requests = await deps.supabaseFetch<Array<{ id: string }>>('signature_requests?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_user_id: ownerId, lead_id: body.leadId || null, document_id: document.id, title: body.title, message: body.message, status: 'draft', expires_at: expiresAt.toISOString() }) })
    const signatureRequest = requests[0]
    if (!signatureRequest) throw new Error('Signature request could not be created.')
    const links: Array<{ recipientId: string; name: string; email: string; url: string }> = []
    try {
      for (const recipient of body.recipients) {
        const generated = createSigningToken()
        const recipients = await deps.supabaseFetch<Array<{ id: string }>>('signature_recipients?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ request_id: signatureRequest.id, signing_order: recipient.signingOrder, name: recipient.name, email: recipient.email, token_hash: generated.tokenHash, status: 'pending' }) })
        const created = recipients[0]; if (!created) throw new Error('Signature recipient could not be created.')
        await deps.supabaseFetch('signature_fields', { method: 'POST', body: JSON.stringify(recipient.fields.map((field) => ({ request_id: signatureRequest.id, recipient_id: created.id, field_type: field.fieldType, page_number: field.pageNumber, x: field.x, y: field.y, width: field.width, height: field.height, required: field.required, label: field.label }))) })
        links.push({ recipientId: created.id, name: recipient.name, email: recipient.email, url: `${deps.config.siteUrl}/sign/${generated.token}` })
      }
      for (const link of links) {
        await sendResend(deps, { from: deps.config.emailFrom, to: [link.email], reply_to: deps.config.emailReplyTo, subject: `Signature requested: ${body.title}`, html: `<p>Hi ${link.name.replace(/[<>&"']/g, '')},</p><p>${(body.message || 'Please review and sign the attached document.').replace(/[<>&"']/g, '')}</p><p><a href="${link.url}">Review and sign securely</a></p><p>This link expires ${expiresAt.toISOString()}.</p>` }, `signature-${signatureRequest.id}-${link.recipientId}`)
      }
      await deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }) })
      await deps.supabaseFetch(`signature_recipients?request_id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'sent', last_sent_at: new Date().toISOString() }) })
      await deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: signatureRequest.id, event_type: 'request.sent', actor_type: 'sender', actor_user_id: ownerId, metadata: { recipientCount: links.length, documentHash: document.sha256 } }) })
      request.log.info({ signatureRequestId: signatureRequest.id, recipients: links.length }, 'Signature request sent')
      return reply.code(201).send({ id: signatureRequest.id, status: 'sent', recipients: links })
    } catch (error) {
      await deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'DELETE' }).catch(() => undefined)
      throw error
    }
  })

  app.get('/api/v1/online2day/signature-requests', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request)
    return deps.supabaseFetch(`signature_requests?owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=*,document:platform_documents!signature_requests_document_id_fkey(id,filename,safe_filename,size_bytes,page_count,sha256),recipients:signature_recipients(id,name,email,status,signing_order,viewed_at,signed_at,declined_at)&order=created_at.desc&limit=200`, { headers: { Accept: 'application/json' } })
  })

  app.patch('/api/v1/online2day/signature-requests/:id/cancel', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params); const now = new Date().toISOString()
    const rows = await deps.supabaseFetch<Array<{ id: string }>>(`signature_requests?id=eq.${params.id}&owner_user_id=eq.${encodeURIComponent(String(user.sub))}&status=in.(draft,sent,viewed,partially_signed)&select=id`, { headers: { Accept: 'application/json' } })
    if (!rows[0]) return reply.code(404).send({ error: 'Active signature request not found.' })
    await Promise.all([
      deps.supabaseFetch(`signature_requests?id=eq.${params.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', cancelled_at: now }) }),
      deps.supabaseFetch(`signature_recipients?request_id=eq.${params.id}&status=neq.signed`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
      deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: params.id, event_type: 'request.cancelled', actor_type: 'sender', actor_user_id: String(user.sub) }) }),
    ])
    return { success: true }
  })

  app.get('/api/v1/public/signatures/:token', async (request, reply) => {
    const params = z.object({ token: z.string().min(32).max(100) }).parse(request.params); const tokenHash = sha256(params.token)
    const recipients = await deps.supabaseFetch<Array<{ id: string; request_id: string; name: string; email: string; status: string }>>(`signature_recipients?token_hash=eq.${tokenHash}&select=id,request_id,name,email,status&limit=1`, { headers: { Accept: 'application/json' } })
    const recipient = recipients[0]; if (!recipient) return reply.code(404).send({ error: 'Signing link is invalid.' })
    const requests = await deps.supabaseFetch<Array<{ id: string; title: string; message: string; status: string; expires_at: string; document_id: string }>>(`signature_requests?id=eq.${recipient.request_id}&select=id,title,message,status,expires_at,document_id&limit=1`, { headers: { Accept: 'application/json' } })
    const signatureRequest = requests[0]
    if (!signatureRequest || ['cancelled', 'expired'].includes(signatureRequest.status)) return reply.code(410).send({ error: 'This signing request is no longer active.' })
    if (new Date(signatureRequest.expires_at).getTime() <= Date.now()) { await deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'expired' }) }); return reply.code(410).send({ error: 'This signing link has expired.' }) }
    const documents = await deps.supabaseFetch<DocumentRow[]>(`platform_documents?id=eq.${signatureRequest.document_id}&select=*&limit=1`, { headers: { Accept: 'application/json' } })
    const fields = await deps.supabaseFetch(`signature_fields?request_id=eq.${signatureRequest.id}&recipient_id=eq.${recipient.id}&select=id,field_type,page_number,x,y,width,height,required,label,completed_at&order=page_number.asc`, { headers: { Accept: 'application/json' } })
    const document = documents[0]; if (!document) throw new Error('Signature document is unavailable.')
    return { request: { id: signatureRequest.id, title: signatureRequest.title, message: signatureRequest.message, status: signatureRequest.status, expiresAt: signatureRequest.expires_at }, recipient: { id: recipient.id, name: recipient.name, email: recipient.email, status: recipient.status }, document: { filename: document.safe_filename, pageCount: document.page_count, url: await signedDownload(deps, 'platform-documents', document.storage_path, 600) }, fields }
  })

  app.post('/api/v1/public/signatures/:token/view', async (request) => {
    const params = z.object({ token: z.string().min(32).max(100) }).parse(request.params); const tokenHash = sha256(params.token); const now = new Date().toISOString()
    const recipients = await deps.supabaseFetch<Array<{ id: string; request_id: string; status: string }>>(`signature_recipients?token_hash=eq.${tokenHash}&select=id,request_id,status&limit=1`, { headers: { Accept: 'application/json' } })
    const recipient = recipients[0]; if (!recipient) throw Object.assign(new Error('Signing link is invalid.'), { statusCode: 404 })
    if (!recipient.status || ['pending', 'sent'].includes(recipient.status)) {
      await Promise.all([
        deps.supabaseFetch(`signature_recipients?id=eq.${recipient.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'viewed', viewed_at: now }) }),
        deps.supabaseFetch(`signature_requests?id=eq.${recipient.request_id}&status=eq.sent`, { method: 'PATCH', body: JSON.stringify({ status: 'viewed' }) }),
        deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: recipient.request_id, recipient_id: recipient.id, event_type: 'recipient.viewed', actor_type: 'recipient', ...requestIdentity(request, deps.config.gatewayServerKey) }) }),
      ])
    }
    return { success: true }
  })

  app.post('/api/v1/public/signatures/:token/complete', async (request, reply) => {
    const params = z.object({ token: z.string().min(32).max(100) }).parse(request.params); const body = signatureCompleteSchema.parse(request.body); const tokenHash = sha256(params.token); const now = new Date()
    const recipients = await deps.supabaseFetch<Array<{ id: string; request_id: string; name: string; email: string; status: string }>>(`signature_recipients?token_hash=eq.${tokenHash}&select=id,request_id,name,email,status&limit=1`, { headers: { Accept: 'application/json' } })
    const recipient = recipients[0]; if (!recipient) return reply.code(404).send({ error: 'Signing link is invalid.' }); if (recipient.status === 'signed') return { success: true, status: 'signed' }
    const requests = await deps.supabaseFetch<Array<{ id: string; owner_user_id: string; document_id: string; title: string; status: string; expires_at: string }>>(`signature_requests?id=eq.${recipient.request_id}&select=id,owner_user_id,document_id,title,status,expires_at&limit=1`, { headers: { Accept: 'application/json' } })
    const signatureRequest = requests[0]; if (!signatureRequest || ['cancelled', 'expired', 'completed'].includes(signatureRequest.status) || new Date(signatureRequest.expires_at).getTime() <= Date.now()) return reply.code(410).send({ error: 'This signing request is no longer active.' })
    const fields = await deps.supabaseFetch<Array<{ id: string; field_type: string; required: boolean }>>(`signature_fields?request_id=eq.${signatureRequest.id}&recipient_id=eq.${recipient.id}&select=id,field_type,required`, { headers: { Accept: 'application/json' } })
    const allowedIds = new Set(fields.map((field) => field.id)); if (body.fields.some((field) => !allowedIds.has(field.id))) return reply.code(403).send({ error: 'A submitted field is not assigned to this signer.' })
    const submitted = new Map(body.fields.map((field) => [field.id, field])); if (fields.some((field) => field.required && !submitted.get(field.id)?.value.trim())) return reply.code(400).send({ error: 'Complete every required field.' })
    for (const field of body.fields) await deps.supabaseFetch(`signature_fields?id=eq.${field.id}&recipient_id=eq.${recipient.id}`, { method: 'PATCH', body: JSON.stringify({ value: field.value, signature_method: field.signatureMethod || null, completed_at: now.toISOString() }) })
    await deps.supabaseFetch(`signature_recipients?id=eq.${recipient.id}&status=neq.signed`, { method: 'PATCH', body: JSON.stringify({ status: 'signed', signed_at: now.toISOString(), viewed_at: now.toISOString() }) })
    await deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: signatureRequest.id, recipient_id: recipient.id, event_type: 'recipient.signed', actor_type: 'recipient', actor_email: recipient.email, ...requestIdentity(request, deps.config.gatewayServerKey) }) })
    const outstanding = await deps.supabaseFetch<Array<{ id: string }>>(`signature_recipients?request_id=eq.${signatureRequest.id}&status=neq.signed&select=id&limit=1`, { headers: { Accept: 'application/json' } })
    if (outstanding.length) { await deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'partially_signed' }) }); return { success: true, status: 'partially_signed' } }
    const documents = await deps.supabaseFetch<DocumentRow[]>(`platform_documents?id=eq.${signatureRequest.document_id}&select=*&limit=1`, { headers: { Accept: 'application/json' } }); const original = documents[0]; if (!original) throw new Error('Original signature document is missing.')
    const completedFields = await deps.supabaseFetch<Array<{ field_type: 'signature' | 'date' | 'name' | 'text'; page_number: number; x: number; y: number; width: number; height: number; value: string; signature_method: 'typed' | 'drawn' | 'uploaded' | null }>>(`signature_fields?request_id=eq.${signatureRequest.id}&select=field_type,page_number,x,y,width,height,value,signature_method&order=page_number.asc`, { headers: { Accept: 'application/json' } })
    const originalBytes = await fetchDocumentBytes(deps, original.storage_path)
    const completedBytes = await renderCompletedPdf({ original: originalBytes, originalHash: original.sha256, requestId: signatureRequest.id, recipientName: recipient.name, completedAt: now, fields: completedFields.map((field) => ({ fieldType: field.field_type, pageNumber: field.page_number, x: Number(field.x), y: Number(field.y), width: Number(field.width), height: Number(field.height), value: field.value, signatureMethod: field.signature_method })) })
    const completedPath = `${signatureRequest.owner_user_id}/signature_completed/${signatureRequest.id}-${safeFilename(original.filename.replace(/\.pdf$/i, '-signed.pdf'))}`
    await uploadPdf(deps, completedPath, completedBytes)
    const completedDocuments = await deps.supabaseFetch<DocumentRow[]>('platform_documents?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_user_id: signatureRequest.owner_user_id, original_document_id: original.id, filename: original.filename.replace(/\.pdf$/i, '-signed.pdf'), safe_filename: safeFilename(original.filename.replace(/\.pdf$/i, '-signed.pdf')), mime_type: PDF_MIME, size_bytes: completedBytes.byteLength, storage_path: completedPath, sha256: sha256(completedBytes), document_kind: 'signature_completed', page_count: original.page_count, metadata: { requestId: signatureRequest.id, originalHash: original.sha256 } }) })
    const completedDocument = completedDocuments[0]; if (!completedDocument) throw new Error('Completed document could not be recorded.')
    await Promise.all([
      deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', completed_at: now.toISOString(), completed_document_id: completedDocument.id }) }),
      deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: signatureRequest.id, event_type: 'request.completed', actor_type: 'system', metadata: { originalHash: original.sha256, completedHash: completedDocument.sha256, documentVersion: 1 } }) }),
    ])
    const [ownerProfiles, requestRecipients] = await Promise.all([
      deps.supabaseFetch<Array<{ email: string }>>(`user_profiles?user_id=eq.${encodeURIComponent(signatureRequest.owner_user_id)}&select=email&limit=1`, { headers: { Accept: 'application/json' } }).catch(() => []),
      deps.supabaseFetch<Array<{ email: string }>>(`signature_recipients?request_id=eq.${signatureRequest.id}&select=email`, { headers: { Accept: 'application/json' } }).catch(() => []),
    ])
    const completionRecipients = Array.from(new Set([ownerProfiles[0]?.email, ...requestRecipients.map((item) => item.email)].filter((value): value is string => Boolean(value))))
    if (completionRecipients.length) await sendResend(deps, { from: deps.config.emailFrom, to: completionRecipients, reply_to: deps.config.emailReplyTo, subject: `Completed: ${signatureRequest.title}`, html: `<p>The signature request <strong>${signatureRequest.title.replace(/[<>&"']/g, '')}</strong> has been completed.</p><p>The separately preserved completed document is now available in the Online2Day signature workspace.</p>` }, `signature-completed-${signatureRequest.id}`).catch((error) => request.log.warn({ err: error, signatureRequestId: signatureRequest.id }, 'Signature completion notification failed'))
    request.log.info({ signatureRequestId: signatureRequest.id, completedDocumentId: completedDocument.id }, 'Signature request completed')
    return { success: true, status: 'completed' }
  })

  app.post('/api/v1/public/signatures/:token/decline', async (request, reply) => {
    const params = z.object({ token: z.string().min(32).max(100) }).parse(request.params); const body = z.object({ reason: z.string().trim().max(1_000).default('') }).parse(request.body || {}); const tokenHash = sha256(params.token); const now = new Date().toISOString()
    const recipients = await deps.supabaseFetch<Array<{ id: string; request_id: string; email: string; status: string }>>(`signature_recipients?token_hash=eq.${tokenHash}&select=id,request_id,email,status&limit=1`, { headers: { Accept: 'application/json' } }); const recipient = recipients[0]
    if (!recipient) return reply.code(404).send({ error: 'Signing link is invalid.' })
    const requests = await deps.supabaseFetch<Array<{ id: string; status: string; expires_at: string }>>(`signature_requests?id=eq.${recipient.request_id}&select=id,status,expires_at&limit=1`, { headers: { Accept: 'application/json' } }); const signatureRequest = requests[0]
    if (!signatureRequest || ['completed','declined','cancelled','expired'].includes(signatureRequest.status) || new Date(signatureRequest.expires_at).getTime() <= Date.now()) return reply.code(410).send({ error: 'This signing request is no longer active.' })
    await Promise.all([
      deps.supabaseFetch(`signature_recipients?id=eq.${recipient.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'declined', declined_at: now }) }),
      deps.supabaseFetch(`signature_requests?id=eq.${signatureRequest.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'declined' }) }),
      deps.supabaseFetch('signature_events', { method: 'POST', body: JSON.stringify({ request_id: signatureRequest.id, recipient_id: recipient.id, event_type: 'recipient.declined', actor_type: 'recipient', actor_email: recipient.email, metadata: { reason: body.reason }, ...requestIdentity(request, deps.config.gatewayServerKey) }) }),
    ])
    request.log.info({ signatureRequestId: signatureRequest.id, recipientId: recipient.id }, 'Signature request declined')
    return { success: true, status: 'declined' }
  })

  registerMailboxRoutes(app, deps)
}

function registerMailboxRoutes(app: FastifyInstance, deps: PlatformRouteDeps) {
  const draftSchema = z.object({ id: uuid.optional(), leadId: uuid.nullable().optional(), threadId: uuid.nullable().optional(), to: addressList, cc: addressList, bcc: addressList, subject: z.string().max(300).default(''), htmlBody: z.string().max(100_000).default(''), plainBody: z.string().max(50_000).default(''), priority: z.enum(['low', 'normal', 'high']).default('normal'), attachmentIds: z.array(uuid).max(20).default([]) })
  const mailSendSchema = draftSchema.omit({ id: true }).extend({
    draftId: uuid.optional(), replyToMessageId: uuid.optional(),
    to: z.array(email).min(1).max(50),
    subject: z.string().trim().min(1).max(300),
    htmlBody: z.string().min(1).max(100_000),
    scheduledAt: z.string().datetime().optional(),
    idempotencyKey: z.string().min(8).max(180),
  })

  app.post('/api/v1/online2day/mailbox/send', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub); const body = mailSendSchema.parse(request.body)
    const safeHtml = sanitiseEmailHtml(body.htmlBody)
    if (!safeHtml.replace(/<[^>]+>/g, '').trim() && !body.plainBody.trim()) return reply.code(400).send({ error: 'Message body is required.' })
    if (body.scheduledAt && new Date(body.scheduledAt).getTime() < Date.now() + 60_000) return reply.code(400).send({ error: 'Scheduled send must be at least one minute in the future.' })
    const existing = await deps.supabaseFetch<Array<{ id: string; provider_id: string | null }>>(`emails?mailbox_owner_id=eq.${ownerId}&headers->>idempotency_key=eq.${encodeURIComponent(body.idempotencyKey)}&select=id,provider_id&limit=1`, { headers: { Accept: 'application/json' } }).catch(() => [])
    if (existing[0]?.provider_id) return { success: true, id: existing[0].provider_id, messageId: existing[0].id, duplicate: true }

    let threadId = body.threadId || ''; let inReplyTo = ''; let references: string[] = []
    if (body.replyToMessageId) {
      const messages = await deps.supabaseFetch<Array<{ thread_id: string | null; message_id: string | null; reference_ids: string[] | null }>>(`emails?id=eq.${body.replyToMessageId}&mailbox_owner_id=eq.${ownerId}&select=thread_id,message_id,reference_ids&limit=1`, { headers: { Accept: 'application/json' } })
      const parent = messages[0]; if (!parent) return reply.code(404).send({ error: 'Reply target was not found.' }); threadId = parent.thread_id || threadId; inReplyTo = parent.message_id || ''; references = [...(parent.reference_ids || []), ...(parent.message_id ? [parent.message_id] : [])].slice(-100)
    }
    if (!threadId) {
      const threads = await deps.supabaseFetch<Array<{ id: string }>>('email_threads?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ mailbox_owner_id: ownerId, lead_id: body.leadId || null, subject: body.subject, normalized_subject: normaliseSubject(body.subject), participant_addresses: [...body.to, ...body.cc, ...body.bcc], last_message_at: new Date().toISOString(), unread_count: 0, message_count: 0, folder: 'sent' }) }); threadId = threads[0]?.id || ''
    }
    const documents = body.attachmentIds.length ? await deps.supabaseFetch<DocumentRow[]>(`platform_documents?owner_user_id=eq.${ownerId}&id=in.(${body.attachmentIds.join(',')})&select=*`, { headers: { Accept: 'application/json' } }) : []
    if (documents.length !== body.attachmentIds.length) return reply.code(403).send({ error: 'One or more attachments are unavailable.' })
    const attachments = await Promise.all(documents.map(async (document) => ({ filename: document.safe_filename, path: await signedDownload(deps, 'platform-documents', document.storage_path, 3_600) })))
    const resendPayload: Record<string, unknown> = { from: deps.config.emailFrom, to: body.to, cc: body.cc.length ? body.cc : undefined, bcc: body.bcc.length ? body.bcc : undefined, reply_to: deps.config.emailReplyTo, subject: body.subject, html: safeHtml, text: body.plainBody || safeHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), attachments: attachments.length ? attachments : undefined, headers: { ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}), ...(references.length ? { References: references.join(' ') } : {}), 'X-Online2Day-Thread': threadId }, scheduled_at: body.scheduledAt }
    const sent = await sendResend(deps, resendPayload, body.idempotencyKey); const now = new Date().toISOString(); const status = body.scheduledAt ? 'scheduled' : 'sent'
    const messagePayload = { mailbox_owner_id: ownerId, sender_id: ownerId, lead_id: body.leadId || null, thread_id: threadId || null, direction: 'outbound', provider_id: sent.id, message_id: null, in_reply_to: inReplyTo || null, reference_ids: references, from_address: parseMailbox(deps.config.emailFrom).email, from_name: parseMailbox(deps.config.emailFrom).name, to_addresses: body.to, cc_addresses: body.cc, bcc_addresses: body.bcc, reply_to_addresses: [deps.config.emailReplyTo], subject: body.subject, body: body.plainBody, plain_body: body.plainBody, html_body: body.htmlBody, sanitised_html_body: safeHtml, headers: { idempotency_key: body.idempotencyKey }, status, folder: 'sent', priority: body.priority, is_read: true, read_at: now, sent_at: body.scheduledAt || now, scheduled_at: body.scheduledAt || null, updated_at: now }
    const path = body.draftId ? `emails?id=eq.${body.draftId}&mailbox_owner_id=eq.${ownerId}&folder=eq.drafts&select=id` : 'emails?select=id'; const method = body.draftId ? 'PATCH' : 'POST'
    const messages = await deps.supabaseFetch<Array<{ id: string }>>(path, { method, headers: { Prefer: 'return=representation' }, body: JSON.stringify(messagePayload) }); const message = messages[0]; if (!message) throw new Error('Sent email could not be recorded.')
    await deps.supabaseFetch(`email_attachments?email_id=eq.${message.id}`, { method: 'DELETE' }); if (documents.length) await deps.supabaseFetch('email_attachments', { method: 'POST', body: JSON.stringify(documents.map((document) => ({ email_id: message.id, document_id: document.id }))) })
    if (threadId) { const related = await deps.supabaseFetch<Array<{ id: string }>>(`emails?thread_id=eq.${threadId}&select=id`, { headers: { Accept: 'application/json' } }); await deps.supabaseFetch(`email_threads?id=eq.${threadId}`, { method: 'PATCH', body: JSON.stringify({ last_message_at: body.scheduledAt || now, message_count: related.length, folder: 'sent' }) }) }
    request.log.info({ emailId: message.id, providerId: sent.id, attachmentCount: documents.length, recipientCount: body.to.length + body.cc.length + body.bcc.length, scheduled: Boolean(body.scheduledAt) }, 'Email sent')
    return reply.code(201).send({ success: true, id: sent.id, messageId: message.id, status })
  })
  app.get('/api/v1/online2day/mailbox', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const query = z.object({ folder: z.enum(['inbox','sent','drafts','trash','archive']).default('inbox'), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query)
    const owner = encodeURIComponent(String(user.sub))
    const [messages, unread] = await Promise.all([
      deps.supabaseFetch(`emails?mailbox_owner_id=eq.${owner}&folder=eq.${query.folder}&select=id,thread_id,lead_id,subject,plain_body,sanitised_html_body,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,direction,status,provider_id,message_id,in_reply_to,reference_ids,is_read,read_at,folder,priority,sent_at,received_at,created_at,updated_at,attachments:email_attachments(id,disposition,content_id,document:platform_documents(id,filename,safe_filename,mime_type,size_bytes))&order=received_at.desc.nullslast,sent_at.desc.nullslast,created_at.desc&limit=${query.limit}`, { headers: { Accept: 'application/json' } }),
      deps.supabaseFetch<Array<{ id: string }>>(`emails?mailbox_owner_id=eq.${owner}&folder=eq.inbox&is_read=eq.false&deleted_at=is.null&select=id&limit=5000`, { headers: { Accept: 'application/json' } }).catch(() => []),
    ])
    return { messages, unread: unread.length }
  })

  app.post('/api/v1/online2day/mailbox/drafts', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub); const body = draftSchema.parse(request.body); const now = new Date().toISOString(); const payload = { mailbox_owner_id: ownerId, sender_id: ownerId, lead_id: body.leadId || null, thread_id: body.threadId || null, direction: 'outbound', subject: body.subject, body: body.plainBody, plain_body: body.plainBody, html_body: body.htmlBody, sanitised_html_body: sanitiseEmailHtml(body.htmlBody), to_addresses: body.to, cc_addresses: body.cc, bcc_addresses: body.bcc, status: 'draft', folder: 'drafts', priority: body.priority, is_read: true, read_at: now, sent_at: null, updated_at: now }
    const documents = body.attachmentIds.length ? await deps.supabaseFetch<DocumentRow[]>(`platform_documents?owner_user_id=eq.${encodeURIComponent(ownerId)}&id=in.(${body.attachmentIds.join(',')})&select=id`, { headers: { Accept: 'application/json' } }) : []
    if (documents.length !== body.attachmentIds.length) return reply.code(403).send({ error: 'One or more draft attachments are unavailable.' })
    const path = body.id ? `emails?id=eq.${body.id}&mailbox_owner_id=eq.${ownerId}&folder=eq.drafts&select=*` : 'emails?select=*'; const method = body.id ? 'PATCH' : 'POST'
    const rows = await deps.supabaseFetch<Array<{ id: string }>>(path, { method, headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); const draft = rows[0]; if (!draft) throw Object.assign(new Error('Draft could not be saved.'), { statusCode: 404 })
    await deps.supabaseFetch(`email_attachments?email_id=eq.${draft.id}`, { method: 'DELETE' })
    if (body.attachmentIds.length) await deps.supabaseFetch('email_attachments', { method: 'POST', body: JSON.stringify(body.attachmentIds.map((documentId) => ({ email_id: draft.id, document_id: documentId }))) })
    return reply.code(body.id ? 200 : 201).send({ ...draft, attachmentIds: body.attachmentIds })
  })

  app.patch('/api/v1/online2day/mailbox/:id/read', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params); const body = z.object({ read: z.boolean() }).parse(request.body); const now = new Date().toISOString()
    const rows = await deps.supabaseFetch<Array<{ id: string; thread_id: string | null }>>(`emails?id=eq.${params.id}&mailbox_owner_id=eq.${encodeURIComponent(String(user.sub))}&select=id,thread_id`, { headers: { Accept: 'application/json' } }); const message = rows[0]; if (!message) return reply.code(404).send({ error: 'Email not found.' })
    await deps.supabaseFetch(`emails?id=eq.${params.id}`, { method: 'PATCH', body: JSON.stringify({ is_read: body.read, read_at: body.read ? now : null }) })
    if (message.thread_id) {
      const unread = await deps.supabaseFetch<Array<{ id: string }>>(`emails?thread_id=eq.${message.thread_id}&folder=eq.inbox&is_read=eq.false&select=id`, { headers: { Accept: 'application/json' } })
      await deps.supabaseFetch(`email_threads?id=eq.${message.thread_id}`, { method: 'PATCH', body: JSON.stringify({ unread_count: unread.length }) })
    }
    return { success: true, read: body.read }
  })

  app.delete('/api/v1/online2day/mailbox/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params)
    const rows = await deps.supabaseFetch<Array<{ id: string }>>(`emails?id=eq.${params.id}&mailbox_owner_id=eq.${encodeURIComponent(String(user.sub))}&select=id`, { headers: { Accept: 'application/json' } }); if (!rows[0]) return reply.code(404).send({ error: 'Email not found.' })
    await deps.supabaseFetch(`emails?id=eq.${params.id}`, { method: 'PATCH', body: JSON.stringify({ folder: 'trash', deleted_at: new Date().toISOString() }) })
    return reply.code(204).send()
  })

  app.post('/api/v1/online2day/mailbox/:id/restore', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params)
    const rows = await deps.supabaseFetch<Array<{ id: string; direction: string; status: string }>>(`emails?id=eq.${params.id}&mailbox_owner_id=eq.${encodeURIComponent(String(user.sub))}&folder=eq.trash&select=id,direction,status`, { headers: { Accept: 'application/json' } }); const message = rows[0]; if (!message) return reply.code(404).send({ error: 'Trashed email not found.' })
    await deps.supabaseFetch(`emails?id=eq.${params.id}`, { method: 'PATCH', body: JSON.stringify({ folder: message.status === 'draft' ? 'drafts' : message.direction === 'inbound' ? 'inbox' : 'sent', deleted_at: null }) })
    return { success: true }
  })

  app.delete('/api/v1/online2day/mailbox/:id/permanent', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: uuid }).parse(request.params)
    const rows = await deps.supabaseFetch<Array<{ id: string }>>(`emails?id=eq.${params.id}&mailbox_owner_id=eq.${encodeURIComponent(String(user.sub))}&folder=eq.trash&select=id`, { headers: { Accept: 'application/json' } }); if (!rows[0]) return reply.code(404).send({ error: 'Trashed email not found.' })
    await deps.supabaseFetch(`emails?id=eq.${params.id}`, { method: 'DELETE' }); return reply.code(204).send()
  })

  app.post('/api/v1/online2day/inbound-email-events', { preHandler: deps.requireServerKey }, async (request, reply) => {
    const body = z.object({ eventId: z.string().min(1).max(200), emailId: z.string().min(1).max(200), createdAt: z.string().datetime().optional() }).parse(request.body)
    const existing = await deps.supabaseFetch<Array<{ id: string }>>(`email_provider_events?provider=eq.resend&provider_event_id=eq.${encodeURIComponent(body.eventId)}&select=id&limit=1`, { headers: { Accept: 'application/json' } }); if (existing.length) return { accepted: true, duplicate: true }
    if (!deps.config.resendApiKey) throw Object.assign(new Error('Inbound email is not configured.'), { statusCode: 503 })
    type Received = { id: string; to: string[]; from: string; created_at: string; subject: string; html: string | null; text: string | null; headers: Record<string, string>; bcc: string[]; cc: string[]; reply_to: string[]; message_id: string; attachments: Array<{ id: string; filename: string; content_type: string; content_disposition?: string | null; content_id?: string | null }> }
    const received = await deps.requestJson<Received>(`https://api.resend.com/emails/receiving/${encodeURIComponent(body.emailId)}`, { headers: { Authorization: `Bearer ${deps.config.resendApiKey}` } })
    const to = received.to.map((item) => parseMailbox(item).email); const sender = parseMailbox(received.headers?.from || received.from); const inReplyTo = received.headers?.['in-reply-to'] || ''; const references = (received.headers?.references || '').split(/\s+/).filter(Boolean).slice(0, 100)
    const profiles = await deps.supabaseFetch<Array<{ user_id: string; email: string }>>(`user_profiles?email=in.(${to.map(encodeURIComponent).join(',')})&select=user_id,email&limit=1`, { headers: { Accept: 'application/json' } }).catch(() => [])
    const fallback = profiles[0] || (await deps.supabaseFetch<Array<{ user_id: string; email: string }>>('user_profiles?role=eq.admin&select=user_id,email&limit=1', { headers: { Accept: 'application/json' } }))[0]
    if (!fallback) throw new Error('No mailbox owner is configured for inbound email.')
    const ownerId = fallback.user_id; let threadId = ''
    const replyCandidates = [inReplyTo, ...references].filter(Boolean)
    if (replyCandidates.length) { const matched = await deps.supabaseFetch<Array<{ thread_id: string }>>(`emails?message_id=in.(${replyCandidates.map(encodeURIComponent).join(',')})&thread_id=not.is.null&select=thread_id&limit=1`, { headers: { Accept: 'application/json' } }); threadId = matched[0]?.thread_id || '' }
    if (!threadId) { const threads = await deps.supabaseFetch<Array<{ id: string }>>('email_threads?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ mailbox_owner_id: ownerId, subject: received.subject || '(No subject)', normalized_subject: normaliseSubject(received.subject || ''), participant_addresses: [sender.email, ...to], last_message_at: received.created_at, unread_count: 1, message_count: 1, folder: 'inbox' }) }); threadId = threads[0]?.id || '' }
    const messages = await deps.supabaseFetch<Array<{ id: string }>>('emails?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ mailbox_owner_id: ownerId, thread_id: threadId || null, direction: 'inbound', provider_id: received.id, message_id: received.message_id, in_reply_to: inReplyTo || null, reference_ids: references, from_address: sender.email, from_name: sender.name, to_addresses: to, cc_addresses: received.cc || [], bcc_addresses: received.bcc || [], reply_to_addresses: received.reply_to || [], subject: received.subject || '(No subject)', body: received.text || '', plain_body: received.text || '', html_body: received.html || '', sanitised_html_body: sanitiseEmailHtml(received.html || ''), headers: received.headers || {}, status: 'received', folder: 'inbox', is_read: false, read_at: null, sent_at: null, received_at: received.created_at || body.createdAt || new Date().toISOString() }) })
    const message = messages[0]; if (!message) throw new Error('Inbound email could not be saved.')
    if (threadId) { const related = await deps.supabaseFetch<Array<{ id: string; is_read: boolean }>>(`emails?thread_id=eq.${threadId}&select=id,is_read`, { headers: { Accept: 'application/json' } }); await deps.supabaseFetch(`email_threads?id=eq.${threadId}`, { method: 'PATCH', body: JSON.stringify({ last_message_at: received.created_at, message_count: related.length, unread_count: related.filter((item) => !item.is_read).length, folder: 'inbox' }) }) }
    if (received.attachments?.length) {
      type AttachmentList = { data: Array<{ filename: string; size: number; content_type: string; content_disposition?: string; content_id?: string; download_url: string }> }
      const listing = await deps.requestJson<AttachmentList>(`https://api.resend.com/emails/receiving/${encodeURIComponent(body.emailId)}/attachments`, { headers: { Authorization: `Bearer ${deps.config.resendApiKey}` } })
      for (const attachment of listing.data || []) {
        if (attachment.content_type !== PDF_MIME || attachment.size > MAX_PDF_BYTES) { request.log.warn({ emailId: received.id, filename: attachment.filename, contentType: attachment.content_type, size: attachment.size }, 'Inbound attachment rejected'); continue }
        const response = await fetch(attachment.download_url, { signal: AbortSignal.timeout(30_000) }); if (!response.ok) continue; const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength > MAX_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') continue
        let pageCount = 0; try { pageCount = (await PDFDocument.load(bytes)).getPageCount() } catch { continue }
        const filename = safeFilename(attachment.filename); const path = `${ownerId}/inbound/${crypto.randomUUID()}-${filename}`; await uploadPdf(deps, path, bytes)
        const documents = await deps.supabaseFetch<DocumentRow[]>('platform_documents?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_user_id: ownerId, filename: attachment.filename, safe_filename: filename, mime_type: PDF_MIME, size_bytes: bytes.byteLength, storage_path: path, sha256: sha256(bytes), document_kind: 'attachment', page_count: pageCount, metadata: { provider: 'resend', inboundEmailId: received.id } }) }); if (documents[0]) await deps.supabaseFetch('email_attachments', { method: 'POST', body: JSON.stringify({ email_id: message.id, document_id: documents[0].id, disposition: attachment.content_disposition === 'inline' ? 'inline' : 'attachment', content_id: attachment.content_id || null }) })
      }
    }
    await deps.supabaseFetch('email_provider_events', { method: 'POST', body: JSON.stringify({ provider: 'resend', provider_event_id: body.eventId, email_id: message.id, event_type: 'email.received', occurred_at: body.createdAt || received.created_at, metadata: { providerEmailId: received.id } }) })
    request.log.info({ emailId: message.id, providerEmailId: received.id, threadId }, 'Inbound email received')
    return reply.code(201).send({ accepted: true, id: message.id })
  })
}
