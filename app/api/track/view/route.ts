import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const { leadId } = await request.json()
    
    if (!leadId || typeof leadId !== 'string' || !UUID_RE.test(leadId)) {
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

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
