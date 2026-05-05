'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CameraOff, Copy, Mic, MicOff, MonitorUp, PhoneOff, Radio, Users, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './enterprise-suite.module.css'

type SignalMessage = {
  id?: string
  roomId: string
  from: string
  to?: string
  type: 'hello' | 'leave' | 'offer' | 'answer' | 'candidate'
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | { name?: string; reply?: boolean }
}

const channelName = 'online2day-local-video-room'

function createParticipantId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function roomFromUrl() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('room') || ''
}

function createRoomId() {
  return `o2d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function LocalVideoRoom() {
  const [roomId, setRoomId] = useState('')
  const [participantId] = useState(createParticipantId)
  const [displayName, setDisplayName] = useState('Online2Day team')
  const [status, setStatus] = useState('No room joined')
  const [participants, setParticipants] = useState<string[]>([])
  const [isJoined, setIsJoined] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [isSharingScreen, setIsSharingScreen] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteGridRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerRefs = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const seenSignalsRef = useRef<Set<string>>(new Set())
  const roomIdRef = useRef('')
  const isJoinedRef = useRef(false)

  const roomLink = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomId)
    return url.toString()
  }, [roomId])

  useEffect(() => {
    const existingRoom = roomFromUrl()
    if (existingRoom) {
      roomIdRef.current = existingRoom
      setRoomId(existingRoom)
    }
  }, [])

  useEffect(() => {
    return () => leaveRoom()
  }, [])

  function postSignal(message: SignalMessage) {
    const outgoing = {
      ...message,
      id: message.id || `${participantId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      roomId: message.roomId || roomIdRef.current,
    }
    channelRef.current?.postMessage(outgoing)
    void realtimeChannelRef.current?.send({ type: 'broadcast', event: 'signal', payload: outgoing })
  }

  function announcePresence(targetRoomId = roomIdRef.current) {
    if (!targetRoomId) return
    postSignal({ roomId: targetRoomId, from: participantId, type: 'hello', payload: { name: displayName } })
  }

  function attachLocalStream(stream: MediaStream) {
    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      void localVideoRef.current.play().catch(() => undefined)
    }
  }

  function renderRemoteVideos() {
    const grid = remoteGridRef.current
    if (!grid) return

    for (const [peerId, stream] of remoteStreamsRef.current) {
      let video = grid.querySelector<HTMLVideoElement>(`video[data-peer="${peerId}"]`)
      if (!video) {
        video = document.createElement('video')
        video.dataset.peer = peerId
        video.autoplay = true
        video.playsInline = true
        video.className = styles.remoteVideo
        grid.appendChild(video)
      }
      if (video.srcObject !== stream) video.srcObject = stream
    }

    grid.querySelectorAll<HTMLVideoElement>('video[data-peer]').forEach((video) => {
      const peerId = video.dataset.peer || ''
      if (!remoteStreamsRef.current.has(peerId)) video.remove()
    })
  }

  function closePeer(peerId: string) {
    peerRefs.current.get(peerId)?.close()
    peerRefs.current.delete(peerId)
    remoteStreamsRef.current.delete(peerId)
    setParticipants((current) => current.filter((item) => item !== peerId))
    renderRemoteVideos()
  }

  function createPeer(peerId: string) {
    const existing = peerRefs.current.get(peerId)
    if (existing) return existing

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
    })
    peerRefs.current.set(peerId, peer)
    setParticipants((current) => current.includes(peerId) ? current : [...current, peerId])

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) peer.addTrack(track, localStreamRef.current)
    })

    peer.onicecandidate = (event) => {
      if (!event.candidate || !roomIdRef.current) return
      postSignal({ roomId: roomIdRef.current, from: participantId, to: peerId, type: 'candidate', payload: event.candidate.toJSON() })
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      remoteStreamsRef.current.set(peerId, stream)
      setStatus('Connected to team call')
      renderRemoteVideos()
    }

    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) closePeer(peerId)
      if (peer.connectionState === 'connected') setStatus('Connected to team call')
    }

    return peer
  }

  async function makeOffer(peerId: string) {
    const peer = createPeer(peerId)
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    postSignal({ roomId: roomIdRef.current, from: participantId, to: peerId, type: 'offer', payload: offer })
  }

  async function handleSignal(message: SignalMessage) {
    if (message.id) {
      if (seenSignalsRef.current.has(message.id)) return
      seenSignalsRef.current.add(message.id)
    }
    if (message.roomId !== roomIdRef.current || message.from === participantId) return
    if (message.to && message.to !== participantId) return

    if (message.type === 'hello') {
      if (!isJoinedRef.current) return
      setParticipants((current) => current.includes(message.from) ? current : [...current, message.from])
      const payload = message.payload as { reply?: boolean } | undefined
      const existingPeer = peerRefs.current.get(message.from)
      if (!payload?.reply) {
        postSignal({
          roomId: roomIdRef.current,
          from: participantId,
          to: message.from,
          type: 'hello',
          payload: { name: displayName, reply: true },
        })
      }
      if (participantId < message.from && (!existingPeer || !existingPeer.localDescription)) await makeOffer(message.from)
      return
    }

    if (message.type === 'leave') {
      closePeer(message.from)
      return
    }

    const peer = createPeer(message.from)

    if (message.type === 'offer' && message.payload) {
      await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      postSignal({ roomId: roomIdRef.current, from: participantId, to: message.from, type: 'answer', payload: answer })
      return
    }

    if (message.type === 'answer' && message.payload) {
      await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit)
      return
    }

    if (message.type === 'candidate' && message.payload) {
      try {
        await peer.addIceCandidate(message.payload as RTCIceCandidateInit)
      } catch {}
    }
  }

  async function joinRoom(nextRoomId = roomId || createRoomId()) {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setStatus('This browser cannot start a local video room')
      return
    }

    if (isJoinedRef.current) leaveRoom()

    setRoomId(nextRoomId)
    roomIdRef.current = nextRoomId
    const url = new URL(window.location.href)
    url.searchParams.set('room', nextRoomId)
    window.history.replaceState(null, '', url.toString())

    setStatus('Requesting camera and microphone')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      attachLocalStream(stream)
    } catch {
      setStatus('Camera or microphone permission was blocked')
      return
    }
    setMicEnabled(true)
    setCameraEnabled(true)

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(channelName)
      channelRef.current = channel
      channel.onmessage = (event) => void handleSignal(event.data as SignalMessage)
    }

    const supabase = createClient()
    const realtimeChannel = supabase.channel(`video-room:${nextRoomId}`, {
      config: { broadcast: { self: false } },
    })
    supabaseRef.current = supabase
    realtimeChannelRef.current = realtimeChannel
    realtimeChannel
      .on('broadcast', { event: 'signal' }, ({ payload }) => void handleSignal(payload as SignalMessage))
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('Room open. Share the link, then keep this tab open.')
          announcePresence(nextRoomId)
        }
        if (subscriptionStatus === 'CHANNEL_ERROR') setStatus('Room open locally. Realtime signalling is unavailable.')
      })

    setIsJoined(true)
    isJoinedRef.current = true
    setStatus('Room open. Share the link, then keep this tab open.')
    window.setTimeout(() => announcePresence(nextRoomId), 300)
  }

  function leaveRoom() {
    if (roomIdRef.current) postSignal({ roomId: roomIdRef.current, from: participantId, type: 'leave' })
    if (supabaseRef.current && realtimeChannelRef.current) void supabaseRef.current.removeChannel(realtimeChannelRef.current)
    realtimeChannelRef.current = null
    supabaseRef.current = null
    channelRef.current?.close()
    channelRef.current = null
    peerRefs.current.forEach((peer) => peer.close())
    peerRefs.current.clear()
    remoteStreamsRef.current.clear()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    setParticipants([])
    setIsJoined(false)
    isJoinedRef.current = false
    setIsSharingScreen(false)
    setStatus(roomIdRef.current ? 'Room left' : 'No room joined')
    renderRemoteVideos()
  }

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled
      setMicEnabled(track.enabled)
    })
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled
      setCameraEnabled(track.enabled)
    })
  }

  async function shareScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia || !localStreamRef.current) return
    let screenStream: MediaStream
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    } catch {
      setStatus('Screen share was cancelled')
      return
    }
    const screenTrack = screenStream.getVideoTracks()[0]
    if (!screenTrack) return

    peerRefs.current.forEach((peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === 'video')
      void sender?.replaceTrack(screenTrack)
    })
    setIsSharingScreen(true)
    screenTrack.onended = () => {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
      if (!cameraTrack) return
      peerRefs.current.forEach((peer) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === 'video')
        void sender?.replaceTrack(cameraTrack)
      })
      setIsSharingScreen(false)
    }
  }

  async function copyRoomLink() {
    if (!roomLink) return
    await navigator.clipboard?.writeText(roomLink)
    setStatus('Room link copied')
  }

  return (
    <article className={styles.panel}>
      <header>
        <Video size={18} />
        <strong>Internal Video Call</strong>
        <button onClick={() => void joinRoom()}><Radio size={14} />{isJoined ? 'Reconnect' : 'Start'}</button>
      </header>

      <div className={styles.videoRoomGrid}>
        <div className={styles.videoTile}>
          <video ref={localVideoRef} muted playsInline autoPlay />
          <span>{isJoined ? 'You' : 'Local preview'}</span>
        </div>
        <div className={styles.videoTile}>
          <div className={styles.remoteStack}>
            <div ref={remoteGridRef} className={styles.remoteGrid} />
            {participants.length === 0 ? (
              <div className={styles.emptyRemote}>
                <Users size={22} />
                <span>Waiting for a teammate</span>
              </div>
            ) : null}
          </div>
          <span>{participants.length} remote participant{participants.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className={styles.callStage}>
        <div>
          <strong>{status}</strong>
          <span>{roomLink || 'Start a room to create a shareable internal call link.'}</span>
        </div>
      </div>

      <div className={styles.callActions}>
        <button onClick={toggleMic} disabled={!isJoined}>{micEnabled ? <Mic size={14} /> : <MicOff size={14} />}{micEnabled ? 'Mute' : 'Unmute'}</button>
        <button onClick={toggleCamera} disabled={!isJoined}>{cameraEnabled ? <Camera size={14} /> : <CameraOff size={14} />}{cameraEnabled ? 'Camera off' : 'Camera on'}</button>
        <button onClick={() => void shareScreen()} disabled={!isJoined}><MonitorUp size={14} />{isSharingScreen ? 'Sharing' : 'Share'}</button>
        <button onClick={() => void copyRoomLink()} disabled={!roomLink}><Copy size={14} />Copy link</button>
        <button onClick={leaveRoom} disabled={!isJoined}><PhoneOff size={14} />Leave</button>
      </div>

      <label className={styles.nameField}>
        <span>Display name</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
    </article>
  )
}
