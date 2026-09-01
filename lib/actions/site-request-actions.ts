'use server'

import { revalidatePath } from 'next/cache'
import { dashboardWorkspaceApi } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'

async function getToken() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function updateSiteRequest(
  id: string,
  input: { stage?: string; priority?: 'Low' | 'Medium' | 'High'; nextAction?: string },
) {
  if (!id) return { error: 'Site request is required.' }
  if (input.nextAction !== undefined && !input.nextAction.trim()) return { error: 'Next action cannot be empty.' }
  const token = await getToken()
  if (!token) return { error: 'Your session has expired. Sign in and try again.' }
  try {
    await dashboardWorkspaceApi.updateSiteRequest(token, id, input)
    revalidatePath('/dashboard/site-requests')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Site request could not be updated.' }
  }
}
