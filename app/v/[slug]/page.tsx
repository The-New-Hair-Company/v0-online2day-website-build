import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VideoTracker from './VideoTracker'
import { Calendar, Mail } from 'lucide-react'
import EditedVideoPlayer from './EditedVideoPlayer'

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient()
  const { slug } = await params

  const { data: asset } = await supabase
    .from('lead_assets')
    .select('*, lead:leads(id, name, company, email)')
    .eq('slug', slug)
    .eq('type', 'video')
    .single()

  let lead: any = asset?.lead ?? null
  let videoUrl: string | null = asset?.url || null
  let videoStoragePath: string | null = asset?.storage_path || null
  let videoName: string = asset?.name || ''
  let editorProject: any =
    asset?.metadata && typeof asset.metadata === 'object' && 'editorProject' in asset.metadata
      ? asset.metadata
      : null
  let trackedAssetId: string = asset?.id || ''

  // Standalone video (no lead) — metadata.sharedVideo === true
  const isSharedVideo = asset && !lead

  if (!lead && !isSharedVideo) {
    // Fallback: slug might be a lead ID (legacy)
    const { data: directLead } = await supabase
      .from('leads')
      .select('id, name, company, email')
      .eq('id', slug)
      .single()

    if (!directLead) notFound()
    lead = directLead

    const { data: latestAssets } = await supabase
      .from('lead_assets')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('type', 'video')
      .order('created_at', { ascending: false })
      .limit(1)

    if (latestAssets?.[0]) {
      trackedAssetId = latestAssets[0].id
      videoUrl = latestAssets[0].url
      videoStoragePath = latestAssets[0].storage_path
      videoName = latestAssets[0].name
      editorProject =
        latestAssets[0].metadata &&
        typeof latestAssets[0].metadata === 'object' &&
        'editorProject' in latestAssets[0].metadata
          ? latestAssets[0].metadata
          : null
    }
  }

  if (!asset && !lead) notFound()

  if (videoStoragePath) {
    const { data: signedUrlData } = await supabase.storage
      .from('lead-videos')
      .createSignedUrl(videoStoragePath, 60 * 60 * 24 * 7)
    videoUrl = signedUrlData?.signedUrl || videoUrl
  }

  const editorSettings = editorProject?.settings && typeof editorProject.settings === 'object' ? editorProject.settings : {}
  const trimStart = Number(editorSettings.trimStart || 0)
  const trimEnd = Number(editorSettings.trimEnd || 0)
  const playerProps = {
    trimStart,
    trimEnd,
    cuts: Array.isArray(editorSettings.cuts) ? editorSettings.cuts : [],
    transform: editorSettings.transform,
    captions: Array.isArray(editorSettings.captionItems) ? editorSettings.captionItems : [],
    captionsEnabled: Boolean(editorSettings.captions),
    captionStyle: editorSettings.captionStyle,
    watermark: Boolean(editorProject?.brand?.watermark),
    brandColor: editorProject?.brand?.primary || '#2f6bff',
    playbackRate: Number(editorSettings.playbackRate || 1),
    volume: Number(editorSettings.volume ?? 1),
    fallbackCaption: editorProject?.scenes?.[0]?.headline || '',
  }
  const videoAspect = String(editorProject?.format || '16:9').replace(':', ' / ')
  const ctaLabel = editorProject?.cta?.label || 'Book a Call with Us'
  const ctaUrl = editorProject?.cta?.destination || '/contact'

  // ─── Shared / standalone video (no lead personalisation) ──────────────────
  if (isSharedVideo) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {trackedAssetId ? <VideoTracker assetId={trackedAssetId} /> : null}
        <div className="border-b border-border px-8 py-4 flex items-center justify-between bg-card/50">
          <span className="text-muted-foreground text-sm font-medium tracking-wide">Online2Day</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start py-16 px-6">
          <div className="max-w-4xl w-full">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                {videoName || 'Video from Online2Day'}
              </h1>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                This video was shared with you by the Online2Day team.
              </p>
            </div>

            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border mb-10">
              {videoUrl ? (
                <div style={{ aspectRatio: videoAspect }}>
                  <EditedVideoPlayer src={videoUrl} {...playerProps} />
                </div>
              ) : (
                <div style={{ aspectRatio: videoAspect }} className="flex flex-col items-center justify-center bg-[#111] text-white/30">
                  <p className="text-sm">Video processing — please check back shortly.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={ctaUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                <Calendar size={18} />
                {ctaLabel}
              </a>
              <a
                href="mailto:hello@online2day.com"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all"
              >
                <Mail size={18} />
                Reply by Email
              </a>
            </div>

            <div className="text-center mt-12">
              <p className="text-muted-foreground/70 text-xs">Online2Day · hello@online2day.com</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Lead-personalised video ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {trackedAssetId ? <VideoTracker assetId={trackedAssetId} /> : null}

      <div className="border-b border-border px-8 py-4 flex items-center justify-between bg-card/50">
        <span className="text-muted-foreground text-sm font-medium tracking-wide">Online2Day</span>
        <span className="text-muted-foreground text-xs">Personalised for {lead.name}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start py-16 px-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-semibold uppercase tracking-wider mb-6">
              Personalised Message
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Hey {lead.name}
              {lead.company ? <span className="text-primary"> at {lead.company}</span> : ''},
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
              We recorded a short personalised video just for you. Have a watch — we think you'll love what we've put together.
            </p>
          </div>

          <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border mb-10">
            {videoUrl ? (
              <div style={{ aspectRatio: videoAspect }}>
                <EditedVideoPlayer src={videoUrl} {...playerProps} />
              </div>
            ) : editorProject ? (
              <div style={{ aspectRatio: videoAspect }} className="relative overflow-hidden bg-linear-to-br from-[#081225] via-[#0b1020] to-[#111827]">
                <div className="absolute inset-8 border border-white/10 rounded-xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(47,107,255,0.35),transparent_30%)]" />
                <div className="relative h-full p-10 flex flex-col justify-center">
                  <div className="text-blue-300 text-xs font-bold uppercase tracking-[0.2em] mb-5">Online2Day video project</div>
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
              <div style={{ aspectRatio: videoAspect }} className="flex flex-col items-center justify-center bg-[#111] text-white/30">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[22px] border-l-primary border-b-[12px] border-b-transparent ml-2" />
                </div>
                <p className="text-sm">Video will appear here once uploaded</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href={ctaUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              <Calendar size={18} />
              {ctaLabel}
            </a>
            <a
              href="mailto:hello@online2day.com"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all"
            >
              <Mail size={18} />
              Reply by Email
            </a>
          </div>

          <div className="text-center space-y-1">
            <p className="text-muted-foreground text-sm">This message was created exclusively for {lead.name}.</p>
            <p className="text-muted-foreground/70 text-xs">Online2Day · hello@online2day.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
