import assert from 'node:assert/strict'
import test from 'node:test'
import { normaliseSubject, parseMailbox, safeFilename, sanitiseEmailHtml } from '../dist/platform-utils.js'

test('sanitises inbound HTML and hardens links', () => {
  const value = sanitiseEmailHtml('<p>Hello<script>alert(1)</script><img src="https://track.invalid/pixel"><a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a></p>')
  assert.equal(value.includes('<script'), false)
  assert.equal(value.includes('<img'), false)
  assert.equal(value.includes('javascript:'), false)
  assert.match(value, /noopener noreferrer nofollow/)
})

test('normalises subjects and mailbox values for threading', () => {
  assert.equal(normaliseSubject('Re: FWD:  Quarterly   Review '), 'quarterly review')
  assert.deepEqual(parseMailbox('Ada Lovelace <ADA@example.com>'), { name: 'Ada Lovelace', email: 'ada@example.com' })
})

test('removes paths and unsafe characters from PDF names', () => {
  assert.equal(safeFilename('../../Client/Proposal<script>.pdf'), 'Proposal_script_.pdf')
})
