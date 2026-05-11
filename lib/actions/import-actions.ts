'use server'

import { createClient } from '@/lib/supabase/server'
import { leadsApi } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'

type ContactRow = {
  name: string
  email?: string
  company?: string
  phone?: string
  source?: string
  stage?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function importContactsFromRows(
  rows: ContactRow[],
  filename: string,
  defaultStage = 'New',
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!rows.length) return { error: 'No valid rows found.' }

  type FailureRow = { rowNumber: number; reason: string; preview: string }
  const failures: FailureRow[] = []
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

    if (!name) { failures.push({ rowNumber, reason: 'Missing required name.', preview: `${email || '(no email)'} ${company}`.trim() }); continue }
    if (email && !EMAIL_RE.test(email)) { failures.push({ rowNumber, reason: 'Invalid email format.', preview: `${name} <${email}>` }); continue }
    if (email && seenEmails.has(email)) { failures.push({ rowNumber, reason: 'Duplicate email in this file.', preview: `${name} <${email}>` }); continue }
    if (email) seenEmails.add(email)
    staged.push({ rowNumber, name, email: email || null, company: company || null, phone: phone || null, source, status })
  }

  if (!staged.length) {
    return { error: 'No importable rows were found after validation.', report: { totalRows: rows.length, imported: 0, failed: failures.length, failures } }
  }

  try {
    const token = await getToken()
    const result = await leadsApi.bulkImport(token, {
      leads: staged.map((r) => ({
        name: r.name,
        email: r.email,
        company: r.company,
        phone: r.phone,
        source: r.source,
        status: r.status,
      })),
      filename,
      stage: defaultStage,
    })

    // Log the import job to contact_imports (direct — extended schema not in .NET)
    try {
      await supabase.from('contact_imports').insert({
        imported_by: userData.user?.id || null,
        filename,
        row_count: rows.length,
        success_count: result.importedCount,
        error_count: failures.length,
        errors: failures.length ? { failures: failures.slice(0, 40) } : null,
      } as any)
    } catch { /* non-fatal */ }

    revalidatePath('/dashboard/leads')
    revalidatePath('/dashboard/overview')

    return {
      success: true,
      imported: result.importedCount,
      report: {
        totalRows: rows.length,
        imported: result.importedCount,
        failed: failures.length,
        failures: failures.slice(0, 40),
      },
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
