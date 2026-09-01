export type VideoFormat = '16:9' | '9:16' | '1:1' | '4:5' | '21:9'

export type VideoTransform = {
  fit: 'contain' | 'cover'
  scale: number
  x: number
  y: number
  rotation: number
  flipX: boolean
  flipY: boolean
}

export type VideoCut = {
  id: string
  start: number
  end: number
}

export type VideoCaption = {
  id: string
  text: string
  start: number
  end: number
  position: 'top' | 'middle' | 'bottom'
}

export type CaptionStyle = {
  color: string
  background: string
  fontSize: number
  fontWeight: 600 | 700 | 800 | 900
  uppercase: boolean
}

export const defaultVideoTransform: VideoTransform = {
  fit: 'contain',
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
}

export const defaultCaptionStyle: CaptionStyle = {
  color: '#ffffff',
  background: '#02050bcc',
  fontSize: 34,
  fontWeight: 800,
  uppercase: false,
}

export const formatRatios: Record<VideoFormat, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '21:9': 21 / 9,
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function normalizeCuts(cuts: VideoCut[], duration: number, trimStart = 0, trimEnd = duration) {
  const startBoundary = clampNumber(trimStart, 0, duration)
  const endBoundary = clampNumber(trimEnd || duration, startBoundary, duration)
  const sorted = cuts
    .map((cut) => ({
      ...cut,
      start: clampNumber(cut.start, startBoundary, endBoundary),
      end: clampNumber(cut.end, startBoundary, endBoundary),
    }))
    .filter((cut) => cut.end - cut.start >= 0.05)
    .sort((a, b) => a.start - b.start)

  return sorted.reduce<VideoCut[]>((merged, cut) => {
    const previous = merged.at(-1)
    if (!previous || cut.start > previous.end + 0.01) {
      merged.push(cut)
      return merged
    }
    previous.end = Math.max(previous.end, cut.end)
    return merged
  }, [])
}

export function activeCaptionAt(captions: VideoCaption[], time: number) {
  return captions.find((caption) => time >= caption.start && time < caption.end) || null
}

export function cutAt(cuts: VideoCut[], time: number) {
  return cuts.find((cut) => time >= cut.start && time < cut.end) || null
}

export function playableDuration(duration: number, trimStart: number, trimEnd: number, cuts: VideoCut[]) {
  const end = trimEnd || duration
  const range = Math.max(0, end - trimStart)
  const removed = normalizeCuts(cuts, duration, trimStart, end)
    .reduce((total, cut) => total + Math.max(0, cut.end - cut.start), 0)
  return Math.max(0, range - removed)
}

