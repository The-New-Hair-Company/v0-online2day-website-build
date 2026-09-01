export type MediaCut = { start: number; end: number }

export type MediaCaption = {
  text: string
  start: number
  end: number
  position: 'top' | 'middle' | 'bottom'
}

export const formatCanvas = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 864, height: 1080 },
  '21:9': { width: 1400, height: 600 },
} as const

export function normaliseMediaCuts(cuts: MediaCut[], trimStart: number, trimEnd: number) {
  const sorted = cuts
    .map((cut) => ({ start: Math.max(trimStart, cut.start), end: Math.min(trimEnd, cut.end) }))
    .filter((cut) => cut.end - cut.start >= 0.001)
    .sort((left, right) => left.start - right.start)
  const merged: MediaCut[] = []
  for (const cut of sorted) {
    const previous = merged.at(-1)
    if (previous && cut.start <= previous.end) previous.end = Math.max(previous.end, cut.end)
    else merged.push({ ...cut })
  }
  return merged
}

export function retainedSegments(trimStart: number, trimEnd: number, cuts: MediaCut[]) {
  const segments: MediaCut[] = []
  let cursor = trimStart
  for (const cut of normaliseMediaCuts(cuts, trimStart, trimEnd)) {
    if (cut.start > cursor) segments.push({ start: cursor, end: cut.start })
    cursor = Math.max(cursor, cut.end)
  }
  if (cursor < trimEnd) segments.push({ start: cursor, end: trimEnd })
  return segments.filter((segment) => segment.end - segment.start >= 0.04)
}

export function outputTimeForSource(sourceTime: number, trimStart: number, cuts: MediaCut[], playbackRate: number) {
  let elapsed = Math.max(0, sourceTime - trimStart)
  for (const cut of normaliseMediaCuts(cuts, trimStart, sourceTime)) elapsed -= Math.max(0, cut.end - cut.start)
  return Math.max(0, elapsed / playbackRate)
}

export function escapeDrawText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'")
    .replaceAll('%', '\\%')
    .replaceAll('\n', ' ')
    .slice(0, 500)
}
