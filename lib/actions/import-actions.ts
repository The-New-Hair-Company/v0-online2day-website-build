'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ContactRow = {
  name: string
  email?: string
  company?: string
  phone?: string
  source?: string
  stage?: string
}

type ImportFailureRow = {
  rowNumber: number
  reason: string
  preview: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function insertBatchWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  batch: Record<string, unknown>[],
  attempts = 3,
) {
  let lastError: string | null = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { error } = await supabase.from('leads').insert(batch)
    if (!error) return { ok: true as const }
    lastError = error.message
    if (attempt < attempts) await wait(180 * attempt)
  }
  return { ok: false as const, error: lastError || 'Unknown insert error' }
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

  const failures: ImportFailureRow[] = []
  const staged: Array<{ rowNumber: number; name: string; email: string | null; company: string | null; phone: string | null; source: string; status: string }> = []
  const seenEmails = new Set<string>()

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const rowNumber = index + 2
    const name = row.name?.trim() || ''
    const email = row.email?.trim().toLowerCase() || ''
    const company = row.company?.trim() || ''
    const phone = row.phone?.trim() || ''
    const source = row.source?.trim() || 'Import'
    const status = row.stage?.trim() || defaultStage

    if (!name) {
      failures.push({ rowNumber, reason: 'Missing required name.', preview: `${email || '(no email)'} ${company}`.trim() })
      continue
    }
    if (email && !EMAIL_RE.test(email)) {
      failures.push({ rowNumber, reason: 'Invalid email format.', preview: `${name} <${email}>` })
      continue
    }
    if (email && seenEmails.has(email)) {
      failures.push({ rowNumber, reason: 'Duplicate email in this file.', preview: `${name} <${email}>` })
      continue
    }
    if (email) seenEmails.add(email)
    staged.push({
      rowNumber,
      name,
      email: email || null,
      company: company || null,
      phone: phone || null,
      source,
      status,
    })
  }

  if (!staged.length) {
    return { error: 'No importable rows were found after validation.', report: { totalRows: rows.length, imported: 0, failed: failures.length, failures } }
  }

  const candidateEmails = staged.map((row) => row.email).filter(Boolean) as string[]
  const existingEmailSet = new Set<string>()
  if (candidateEmails.length > 0) {
    const { data: existing } = await supabase
      .from('leads')
      .select('email')
      .in('email', candidateEmails)
    for (const row of existing || []) {
      const value = String((row as any).email || '').trim().toLowerCase()
      if (value) existingEmailSet.add(value)
    }
  }

  const inserts = staged
    .filter((row) => {
      if (row.email && existingEmailSet.has(row.email)) {
        failures.push({ rowNumber: row.rowNumber, reason: 'Email already exists in CRM.', preview: `${row.name} <${row.email}>` })
        return false
      }
      return true
    })
    .map((row) => ({
      name: row.name,
      email: row.email,
      company: row.company,
      phone: row.phone,
      source: row.source,
      status: row.status,
      assigned_to: userId,
    }))

  if (!inserts.length) {
    return { error: 'All rows were skipped due to duplicates or validation issues.', report: { totalRows: rows.length, imported: 0, failed: failures.length, failures } }
  }

  let successCount = 0
  const errors: string[] = []

  // Insert in batches of 50
  for (let i = 0; i < inserts.length; i += 50) {
    const batch = inserts.slice(i, i + 50)
    const result = await insertBatchWithRetry(supabase, batch, 3)
    if (!result.ok) {
      errors.push(`Batch ${Math.floor(i / 50) + 1}: ${result.error}`)
      failures.push(
        ...batch.map((row, offset) => ({
          rowNumber: (i + offset) + 2,
          reason: `Batch insert failed after retries: ${result.error}`,
          preview: `${String((row as any).name || 'Unknown')} <${String((row as any).email || 'no-email')}>`,
        })),
      )
    } else {
      successCount += batch.length
    }
  }

  // Log the import job
  await supabase.from('contact_imports').insert({
    imported_by: userId,
    filename,
    row_count: rows.length,
    success_count: successCount,
    error_count: failures.length + errors.length,
    errors: failures.length || errors.length ? { failures, batchErrors: errors } : null,
  })

  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/overview')

  return {
    success: true,
    imported: successCount,
    errors: errors.length ? errors : undefined,
    report: {
      totalRows: rows.length,
      imported: successCount,
      failed: failures.length,
      failures: failures.slice(0, 40),
    },
  }
}
