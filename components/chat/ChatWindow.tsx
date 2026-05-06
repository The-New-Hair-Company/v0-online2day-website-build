'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, PlayCircle, ExternalLink } from 'lucide-react'

type Message = {
  id: string
  conversation_user_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

// Detect /v/{slug} URLs (relative or absolute)
const VIDEO_LINK_RE = /(https?:\/\/[^\s]*\/v\/[a-zA-Z0-9_-]+|\/v\/[a-zA-Z0-9_-]+)/

function parseVideoSlug(content: string): string | null {
  const match = VIDEO_LINK_RE.exec(content)
  if (!match) return null
  const part = match[0]
  const slugMatch = /\/v\/([a-zA-Z0-9_-]+)/.exec(part)
  return slugMatch?.[1] ?? null
}

function MessageContent({ content, isMine }: { content: string; isMine: boolean }) {
  const slug = parseVideoSlug(content)

  if (slug) {
    const fullUrl = `/v/${slug}`
    const textBefore = content.substring(0, (VIDEO_LINK_RE.exec(content)?.index ?? content.length)).trim()

    return (
      <div className="space-y-2">
        {textBefore && <p className="text-sm">{textBefore}</p>}
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            isMine
              ? 'bg-white/10 border-white/20 hover:bg-white/20'
              : 'bg-background border-border hover:bg-muted'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isMine ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
          }`}>
            <PlayCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Watch Video</p>
            <p className={`text-xs truncate ${isMine ? 'text-white/60' : 'text-muted-foreground'}`}>
              online2day.com{fullUrl}
            </p>
          </div>
          <ExternalLink size={14} className="shrink-0 opacity-50" />
        </a>
      </div>
    )
  }

  return <span className="text-sm">{content}</span>
}

export function ChatWindow({
  currentUserId,
  conversationUserId,
  isAdmin,
}: {
  currentUserId: string
  conversationUserId: string
  isAdmin: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    let isMounted = true

    const fetchMessages = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_user_id', conversationUserId)
        .order('created_at', { ascending: true })

      if (!error && data && isMounted) {
        setMessages(data)
        scrollToBottom()

        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_user_id', conversationUserId)
          .neq('sender_id', currentUserId)
          .eq('is_read', false)
      }
      if (isMounted) setIsLoading(false)
    }

    if (conversationUserId) {
      fetchMessages()
    } else {
      setIsLoading(false)
    }

    const channel = supabase
      .channel(`chat_${conversationUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_user_id=eq.${conversationUserId}`,
        },
        (payload) => {
          if (isMounted) {
            setMessages((prev) => [...prev, payload.new as Message])
            scrollToBottom()
          }
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [conversationUserId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !conversationUserId) return

    const tempMessage = newMessage
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      conversation_user_id: conversationUserId,
      sender_id: currentUserId,
      content: tempMessage,
    })

    if (error) {
      console.error('Error sending message:', error)
      setNewMessage(tempMessage)
    }
  }

  if (!conversationUserId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a conversation to start chatting.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">
          {isAdmin ? 'Chat with User' : 'Support Chat'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isAdmin ? conversationUserId : 'We usually reply within a few hours.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-10">
            No messages yet. Send a message to start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted text-foreground rounded-tl-none'
                  }`}
                >
                  <MessageContent content={msg.content} isMine={isMine} />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 bg-background border-t border-border flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send size={18} />
        </Button>
      </form>
    </div>
  )
}
