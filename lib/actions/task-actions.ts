'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTask(data: {
  title: string
  leadId?: string | null
  dueDate?: string
  dueTime?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  if (!data.title.trim()) return { error: 'Task title is required.' }

  let dueAt: string | null = null
  if (data.dueDate) {
    const dateStr = data.dueTime ? `${data.dueDate}T${data.dueTime}:00` : `${data.dueDate}T09:00:00`
    dueAt = new Date(dateStr).toISOString()
  }

  const { error } = await supabase.from('lead_tasks').insert({
    title: data.title.trim(),
    lead_id: data.leadId || null,
    due_at: dueAt,
    assigned_to: user.user?.id || null,
    is_done: false,
  })

  if (error) {
    console.error('createTask error:', error)
    return { error: error.message }
  }

  if (data.leadId) {
    await supabase.from('lead_events').insert({
      lead_id: data.leadId,
      type: 'Task Created',
      note: `Task created: ${data.title}`,
      created_by: user.user?.id || null,
    })
  }

  revalidatePath('/dashboard/overview')
  revalidatePath('/dashboard/leads')
  if (data.leadId) revalidatePath(`/dashboard/leads/${data.leadId}`)
  return { success: true }
}

export async function completeTask(taskId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('lead_tasks')
    .update({ is_done: true, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) {
    console.error('completeTask error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/overview')
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function uncompleteTask(taskId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('lead_tasks')
    .update({ is_done: false, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/overview')
  revalidatePath('/dashboard/leads')
  return { success: true }
}
