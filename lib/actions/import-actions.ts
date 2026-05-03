'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'

type ContactRow = {
  name: string
  email?: string
  company?: string
  phone?: string
  source?: string
  stage?: string
}

export async function importContactsFromRows(
  rows: ContactRow[],
  filename: string,
  defaultStage = 'New',
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null

  if (!rows.length) return { error: 'No valid rows found.' }

  const validRows = rows.filter((r) => r.name?.trim())
  if (!validRows.length) return { error: 'No rows with a Name column found.' }

  const inserts = validRows.map((r) => ({
    name: r.name.trim(),
    email: r.email?.trim() || null,
    company: r.company?.trim() || null,
    phone: r.phone?.trim() || null,
    source: r.source?.trim() || 'Import',
    status: r.stage?.trim() || defaultStage,
    assigned_to: userId,
  }))

  let successCount = 0
  const errors: string[] = []

  // Insert in batches of 50
  for (let i = 0; i < inserts.length; i += 50) {
    const batch = inserts.slice(i, i + 50)
    const { data, error } = await supabase.from('leads').insert(batch).select('id, name')
    if (error) {
      errors.push(`Batch ${Math.floor(i / 50) + 1}: ${error.message}`)
    } else {
      successCount += batch.length
    }
  }

  // Log the import job
  await supabase.from('contact_imports').insert({
    imported_by: userId,
    filename,
    row_count: validRows.length,
    success_count: successCount,
    error_count: errors.length,
    errors: errors.length ? errors : null,
  })

  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/overview')

  return { success: true, imported: successCount, errors: errors.length ? errors : undefined }
}
