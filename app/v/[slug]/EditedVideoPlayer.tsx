'use client'

import { useRef } from 'react'

export default function EditedVideoPlayer({
  src,
  trimStart = 0,
  trimEnd = 0,
}: {
  src: string
  trimStart?: number
  trimEnd?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      className="w-full h-full object-contain"
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        if (trimStart > 0 && trimStart < video.duration) video.currentTime = trimStart
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget
        if (trimEnd > trimStart && video.currentTime >= trimEnd) {
          video.pause()
          video.currentTime = trimStart
        }
      }}
    />
  )
}
