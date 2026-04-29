'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

type Message = {
  id: string
  conversation_user_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export function ChatWindow({ 
  currentUserId, 
  conversationUserId,
  isAdmin
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
      }
      if (isMounted) setIsLoading(false)
    }

    if (conversationUserId) {
      fetchMessages()
    } else {
      setIsLoading(false)
    }

    // Subscribe to new messages
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
        }
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
      setNewMessage(tempMessage) // restore if failed
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
                className={`flex flex-col max-w-[80%] ${
                  isMine ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted text-foreground rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
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
