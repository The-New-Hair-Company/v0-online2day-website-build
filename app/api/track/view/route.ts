import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { leadId } = await request.json()
    
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.from('lead_events').insert({
      lead_id: leadId,
      type: 'Video View',
      note: 'Client viewed the personalized video page',
    })

    if (error) {
      console.error('Error logging video view:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
