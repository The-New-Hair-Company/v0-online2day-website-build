import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Video, ExternalLink } from 'lucide-react'

export default async function VideosPage() {
  const supabase = await createClient()

  const { data: videos, error } = await supabase
    .from('lead_assets')
    .select('*, lead:leads(name, company)')
    .eq('type', 'video')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Videos</h1>
          <p className="text-muted-foreground mt-1">Personalised video assets for your leads</p>
        </div>
        <Link
          href="/dashboard/videos/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus size={18} />
          Upload Video
        </Link>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm">{error.message}</div>
      )}

      {(!videos || videos.length === 0) ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video size={28} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground mb-2">No Videos Yet</h2>
          <p className="text-muted-foreground mb-6">Upload personalised videos for your leads and share them via a unique link.</p>
          <Link
            href="/dashboard/videos/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={18} />
            Upload First Video
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => (
            <div key={video.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors group">
              {/* Thumbnail placeholder */}
              <div className="aspect-video bg-muted/50 flex items-center justify-center relative">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <div className="w-0 h-0 border-t-[9px] border-t-transparent border-l-[16px] border-l-primary border-b-[9px] border-b-transparent ml-1" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-card-foreground truncate">{video.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(video as any).lead?.name} — {(video as any).lead?.company || 'No company'}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {new Date(video.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {video.slug && (
                    <Link
                      href={`/v/${video.slug}`}
                      target="_blank"
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      Client Link <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
