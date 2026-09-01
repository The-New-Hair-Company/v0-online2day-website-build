import { createHash, randomBytes } from 'node:crypto'
import sanitizeHtml from 'sanitize-html'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const PDF_MIME = 'application/pdf'
export const MAX_PDF_BYTES = 25 * 1024 * 1024

export function safeFilename(value: string, fallback = 'document.pdf') {
  const leaf = value.split(/[\\/]/).at(-1)?.normalize('NFKC') || fallback
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim()
  const result = cleaned.slice(0, 160) || fallback
  return result.toLowerCase().endsWith('.pdf') ? result : `${result}.pdf`
}

export function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

export function createSigningToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: sha256(token) }
}

export function normaliseSubject(value: string) {
  return value.trim().replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').replace(/\s+/g, ' ').toLowerCase().slice(0, 300)
}

export function parseMailbox(value: string) {
  const match = value.trim().match(/^(.*?)\s*<([^<>]+)>$/)
  return match ? { name: (match[1] ?? '').replace(/^"|"$/g, '').trim(), email: (match[2] ?? '').trim().toLowerCase() } : { name: '', email: value.trim().toLowerCase() }
}

export function sanitiseEmailHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'span', 'div', 'code', 'pre', 'hr'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], span: ['style'], div: ['style'], p: ['style'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/],
        'text-align': [/^(left|right|center|justify)$/],
        'font-size': [/^(?:[1-9]|[1-6]\d|7[0-2])px$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => ({ tagName: 'a', attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' } }),
    },
    disallowedTagsMode: 'discard',
  })
}

type CompletedField = {
  fieldType: 'signature' | 'date' | 'name' | 'text'
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  value: string
  signatureMethod?: 'typed' | 'drawn' | 'uploaded' | null
}

export async function renderCompletedPdf(input: {
  original: Uint8Array
  originalHash: string
  requestId: string
  recipientName: string
  completedAt: Date
  fields: CompletedField[]
}) {
  const pdf = await PDFDocument.load(input.original, { ignoreEncryption: false })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const pages = pdf.getPages()

  for (const field of input.fields) {
    const page = pages[field.pageNumber - 1]
    if (!page) throw new Error(`Signature field references missing page ${field.pageNumber}.`)
    const { width: pageWidth, height: pageHeight } = page.getSize()
    const x = field.x * pageWidth
    const width = field.width * pageWidth
    const height = field.height * pageHeight
    const y = pageHeight - (field.y * pageHeight) - height
    page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity: 0.92, borderColor: rgb(0.16, 0.39, 0.78), borderWidth: 0.8 })

    if (field.fieldType === 'signature' && field.signatureMethod !== 'typed' && field.value.startsWith('data:image/png;base64,')) {
      const imageBytes = Buffer.from(field.value.slice('data:image/png;base64,'.length), 'base64')
      if (imageBytes.byteLength > 2 * 1024 * 1024) throw new Error('Signature image is too large.')
      const image = await pdf.embedPng(imageBytes)
      const scale = Math.min(width / image.width, height / image.height) * 0.86
      page.drawImage(image, { x: x + (width - image.width * scale) / 2, y: y + (height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale })
    } else {
      const text = field.value.slice(0, field.fieldType === 'text' ? 500 : 160)
      const size = Math.max(8, Math.min(field.fieldType === 'signature' ? 24 : 13, height * 0.48, width / Math.max(4, text.length * 0.52)))
      page.drawText(text, { x: x + 6, y: y + Math.max(4, (height - size) / 2), size, font: field.fieldType === 'signature' ? italic : font, color: rgb(0.04, 0.09, 0.17), maxWidth: Math.max(1, width - 12) })
    }
  }

  const auditLine = `Online2Day completion ${input.requestId} | ${input.completedAt.toISOString()} | original SHA-256 ${input.originalHash}`
  for (const page of pages) {
    page.drawText(auditLine, { x: 18, y: 10, size: 5.5, font, color: rgb(0.35, 0.39, 0.46), maxWidth: page.getWidth() - 36 })
  }
  pdf.setTitle(`Signed - ${input.recipientName}`)
  pdf.setSubject(`Completed signature request ${input.requestId}`)
  pdf.setProducer('Online2Day signature service')
  pdf.setModificationDate(input.completedAt)
  return pdf.save({ useObjectStreams: true })
}
