'use client'

import { useState } from 'react'
import { Palette, Globe, Layers, CheckCircle2, Loader2 } from 'lucide-react'
import { submitSiteBuildRequest } from '@/lib/actions/site-builder-actions'

export default function SiteBuilderClient({ initialRequest }: { initialRequest: any }) {
  const [loading, setLoading] = useState(false)
  
  // Determine step based on status
  let initialStep = 1
  if (initialRequest) {
    if (initialRequest.status === 'Design & Build') initialStep = 2
    if (initialRequest.status === 'Ready for Review' || initialRequest.status === 'Launched') initialStep = 3
  }
  
  const [step, setStep] = useState(initialStep)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const res = await submitSiteBuildRequest(formData)
    if (res.success) {
      setStep(2)
    } else {
      alert(res.error)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Website Build</h1>
        <p className="text-muted-foreground mt-2">
          Track the progress of your bespoke website and submit requirements.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Progress Tracker */}
        <div className="flex border-b border-border bg-muted/20">
          <div className={`flex-1 p-4 flex flex-col items-center justify-center border-r border-border transition-colors ${step >= 1 ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
            <span className="text-sm font-medium">Requirements</span>
          </div>
          <div className={`flex-1 p-4 flex flex-col items-center justify-center border-r border-border transition-colors ${step >= 2 ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
            <span className="text-sm font-medium">Design & Build</span>
          </div>
          <div className={`flex-1 p-4 flex flex-col items-center justify-center transition-colors ${step >= 3 ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3</div>
            <span className="text-sm font-medium">Review & Launch</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <Palette size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Tell us about your brand</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We need to know your brand colors, logo, and preferred style. Upload your assets or share a link to your current site.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Business Name</label>
                    <input name="business_name" required type="text" className="w-full border border-border bg-background rounded-lg px-4 py-2 text-sm" placeholder="e.g. Acme Corp" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Describe your style</label>
                    <textarea name="style_description" required className="w-full border border-border bg-background rounded-lg px-4 py-2 text-sm" rows={4} placeholder="Modern, playful, professional..."></textarea>
                  </div>
                  <button disabled={loading} type="submit" className="w-full flex items-center justify-center bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Requirements'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4 animate-pulse">
                <Layers size={32} />
              </div>
              <h3 className="text-2xl font-bold">We are building your site</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Our expert developers and designers are currently crafting your bespoke website. We will notify you here once the initial draft is ready for review.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mx-auto mb-4">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-bold">Ready for Review</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Your new website is ready! Click below to review it on our staging server.
              </p>
              <a href={initialRequest?.staging_url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors">
                <Globe size={18} />
                View Staging Site
              </a>
              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-sm text-muted-foreground">Have feedback? Use the Support Chat to talk directly to your developer.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
