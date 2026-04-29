'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/ChatWindow'

type Conversation = {
  user_id: string
  email: string
  last_message_at: string
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const loadAdminAndConversations = async () => {
      setIsLoading(true)
      
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser()
      if (user && isMounted) {
        setCurrentAdminId(user.id)
      }

      // Fetch all unique conversations by getting messages
      // Note: For a production app at scale, you'd want a dedicated 'conversations' table or view
      // But for our current schema, we can get unique users from the user_profiles table 
      // who have messages, or just fetch all user_profiles except admins.
      
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('user_id, email, role')
        .eq('role', 'user') // Only fetch normal users

      if (!error && profiles && isMounted) {
        // Map to conversation format
        const convos = profiles.map(p => ({
          user_id: p.user_id,
          email: p.email,
          last_message_at: new Date().toISOString() // Placeholder
        }))
        setConversations(convos)
      }
      
      if (isMounted) setIsLoading(false)
    }

    loadAdminAndConversations()

    return () => {
      isMounted = false
    }
  }, [supabase])

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading conversations...</div>
  }

  return (
    <div className="flex h-full p-6 max-w-6xl mx-auto w-full gap-6">
      
      {/* Conversations List */}
      <div className="w-1/3 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-lg">User Inboxes</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.user_id}
                onClick={() => setSelectedUserId(convo.user_id)}
                className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-accent/50 ${
                  selectedUserId === convo.user_id ? 'bg-accent' : ''
                }`}
              >
                <div className="font-medium truncate">{convo.email}</div>
                <div className="text-xs text-muted-foreground truncate">
                  User ID: {convo.user_id.split('-')[0]}...
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active Chat Window */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden bg-card min-h-[500px]">
        {selectedUserId && currentAdminId ? (
          <ChatWindow 
            currentUserId={currentAdminId}
            conversationUserId={selectedUserId}
            isAdmin={true}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10">
            Select a user from the list to view their messages and reply.
          </div>
        )}
      </div>

    </div>
  )
}
