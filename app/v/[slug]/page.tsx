import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VideoTracker from './VideoTracker'
import Link from 'next/link'
import { Calendar, Mail } from 'lucide-react'

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient()
  const { slug } = await params

  // Look up by slug in lead_assets first, then fall back to lead ID
  const { data: asset } = await supabase
    .from('lead_assets')
    .select('*, lead:leads(id, name, company, email)')
    .eq('slug', slug)
    .eq('type', 'video')
    .single()

  // Fallback: slug might be a lead ID (legacy)
  let lead: any = asset?.lead
  let videoUrl: string | null = asset?.url || null
  let videoName: string = asset?.name || ''
  let editorProject: any = asset?.metadata && typeof asset.metadata === 'object' && 'editorProject' in asset.metadata ? asset.metadata : null

  if (!lead) {
    const { data: directLead } = await supabase
      .from('leads')
      .select('id, name, company, email')
      .eq('id', slug)
      .single()

    if (!directLead) notFound()
    lead = directLead

    // Get latest video for this lead
    const { data: latestAssets } = await supabase
      .from('lead_assets')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('type', 'video')
      .order('created_at', { ascending: false })
      .limit(1)

    if (latestAssets?.[0]) {
      videoUrl = latestAssets[0].url
      videoName = latestAssets[0].name
      editorProject = latestAssets[0].metadata && typeof latestAssets[0].metadata === 'object' && 'editorProject' in latestAssets[0].metadata ? latestAssets[0].metadata : null
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d14] flex flex-col">
      {/* Tracking pixel — fires once on page load */}
      <VideoTracker leadId={lead.id} />

      {/* Subtle top bar */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <span className="text-white/40 text-sm font-medium tracking-wide">Online2Day</span>
        <span className="text-white/20 text-xs">Personalised for {lead.name}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start py-16 px-6">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-xs font-semibold uppercase tracking-wider mb-6">
              ✦ Personalised Message
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Hey {lead.name}
              {lead.company ? <span className="text-violet-400"> at {lead.company}</span> : ''},
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
              We recorded a short personalised video just for you. Have a watch — we think you'll love what we've put together.
            </p>
          </div>

          {/* Video Player */}
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(124,58,237,0.2)] border border-white/10 mb-10">
            {videoUrl ? (
              <div className="aspect-video">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : editorProject ? (
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-[#081225] via-[#0b1020] to-[#111827]">
                <div className="absolute inset-8 border border-white/10 rounded-xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(47,107,255,0.35),transparent_30%)]" />
                <div className="relative h-full p-10 flex flex-col justify-center">
                  <div className="text-violet-300 text-xs font-bold uppercase tracking-[0.2em] mb-5">Online2Day video project</div>
                  <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight max-w-3xl">
                    {editorProject.scenes?.[0]?.headline || videoName || 'Personalised strategy video'}
                  </h2>
                  <p className="mt-5 text-white/60 text-lg max-w-2xl">
                    {editorProject.scenes?.[0]?.note || 'This CRM-generated video project is ready for review and follow-up.'}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {(editorProject.scenes || []).slice(0, 4).map((scene: any, index: number) => (
                      <span key={scene.id || index} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                        {index + 1}. {scene.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-[#111] text-white/30">
                <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[22px] border-l-violet-400 border-b-[12px] border-b-transparent ml-2" />
                </div>
                <p className="text-sm">Video will appear here once uploaded</p>
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
            >
              <Calendar size={18} />
              Book a Call with Us
            </Link>
            <a
              href="mailto:hello@online2day.com"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
            >
              <Mail size={18} />
              Reply by Email
            </a>
          </div>

          {/* Trust footer */}
          <div className="text-center space-y-1">
            <p className="text-white/20 text-sm">This message was created exclusively for {lead.name}.</p>
            <p className="text-white/10 text-xs">Online2Day · hello@online2day.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
