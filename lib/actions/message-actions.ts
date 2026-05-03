'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendConversationReply(conversationId: string, content: string) {
  if (!content.trim()) return { error: 'Message cannot be empty.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const adminId = userData.user.id

  // Insert message — admin insert is allowed via is_admin() RLS check
  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    conversation_user_id: adminId,
    sender_id: adminId,
    content: content.trim(),
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
      last_message_preview: content.trim().slice(0, 120),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  revalidatePath('/dashboard/messages')
  return { success: true }
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()

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
