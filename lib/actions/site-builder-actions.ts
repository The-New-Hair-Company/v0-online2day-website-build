'use server'

import { siteBuildApi } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function submitSiteBuildRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const business_name = formData.get('business_name') as string
  const style_description = formData.get('style_description') as string
  if (!business_name) return { error: 'Business name is required' }

  try {
    const token = await getToken()
    const result = await siteBuildApi.submit(token, {
      clientName: user.user_metadata?.full_name || user.email || 'Unknown',
      clientEmail: user.email || '',
      businessName: business_name,
      notes: style_description || null,
    })
    revalidatePath('/user-dashboard/site-builder')
    revalidatePath('/dashboard/requests')
    return { success: true, data: result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateSiteBuildStatus(id: string, status: string, staging_url?: string) {
  try {
    const token = await getToken()
    await siteBuildApi.updateStatus(token, id, status, staging_url ?? null)
    revalidatePath('/user-dashboard/site-builder')
    revalidatePath('/dashboard/requests')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
