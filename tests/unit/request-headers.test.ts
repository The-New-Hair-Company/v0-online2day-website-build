import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApiHeaders } from '../../lib/api/request-headers.ts'

test('does not advertise JSON for bodyless DELETE and POST requests', () => {
  assert.equal(buildApiHeaders(undefined, undefined, 'token').has('Content-Type'), false)
  assert.equal(buildApiHeaders(undefined, null).has('Content-Type'), false)
})

test('adds JSON content type only when a JSON body is present', () => {
  assert.equal(buildApiHeaders(undefined, JSON.stringify({ ok: true })).get('Content-Type'), 'application/json')
  const form = new FormData(); form.append('file', new Blob(['x']), 'x.txt')
  assert.equal(buildApiHeaders(undefined, form).has('Content-Type'), false)
})

test('preserves explicit content types and bearer authentication', () => {
  const headers = buildApiHeaders({ 'Content-Type': 'text/plain' }, 'hello', 'abc')
  assert.equal(headers.get('Content-Type'), 'text/plain')
  assert.equal(headers.get('Authorization'), 'Bearer abc')
})
