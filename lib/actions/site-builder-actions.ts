'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitSiteBuildRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const business_name = formData.get('business_name') as string
  const style_description = formData.get('style_description') as string

  if (!business_name) {
    return { error: 'Business name is required' }
  }

  const { data, error } = await supabase
    .from('site_build_requests')
    .insert({
      user_id: user.id,
      business_name,
      style_description,
      status: 'Requirements Submitted'
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting site build request:', error)
    return { error: error.message }
  }

  revalidatePath('/user-dashboard/site-builder')
  revalidatePath('/dashboard/requests')
  
  return { success: true, data }
}

export async function updateSiteBuildStatus(id: string, status: string, staging_url?: string) {
  const supabase = await createClient()

  const updates: any = { status, updated_at: new Date().toISOString() }
  if (staging_url !== undefined) {
    updates.staging_url = staging_url
  }

  const { error } = await supabase
    .from('site_build_requests')
    .update(updates)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/user-dashboard/site-builder')
  revalidatePath('/dashboard/requests')

  return { success: true }
}
