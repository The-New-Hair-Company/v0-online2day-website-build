import assert from 'node:assert/strict'
import test from 'node:test'
import { normaliseMediaCuts, outputTimeForSource, retainedSegments } from '../dist/media-utils.js'

test('normalises overlapping cuts and keeps the playable segments', () => {
  assert.deepEqual(normaliseMediaCuts([{ start: 4, end: 7 }, { start: 6, end: 9 }, { start: -4, end: 2 }], 1, 12), [
    { start: 1, end: 2 }, { start: 4, end: 9 },
  ])
  assert.deepEqual(retainedSegments(1, 12, [{ start: 4, end: 7 }, { start: 6, end: 9 }]), [
    { start: 1, end: 4 }, { start: 9, end: 12 },
  ])
})

test('maps source caption times after trim, cuts and speed', () => {
  assert.equal(outputTimeForSource(12, 2, [{ start: 4, end: 6 }], 2), 4)
})
