'use server'

import { createClient } from '@/lib/supabase/server'
import { dashboardWorkspaceApi } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'

async function getToken() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function sendConversationReply(conversationId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'Message cannot be empty.' }
  if (!conversationId?.trim()) return { error: 'Conversation is required.' }
  if (trimmed.length > 5000) return { error: 'Message is too long. Please keep it under 5000 characters.' }

  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    await dashboardWorkspaceApi.reply(token, conversationId, trimmed)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Message could not be sent.' }
  }

  revalidatePath('/dashboard/messages')
  return { success: true }
}

export async function markConversationRead(conversationId: string) {
  if (!conversationId?.trim()) return { error: 'Conversation is required.' }
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    await dashboardWorkspaceApi.markRead(token, conversationId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Conversation could not be marked read.' }
  }

  revalidatePath('/dashboard/messages')
  return { success: true }
}
