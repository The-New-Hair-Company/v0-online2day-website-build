'use server'

import { tasksApi } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function resolveLeadId(taskId: string, leadId?: string | null): Promise<string | null> {
  if (leadId) return leadId
  const supabase = await createClient()
  const { data } = await supabase.from('lead_tasks').select('lead_id').eq('id', taskId).single()
  return (data as any)?.lead_id ?? null
}

export async function createTask(data: {
  title: string
  leadId?: string | null
  dueDate?: string
  dueTime?: string
  notes?: string
}) {
  if (!data.title.trim()) return { error: 'Task title is required.' }
  if (!data.leadId) return { error: 'A lead must be selected for task creation.' }

  let dueAt: string | null = null
  if (data.dueDate) {
    const dateStr = data.dueTime ? `${data.dueDate}T${data.dueTime}:00` : `${data.dueDate}T09:00:00`
    dueAt = new Date(dateStr).toISOString()
  }

  try {
    const token = await getToken()
    await tasksApi.create(token, data.leadId, {
      title: data.title.trim(),
      description: data.notes?.trim() || null,
      dueDate: dueAt,
    })
    revalidatePath('/dashboard/overview')
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${data.leadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function completeTask(taskId: string, leadId?: string | null) {
  try {
    const resolvedLeadId = await resolveLeadId(taskId, leadId)
    if (!resolvedLeadId) return { error: 'Could not determine lead for this task.' }
    const token = await getToken()
    await tasksApi.complete(token, resolvedLeadId, taskId)
    revalidatePath('/dashboard/overview')
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${resolvedLeadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function uncompleteTask(taskId: string, leadId?: string | null) {
  try {
    const resolvedLeadId = await resolveLeadId(taskId, leadId)
    if (!resolvedLeadId) return { error: 'Could not determine lead for this task.' }
    const token = await getToken()
    await tasksApi.uncomplete(token, resolvedLeadId, taskId)
    revalidatePath('/dashboard/overview')
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${resolvedLeadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
