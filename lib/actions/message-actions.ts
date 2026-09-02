'use server'

import { createClient } from '@/lib/supabase/server'
import { dashboardWorkspaceApi, messagingApi } from '@/lib/api/client'
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
    if (error instanceof Error && /403|forbidden/i.test(error.message)) {
      try { await messagingApi.reply(token, conversationId, trimmed) }
      catch (memberError) { return { error: memberError instanceof Error ? memberError.message : 'Message could not be sent.' } }
    } else return { error: error instanceof Error ? error.message : 'Message could not be sent.' }
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
    if (error instanceof Error && /403|forbidden/i.test(error.message)) {
      try { await messagingApi.markRead(token, conversationId) }
      catch (memberError) { return { error: memberError instanceof Error ? memberError.message : 'Conversation could not be marked read.' } }
    } else return { error: error instanceof Error ? error.message : 'Conversation could not be marked read.' }
  }

  revalidatePath('/dashboard/messages')
  return { success: true }
}

export async function loadMyConversations() {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    return { conversations: await messagingApi.conversations(token) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Messages could not be loaded.' }
  }
}

export async function ensureSupportConversation() {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    return await messagingApi.ensureSupport(token)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Support chat could not be started.' }
  }
}

export async function sendMyConversationReply(conversationId: string, content: string) {
  const trimmed = content.trim()
  if (!conversationId) return { error: 'Conversation is required.' }
  if (!trimmed) return { error: 'Message cannot be empty.' }
  if (trimmed.length > 5_000) return { error: 'Keep messages under 5,000 characters.' }
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    const message = await messagingApi.reply(token, conversationId, trimmed)
    revalidatePath('/user-dashboard/chat')
    return { message }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Message could not be sent.' }
  }
}

export async function markMyConversationRead(conversationId: string) {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    await messagingApi.markRead(token, conversationId)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Read state could not be updated.' }
  }
}

export async function getWorkspaceMembers() {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  try {
    return { members: await messagingApi.members(token) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Workspace members could not be loaded.' }
  }
}

export async function startInternalConversation(recipientId: string, content: string) {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  if (!recipientId || !content.trim()) return { error: 'Choose a member and enter a message.' }
  try {
    const result = await messagingApi.startInternal(token, recipientId, content.trim())
    revalidatePath('/dashboard/messages')
    return result
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Internal conversation could not be started.' }
  }
}

export async function getWhatsAppConnectionStatus() {
  const token = await getToken()
  if (!token) return { configured: false, provider: 'Meta WhatsApp Cloud API' }
  return messagingApi.whatsappStatus(token).catch(() => ({ configured: false, provider: 'Meta WhatsApp Cloud API' }))
}

export async function sendWhatsAppConversationReply(conversationId: string, to: string, content: string) {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated.' }
  if (!conversationId || !to.trim() || !content.trim()) return { error: 'A conversation, WhatsApp number, and message are required.' }
  try {
    const message = await messagingApi.sendWhatsApp(token, conversationId, to.trim(), content.trim())
    revalidatePath('/dashboard/messages')
    return { message }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'WhatsApp message could not be sent.' }
  }
}
