import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VideoTracker from './VideoTracker'
import Link from 'next/link'

export default async function VideoPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  // For this implementation, slug is the lead ID to keep it simple.
  // In a real app you might have a dedicated lead_assets row with a unique token.
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.slug)
    .single()

  if (error || !lead) {
    notFound()
  }

  // Get the latest video asset for this lead
  const { data: assets } = await supabase
    .from('lead_assets')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('type', 'video')
    .order('created_at', { ascending: false })
    .limit(1)

  const videoAsset = assets?.[0]

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center py-20 px-6">
      <VideoTracker leadId={lead.id} />
      
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-serif text-white mb-4">
            A message for {lead.name} {lead.company ? `at ${lead.company}` : ''}
          </h1>
          <p className="text-slate-400 text-lg">From the team at Online2Day</p>
        </div>

        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video border border-slate-800 mb-10">
          {videoAsset ? (
            <video 
              src={videoAsset.public_url} 
              controls 
              className="w-full h-full object-cover"
              poster="/video-poster.jpg"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <p>Video processing or not found...</p>
              <p className="text-sm mt-2">Placeholder for video</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/contact" className="px-8 py-4 bg-teal-600 text-white font-medium rounded-full hover:bg-teal-700 transition-colors">
            Book a Call
          </Link>
          <a href="mailto:hello@online2day.com" className="px-8 py-4 bg-transparent border border-slate-700 text-white font-medium rounded-full hover:bg-slate-800 transition-colors">
            Reply by Email
          </a>
        </div>
      </div>
    </div>
  )
}
