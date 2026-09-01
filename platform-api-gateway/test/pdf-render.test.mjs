import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { renderCompletedPdf, sha256 } from '../dist/platform-utils.js'

test('renders a separate completed PDF with signature and audit metadata', async () => {
  const source = await PDFDocument.create()
  const page = source.addPage([612, 792])
  const font = await source.embedFont(StandardFonts.Helvetica)
  page.drawText('Online2Day signature workflow validation', { x: 48, y: 720, size: 18, font })
  const original = await source.save()
  const completed = await renderCompletedPdf({
    original,
    originalHash: sha256(original),
    requestId: '11111111-1111-4111-8111-111111111111',
    recipientName: 'Test Signer',
    completedAt: new Date('2026-09-01T12:00:00.000Z'),
    fields: [
      { fieldType: 'signature', pageNumber: 1, x: 0.1, y: 0.7, width: 0.35, height: 0.08, value: 'Test Signer', signatureMethod: 'typed' },
      { fieldType: 'date', pageNumber: 1, x: 0.55, y: 0.7, width: 0.2, height: 0.05, value: '01/09/2026' },
    ],
  })
  assert.notEqual(sha256(completed), sha256(original))
  const parsed = await PDFDocument.load(completed)
  assert.equal(parsed.getPageCount(), 1)
  assert.match(parsed.getSubject() || '', /11111111-1111-4111-8111-111111111111/)
})
