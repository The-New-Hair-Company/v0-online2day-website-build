'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendConversationReply(conversationId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'Message cannot be empty.' }
  if (!conversationId?.trim()) return { error: 'Conversation is required.' }
  if (trimmed.length > 5000) return { error: 'Message is too long. Please keep it under 5000 characters.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const adminId = userData.user.id
  const nowIso = new Date().toISOString()

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('id', conversationId)
    .single()

  if (convError || !conversation) {
    return { error: 'Conversation was not found or is no longer accessible.' }
  }

  // Insert message — admin insert is allowed via is_admin() RLS check
  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    conversation_user_id: adminId,
    sender_id: adminId,
    content: trimmed,
    is_read: true,
    message_type: 'text',
  })

  if (msgError) {
    console.error('sendConversationReply error:', msgError)
    return { error: msgError.message }
  }

  // Update conversation last_message_preview and timestamp
  await supabase
    .from('conversations')
    .update({
      last_message_preview: trimmed.slice(0, 120),
      last_message_at: nowIso,
      updated_at: nowIso,
      status: conversation.status === 'resolved' ? 'open' : conversation.status,
    })
    .eq('id', conversationId)

  revalidatePath('/dashboard/messages')
  return { success: true }
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }
  if (!conversationId?.trim()) return { error: 'Conversation is required.' }

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)

  await supabase
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  revalidatePath('/dashboard/messages')
  return { success: true }
}
