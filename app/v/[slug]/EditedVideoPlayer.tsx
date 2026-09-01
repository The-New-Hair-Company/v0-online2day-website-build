'use client'

import { useMemo, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import {
  activeCaptionAt, clampNumber, defaultCaptionStyle, defaultVideoTransform, normalizeCuts,
  type CaptionStyle, type VideoCaption, type VideoCut, type VideoTransform,
} from '@/lib/video/editor-project'

function formatTime(value: number) {
  const safe = Math.max(0, value)
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${Math.floor(safe % 60).toString().padStart(2, '0')}`
}

export default function EditedVideoPlayer({
  src, trimStart = 0, trimEnd = 0, cuts = [], transform = defaultVideoTransform,
  captions = [], captionsEnabled = false, captionStyle = defaultCaptionStyle,
  watermark = false, brandColor = '#2f6bff', playbackRate = 1, volume = 1,
  fallbackCaption = '',
}: {
  src: string
  trimStart?: number
  trimEnd?: number
  cuts?: VideoCut[]
  transform?: VideoTransform
  captions?: VideoCaption[]
  captionsEnabled?: boolean
  captionStyle?: CaptionStyle
  watermark?: boolean
  brandColor?: string
  playbackRate?: number
  volume?: number
  fallbackCaption?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(trimStart)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(volume === 0)
  const end = trimEnd > trimStart ? Math.min(trimEnd, duration || trimEnd) : duration
  const normalizedCuts = useMemo(() => normalizeCuts(cuts, duration, trimStart, end || duration), [cuts, duration, trimStart, end])
  const caption = captionsEnabled ? activeCaptionAt(captions, time) : null
  const captionText = caption?.text || (captionsEnabled && captions.length === 0 ? fallbackCaption : '')

  function seek(value: number) {
    const video = videoRef.current
    if (!video) return
    let next = clampNumber(value, trimStart, end || duration)
    const cut = normalizedCuts.find((item) => next >= item.start && next < item.end)
    if (cut) next = cut.end
    video.currentTime = next
    setTime(next)
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= (end || duration)) seek(trimStart)
      void video.play()
    } else video.pause()
  }

  const videoStyle = {
    objectFit: transform.fit,
    transform: `translate(${transform.x / 2}%, ${transform.y / 2}%) rotate(${transform.rotation}deg) scale(${transform.scale * (transform.flipX ? -1 : 1)}, ${transform.scale * (transform.flipY ? -1 : 1)})`,
  } as const

  return <div className="group relative h-full w-full overflow-hidden bg-black" style={{ borderColor: brandColor }}>
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 h-full w-full"
      style={videoStyle}
      playsInline
      preload="metadata"
      onClick={togglePlayback}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        setDuration(video.duration)
        video.playbackRate = clampNumber(playbackRate, 0.5, 2)
        video.volume = clampNumber(volume, 0, 1)
        video.muted = muted
        seek(trimStart)
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget
        const cut = normalizedCuts.find((item) => video.currentTime >= item.start && video.currentTime < item.end)
        if (cut) { video.currentTime = cut.end; setTime(cut.end); return }
        if (end > trimStart && video.currentTime >= end) { video.pause(); seek(trimStart); return }
        setTime(video.currentTime)
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
    />
    <div className="pointer-events-none absolute inset-3 rounded-lg border" style={{ borderColor: brandColor }}>
      {watermark ? <span className="absolute right-3 top-3 rounded bg-black/65 px-2 py-1 text-[10px] font-bold text-white/85">Online2Day</span> : null}
    </div>
    {captionText ? <p
      className={`pointer-events-none absolute left-[8%] right-[8%] z-10 m-0 rounded-md px-3 py-2 text-center leading-tight ${caption?.position === 'top' ? 'top-[8%]' : caption?.position === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-[12%]'}`}
      style={{ color: captionStyle.color, background: captionStyle.background, fontSize: `clamp(14px, 3.2vw, ${captionStyle.fontSize}px)`, fontWeight: captionStyle.fontWeight, textTransform: captionStyle.uppercase ? 'uppercase' : 'none' }}
    >{captionText}</p> : null}
    <button type="button" aria-label={playing ? 'Pause video' : 'Play video'} onClick={togglePlayback} className={`absolute left-1/2 top-1/2 z-20 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur transition ${playing ? 'pointer-events-none opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>{playing ? <Pause size={25} /> : <Play size={27} className="ml-1" />}</button>
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-3 pt-8 text-white">
      <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback} className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-white/10">{playing ? <Pause size={17} /> : <Play size={17} />}</button>
      <span className="shrink-0 text-[11px] tabular-nums text-white/75">{formatTime(time - trimStart)} / {formatTime(Math.max(0, (end || duration) - trimStart))}</span>
      <input aria-label="Video position" className="min-w-0 flex-1 accent-blue-500" type="range" min={trimStart} max={end || duration || 1} step="0.05" value={clampNumber(time, trimStart, end || duration || 1)} onChange={(event) => seek(Number(event.target.value))} />
      <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next }} className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-white/10">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
    </div>
  </div>
}
