import { createClient } from '@/lib/supabase/server'
import UploadVideoForm from './UploadVideoForm'

export default async function NewVideoPage() {
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, company')
    .order('name', { ascending: true })

  return <UploadVideoForm leads={leads || []} />
}
