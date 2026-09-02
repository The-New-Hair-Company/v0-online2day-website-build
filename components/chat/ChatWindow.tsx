'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, MessageSquarePlus, PlayCircle, RefreshCw, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ensureSupportConversation, getWorkspaceMembers, loadMyConversations, markMyConversationRead, sendMyConversationReply, startInternalConversation } from '@/lib/actions/message-actions'
import type { MessagingMessageDto, MyConversationDto } from '@/lib/api/client'

const VIDEO_LINK_RE = /(https?:\/\/[^\s]*\/v\/[a-zA-Z0-9_-]+|\/v\/[a-zA-Z0-9_-]+)/

function MessageContent({ content, isMine }: { content: string; isMine: boolean }) {
  const match = VIDEO_LINK_RE.exec(content)
  const slug = match ? /\/v\/([a-zA-Z0-9_-]+)/.exec(match[0])?.[1] : null
  if (!slug) return <span className="whitespace-pre-wrap break-words text-sm">{content}</span>
  const fullUrl = `/v/${slug}`
  const textBefore = content.substring(0, match?.index ?? content.length).trim()
  return <div className="space-y-2">
    {textBefore ? <p className="text-sm">{textBefore}</p> : null}
    <a href={fullUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isMine ? 'border-white/20 bg-white/10 hover:bg-white/20' : 'border-border bg-background hover:bg-muted'}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${isMine ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}><PlayCircle size={20} /></span>
      <span className="min-w-0 flex-1"><strong className="block text-sm">Watch video</strong><span className={`block truncate text-xs ${isMine ? 'text-white/70' : 'text-muted-foreground'}`}>online2day.com{fullUrl}</span></span>
      <ExternalLink size={14} className="shrink-0 opacity-60" />
    </a>
  </div>
}

function ConversationMessage({ message }: { message: MessagingMessageDto }) {
  return <div className={`flex max-w-[86%] flex-col ${message.isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
    <div className={`rounded-2xl px-4 py-2.5 ${message.isMine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'}`}>
      <MessageContent content={message.content} isMine={message.isMine} />
    </div>
    <span className="mt-1 px-1 text-[10px] text-muted-foreground">
      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      {message.isMine ? ` · ${message.deliveryStatus}` : ''}
    </span>
  </div>
}

export function ChatWindow({ currentUserId }: { currentUserId: string; conversationUserId: string; isAdmin: boolean }) {
  const [conversations, setConversations] = useState<MyConversationDto[]>([])
  const [conversationId, setConversationId] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const [members, setMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  const [recipientId, setRecipientId] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const result = await loadMyConversations()
    if ('error' in result && result.error) setError(String(result.error))
    else {
      const rows = result.conversations || []
      setConversations(rows)
      setConversationId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || '')
      setError('')
    }
    if (!quiet) setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const ensured = await ensureSupportConversation()
      if (!mounted) return
      if ('error' in ensured) setError(String(ensured.error))
      else setConversationId(ensured.conversationId)
      await refresh()
    })()
    return () => { mounted = false }
  }, [refresh])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase.channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => void refresh(true))
      .subscribe()
    void markMyConversationRead(conversationId)
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId, refresh, supabase])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conversations, conversationId])

  const selected = conversations.find((conversation) => conversation.id === conversationId)

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !conversationId || sending) return
    setSending(true)
    setError('')
    const result = await sendMyConversationReply(conversationId, content)
    if ('error' in result && result.error) setError(String(result.error))
    else { setDraft(''); await refresh(true) }
    setSending(false)
  }

  async function openNewConversation() {
    setNewConversationOpen(true); setError('')
    const result = await getWorkspaceMembers()
    if ('error' in result) { setError(String(result.error)); return }
    setMembers(result.members)
    setRecipientId(result.members[0]?.id || '')
  }

  async function createConversation(event: FormEvent) {
    event.preventDefault()
    if (!recipientId || !firstMessage.trim() || sending) return
    setSending(true); setError('')
    const result = await startInternalConversation(recipientId, firstMessage)
    if ('error' in result) setError(String(result.error))
    else { setConversationId(result.conversationId); setFirstMessage(''); setNewConversationOpen(false); await refresh(true) }
    setSending(false)
  }

  return <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-card">
    <header className="flex items-center gap-3 border-b border-border bg-muted/30 p-4">
      <div className="min-w-0 flex-1"><h2 className="font-semibold text-foreground">Messages</h2><p className="truncate text-xs text-muted-foreground">Private support and licensed workspace conversations through the Online2Day API.</p></div>
      <Button type="button" variant="outline" onClick={() => void openNewConversation()}><MessageSquarePlus size={16} /> <span className="hidden sm:inline">New</span></Button>
      <Button type="button" size="icon" variant="outline" onClick={() => void refresh()} disabled={loading} aria-label="Refresh messages"><RefreshCw className={loading ? 'animate-spin' : ''} size={16} /></Button>
    </header>
    {newConversationOpen ? <form onSubmit={createConversation} className="grid gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-[220px_1fr_auto]">
      <select className="min-h-11 rounded-md border border-input bg-background px-3 text-sm" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} aria-label="Workspace recipient"><option value="">Choose a licensed member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
      <Input value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="Start a private conversation…" maxLength={5000} />
      <div className="flex gap-2"><Button type="submit" disabled={sending || !recipientId || !firstMessage.trim()}>Start</Button><Button type="button" size="icon" variant="ghost" onClick={() => setNewConversationOpen(false)} aria-label="Cancel new conversation"><X size={17} /></Button></div>
    </form> : null}
    <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex max-h-40 gap-2 overflow-auto border-b border-border p-2 md:max-h-none md:flex-col md:border-b-0 md:border-r" aria-label="Conversations">
        {conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setConversationId(conversation.id)} className={`min-w-[180px] rounded-lg border p-3 text-left md:min-w-0 ${conversation.id === conversationId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}><strong className="block truncate text-sm">{conversation.name}</strong><span className="block truncate text-xs text-muted-foreground">{conversation.channel} · {conversation.preview || 'No messages yet'}</span></button>)}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-busy={loading}>
          {loading ? <div className="grid min-h-60 place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : null}
          {!loading && !selected?.messages.length ? <div className="grid min-h-60 place-items-center text-center text-sm text-muted-foreground"><div><strong className="block text-foreground">How can we help?</strong>Send a message and it will appear in the appropriate Online2Day conversation.</div></div> : null}
          {selected?.messages.map((message) => <ConversationMessage key={message.id} message={{ ...message, isMine: message.senderId === currentUserId }} />)}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="border-t border-border bg-background p-3 sm:p-4">
          {error ? <p className="mb-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex gap-2">
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selected?.name || 'conversation'}…`} maxLength={5000} className="min-h-11 flex-1" />
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={sending || !draft.trim() || !conversationId} aria-label="Send message">{sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
}
