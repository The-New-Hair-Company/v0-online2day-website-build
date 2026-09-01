export type TimeRangeValidation =
  | { ok: true; start: number; end: number }
  | { ok: false; error: string }

const TIME_PART = /^\d+(?:\.\d{1,3})?$/

export function parseTimecode(input: string): number | null {
  const value = input.trim()
  if (!value) return null
  const parts = value.split(':')
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !TIME_PART.test(part))) return null

  const numbers = parts.map(Number)
  if (numbers.some((number) => !Number.isFinite(number) || number < 0)) return null
  if (parts.length === 1) return numbers[0]

  const seconds = numbers.at(-1)!
  const minutes = numbers.at(-2)!
  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) return null
  return parts.length === 2
    ? minutes * 60 + seconds
    : numbers[0] * 3600 + minutes * 60 + seconds
}

export function formatTimecode(seconds: number, precision: 0 | 3 = 3): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const totalMilliseconds = Math.round(safe * 1000)
  const hours = Math.floor(totalMilliseconds / 3_600_000)
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000)
  const milliseconds = totalMilliseconds % 1000
  const secondPart = `${String(wholeSeconds).padStart(2, '0')}${precision === 3 ? `.${String(milliseconds).padStart(3, '0')}` : ''}`
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondPart}`
    : `${String(minutes).padStart(2, '0')}:${secondPart}`
}

export function validateTimeRange(startInput: string, endInput: string, duration: number): TimeRangeValidation {
  const start = parseTimecode(startInput)
  const end = parseTimecode(endInput)
  if (start === null || end === null) return { ok: false, error: 'Use MM:SS, HH:MM:SS or HH:MM:SS.mmm.' }
  if (!Number.isFinite(duration) || duration <= 0) return { ok: false, error: 'The video duration is unavailable.' }
  if (start < 0 || end < 0) return { ok: false, error: 'Times cannot be negative.' }
  if (start > duration || end > duration) return { ok: false, error: `Times must be within ${formatTimecode(duration)}.` }
  if (start >= end) return { ok: false, error: 'Start time must be before end time.' }
  return { ok: true, start, end }
}
