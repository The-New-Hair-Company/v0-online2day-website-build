import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditLeadForm from './EditLeadForm'

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lead) {
    notFound()
  }

  return <EditLeadForm lead={lead} />
}
