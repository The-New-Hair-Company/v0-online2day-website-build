import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateQuote,
  canDirectAmend,
  createDemoState,
  isDemoState,
  safeDemoFilename,
  validateSurveyUnit,
} from '../../lib/tradewindows/demo-data.ts'
import { createDemoPdf } from '../../lib/tradewindows/demo-pdf.ts'

test('Trade Windows flagship quote reconciles to the contract value', () => {
  const state = createDemoState()
  const total = calculateQuote(state.quote.lines, state.quote.discountPercent)
  assert.equal(total.subtotalPence, 820_000)
  assert.equal(total.vatPence, 164_000)
  assert.equal(total.totalPence, state.invoice.totalPence)
})

test('amendment policy switches to review after survey sign-off', () => {
  const state = createDemoState()
  assert.equal(canDirectAmend(state), true)
  state.survey.complete = true
  assert.equal(canDirectAmend(state), false)
})

test('survey validation reports unsafe or incomplete measurements', () => {
  const unit = createDemoState().survey.units[0]
  assert.deepEqual(validateSurveyUnit(unit), [])
  assert.deepEqual(validateSurveyUnit({ ...unit, width: 0, photoName: '' }), ['valid width', 'photograph'])
})

test('demo upload filenames are reduced to safe display names', () => {
  assert.equal(safeDemoFilename('../../front door (final).jpg'), 'front-door-final-jpg')
  assert.equal(safeDemoFilename(''), 'property-photo')
})

test('session data must retain the expected demonstration shape', () => {
  assert.equal(isDemoState(createDemoState()), true)
  assert.equal(isDemoState({ version: 1, activity: [] }), false)
})

test('generated demonstration documents are valid bounded PDF files', () => {
  const pdf = createDemoPdf('framefast')
  assert.equal(pdf.subarray(0, 8).toString('ascii'), '%PDF-1.4')
  assert.match(pdf.toString('ascii'), /FrameFast Order FF-240184/)
  assert.match(pdf.toString('ascii'), /External status: NOT SUBMITTED/)
  assert.ok(pdf.length < 100_000)
  assert.match(pdf.subarray(-32).toString('ascii'), /%%EOF/)
})

test('quotation PDF reflects the current validated quote', () => {
  const pdf = createDemoPdf('quotation', {
    discountPercent: 10,
    lines: [{ id: 'custom', description: 'Bespoke demo item', quantity: 2, unitPricePence: 50_000 }],
  }).toString('ascii')
  assert.match(pdf, /2 x Bespoke demo item/)
  assert.ok(pdf.includes('Discount \\(10%\\)'))
})
