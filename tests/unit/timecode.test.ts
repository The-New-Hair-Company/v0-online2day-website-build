import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTimecode, parseTimecode, validateTimeRange } from '../../lib/video/timecode.ts'

test('parses supported time formats with millisecond precision', () => {
  assert.equal(parseTimecode('01:05'), 65)
  assert.equal(parseTimecode('01:02:03.250'), 3723.25)
  assert.equal(parseTimecode('9.125'), 9.125)
})

test('rejects malformed and out-of-range clock fields', () => {
  assert.equal(parseTimecode('-1'), null)
  assert.equal(parseTimecode('00:61'), null)
  assert.equal(parseTimecode('00:00:60'), null)
  assert.equal(parseTimecode('abc'), null)
})

test('normalises timecodes and validates trim boundaries', () => {
  assert.equal(formatTimecode(3723.25), '01:02:03.250')
  assert.equal(formatTimecode(65), '01:05.000')
  assert.deepEqual(validateTimeRange('00:01.250', '00:05', 10), { ok: true, start: 1.25, end: 5 })
  assert.equal(validateTimeRange('00:05', '00:05', 10).ok, false)
  assert.equal(validateTimeRange('00:05', '00:11', 10).ok, false)
})
