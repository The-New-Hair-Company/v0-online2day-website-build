'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Minimize2, Send, XCircle } from 'lucide-react'

type ChatMessage = {
  id: string
  content: string
  senderType: string
  deliveryStatus: string
  createdAt: string
}

export function PublicChatWidget() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('Website enquiry')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true)
    try {
      const response = await fetch('/api/chat', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Chat could not be loaded.')
      setActive(Boolean(body.active))
      setMessages(Array.isArray(body.messages) ? body.messages : [])
      setError('')
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : 'Chat could not be loaded.')
    } finally {
      if (!quiet) setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open || !active) return
    const timer = window.setInterval(() => void refresh(true), 15_000)
    return () => window.clearInterval(timer)
  }, [active, open, refresh])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function start(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', name: name.trim(), email: email.trim() || undefined, topic }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Conversation could not be started.')
      setActive(true)
      await refresh(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be started.')
    } finally {
      setBusy(false)
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', content }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Message could not be sent.')
      setDraft('')
      await refresh(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-[84px] right-3 z-[900] sm:right-5" aria-live="polite">
      {open ? (
        <section data-public-chat-panel className="mb-3 flex h-[min(620px,calc(100dvh-180px))] min-h-[320px] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl" aria-label="Chat with Online2Day">
          <header className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <span className="grid size-9 place-items-center rounded-xl bg-white/15"><MessageCircle size={18} /></span>
            <div className="min-w-0 flex-1">
              <strong className="block text-sm">Online2Day chat</strong>
              <span className="block text-xs opacity-80">Messages go directly to our dashboard</span>
            </div>
            <button type="button" className="grid size-10 place-items-center rounded-lg hover:bg-white/15" onClick={() => setOpen(false)} aria-label="Minimise chat"><Minimize2 size={18} /></button>
          </header>

          {!active ? (
            <form className="grid flex-1 content-start gap-4 overflow-y-auto p-5" onSubmit={start}>
              <div>
                <h2 className="text-lg font-bold">Start a conversation</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tell us who you are and what you need. Your thread stays private in this browser.</p>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold">Name
                <input className="min-h-11 rounded-lg border border-input bg-background px-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">Email <span className="font-normal text-muted-foreground">(optional)</span>
                <input className="min-h-11 rounded-lg border border-input bg-background px-3 font-normal" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">Topic
                <select className="min-h-11 rounded-lg border border-input bg-background px-3 font-normal" value={topic} onChange={(event) => setTopic(event.target.value)}>
                  <option>Website enquiry</option><option>CRM and automation</option><option>Account support</option><option>Billing</option><option>Other</option>
                </select>
              </label>
              {error ? <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="mt-0.5 shrink-0" size={15} />{error}</p> : null}
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50" disabled={busy || name.trim().length < 2}>
                {busy ? <Loader2 className="animate-spin" size={17} /> : <MessageCircle size={17} />} Start chat
              </button>
              <p className="text-xs leading-relaxed text-muted-foreground">Do not include passwords, payment-card details, or other sensitive information.</p>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {!messages.length && !busy ? <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground"><div><CheckCircle2 className="mx-auto mb-2 text-primary" /><strong className="block text-foreground">Conversation ready</strong>Send your first message below.</div></div> : null}
                {messages.map((message) => {
                  const mine = message.senderType === 'visitor'
                  return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'}`}>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <span className={`mt-1 block text-[10px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine ? ` · ${message.deliveryStatus}` : ''}</span>
                    </div>
                  </div>
                })}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="border-t border-border bg-background/70 p-3">
                {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
                <div className="flex items-end gap-2">
                  <textarea className="min-h-11 max-h-32 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your message…" rows={1} maxLength={5000} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
                  <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" disabled={busy || !draft.trim()} aria-label="Send message">{busy ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}</button>
                </div>
              </form>
            </>
          )}
        </section>
      ) : null}
      <button type="button" className="ml-auto grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary text-primary-foreground shadow-xl transition hover:-translate-y-0.5 hover:bg-[var(--brand-primary-hover)]" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close chat' : 'Open chat'} aria-expanded={open}>
        {open ? <Minimize2 size={21} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
