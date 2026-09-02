'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BlogEditor } from './blog-editor'
import type { BlogPostDto, BlogPostWriteDto } from '@/lib/api/client'
import { createBlogMediaUpload, setBlogLifecycle } from '@/app/actions/blog'
import { Archive, CalendarClock, ChevronDown, ChevronUp, ImageUp, Loader2 } from 'lucide-react'

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow'
const textareaCls = `${inputCls} resize-none`

interface BlogPostFormProps {
  initial?: BlogPostDto
  onSave: (data: BlogPostWriteDto) => Promise<void>
  onPublishToggle?: (publish: boolean) => Promise<void>
  mode: 'create' | 'edit'
}

export function BlogPostForm({ initial, onSave, onPublishToggle, mode }: BlogPostFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showSeo, setShowSeo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug)

  const [fields, setFields] = useState({
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    excerpt: initial?.excerpt ?? '',
    category: initial?.category ?? '',
    coverUrl: initial?.coverUrl ?? '',
    authorName: initial?.authorName ?? 'Online2Day Team',
    authorRole: initial?.authorRole ?? 'Online2Day',
    readTime: initial?.readTime?.toString() ?? '',
    tags: initial?.tags.join(', ') ?? '',
    seoTitle: initial?.seoTitle ?? '',
    seoDesc: initial?.seoDesc ?? '',
    canonicalUrl: initial?.canonicalUrl ?? '',
    focusKeyword: initial?.focusKeyword ?? '',
    ogImageUrl: initial?.ogImageUrl ?? '',
    coverAltText: initial?.coverAltText ?? '',
    ogTitle: initial?.ogTitle ?? '',
    ogDescription: initial?.ogDescription ?? '',
  })
  const [noindex, setNoindex] = useState(initial?.noindex ?? false)
  const [content, setContent] = useState(initial?.content ?? '')
  const [scheduleAt, setScheduleAt] = useState(initial?.scheduledAt ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : '')
  const [uploadingImage, setUploadingImage] = useState(false)

  const seoChecks = useMemo(() => {
    const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const keyword = fields.focusKeyword.trim().toLowerCase()
    return [
      { label: 'Descriptive title (30–65 characters)', pass: fields.title.trim().length >= 30 && fields.title.trim().length <= 65 },
      { label: 'Search description (120–160 characters)', pass: (fields.seoDesc || fields.excerpt).trim().length >= 120 && (fields.seoDesc || fields.excerpt).trim().length <= 160 },
      { label: 'Substantial article (600+ words)', pass: plain.split(/\s+/).filter(Boolean).length >= 600 },
      { label: 'Cover or social image', pass: Boolean(fields.ogImageUrl.trim() || fields.coverUrl.trim()) },
      { label: 'Featured image has useful alt text', pass: !fields.coverUrl.trim() || fields.coverAltText.trim().length >= 5 },
      { label: 'Focus keyword appears in title and article', pass: Boolean(keyword && fields.title.toLowerCase().includes(keyword) && plain.toLowerCase().includes(keyword)) },
      { label: 'At least one useful link', pass: /<a\s/i.test(content) },
    ]
  }, [content, fields])
  const seoScore = Math.round((seoChecks.filter((check) => check.pass).length / seoChecks.length) * 100)

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setFields(prev => {
        const next = { ...prev, [key]: value }
        // Auto-generate slug from title unless admin has manually edited it
        if (key === 'title' && !slugEdited) {
          next.slug = slugify(value)
        }
        return next
      })
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugEdited(true)
    setFields(prev => ({ ...prev, slug: e.target.value }))
  }

  function buildPayload(): BlogPostWriteDto {
    return {
      slug: fields.slug.trim(),
      title: fields.title.trim(),
      excerpt: fields.excerpt.trim() || null,
      content: content || null,
      category: fields.category.trim() || null,
      coverUrl: fields.coverUrl.trim() || null,
      authorName: fields.authorName.trim() || 'Online2Day Team',
      authorRole: fields.authorRole.trim() || 'Online2Day',
      readTime: fields.readTime ? parseInt(fields.readTime, 10) : null,
      tags: fields.tags.split(',').map(t => t.trim()).filter(Boolean),
      seoTitle: fields.seoTitle.trim() || null,
      seoDesc: fields.seoDesc.trim() || null,
      canonicalUrl: fields.canonicalUrl.trim() || null,
      focusKeyword: fields.focusKeyword.trim() || null,
      ogImageUrl: fields.ogImageUrl.trim() || null,
      coverAltText: fields.coverAltText.trim() || null,
      ogTitle: fields.ogTitle.trim() || null,
      ogDescription: fields.ogDescription.trim() || null,
      noindex,
    }
  }

  async function handleImage(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Use a JPG, PNG, WebP or GIF image no larger than 10 MB.')
      return
    }
    setUploadingImage(true); setError(null)
    try {
      const upload = await createBlogMediaUpload({ filename: file.name, mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', sizeBytes: file.size })
      const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
      if (!response.ok) throw new Error('The image upload did not complete.')
      setFields((current) => ({ ...current, coverUrl: upload.publicUrl, ogImageUrl: current.ogImageUrl || upload.publicUrl }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.')
    } finally { setUploadingImage(false) }
  }

  function handleLifecycle(data: { status: 'draft' | 'published' | 'archived' } | { status: 'scheduled'; scheduledAt: string }) {
    if (!initial) return
    startTransition(async () => {
      try { await onSave(buildPayload()); await setBlogLifecycle(initial.id, data); router.push('/dashboard/blog') }
      catch (lifecycleError) { setError(lifecycleError instanceof Error ? lifecycleError.message : 'Publishing state could not be changed.') }
    })
  }

  function handleSave() {
    if (!fields.title.trim()) { setError('Title is required'); return }
    if (!fields.slug.trim()) { setError('Slug is required'); return }
    setError(null)
    startTransition(async () => {
      try {
        await onSave(buildPayload())
        router.push('/dashboard/blog')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  function handlePublishToggle(publish: boolean) {
    if (!onPublishToggle) return
    startTransition(async () => {
      try {
        await onPublishToggle(publish)
        router.push('/dashboard/blog')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const isPublished = initial?.isPublished ?? false

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Core fields */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Post details</h2>

        <Field label="Title" required>
          <input className={inputCls} value={fields.title} onChange={set('title')} placeholder="How we build fast websites" />
        </Field>

        <Field label="Slug" required hint="URL: online2day.com/blog/your-slug — lowercase, hyphens only">
          <input className={`${inputCls} font-mono`} value={fields.slug} onChange={handleSlugChange} placeholder="how-we-build-fast-websites" />
        </Field>

        <Field label="Excerpt" hint="Shown in cards and meta description (1–2 sentences)">
          <textarea className={textareaCls} rows={2} value={fields.excerpt} onChange={set('excerpt')} placeholder="A brief summary of the article..." />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <input className={inputCls} value={fields.category} onChange={set('category')} placeholder="Web Development" />
          </Field>
          <Field label="Read time (minutes)">
            <input className={inputCls} type="number" min="1" value={fields.readTime} onChange={set('readTime')} placeholder="5" />
          </Field>
        </div>

        <Field label="Cover image" hint="Upload an image or provide a URL. 1200×630px is recommended.">
          <label className="mb-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40">
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {uploadingImage ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploadingImage} onChange={(event) => void handleImage(event.target.files?.[0])} />
          </label>
          <input className={inputCls} value={fields.coverUrl} onChange={set('coverUrl')} placeholder="https://..." />
        </Field>

        <Field label="Cover image alt text" hint="Describe the image's purpose, not its file name. Required before publishing when a cover is present.">
          <input className={inputCls} value={fields.coverAltText} onChange={set('coverAltText')} placeholder="Team reviewing a website performance dashboard" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author name">
            <input className={inputCls} value={fields.authorName} onChange={set('authorName')} />
          </Field>
          <Field label="Author role">
            <input className={inputCls} value={fields.authorRole} onChange={set('authorRole')} />
          </Field>
        </div>

        <Field label="Tags" hint="Comma-separated — e.g. SEO, Next.js, Web Dev">
          <input className={inputCls} value={fields.tags} onChange={set('tags')} placeholder="SEO, Web Development" />
        </Field>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1">Content</h2>
        <BlogEditor content={content} onChange={setContent} />
      </div>

      {/* SEO (collapsed by default) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSeo(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <span>SEO overrides <span className="text-muted-foreground font-normal">(optional)</span></span>
          {showSeo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showSeo && (
          <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
            <Field label="SEO title" hint="Overrides the browser tab title. Leave blank to use post title.">
              <input className={inputCls} value={fields.seoTitle} onChange={set('seoTitle')} placeholder={fields.title || 'Post title | online2day'} />
            </Field>
            <Field label="SEO description" hint="Overrides the meta description. Leave blank to use excerpt.">
              <textarea className={textareaCls} rows={2} value={fields.seoDesc} onChange={set('seoDesc')} placeholder={fields.excerpt || 'Short description for search engines...'} />
            </Field>
            <Field label="Focus keyword" hint="Used only for editorial guidance; it does not add obsolete keyword metadata.">
              <input className={inputCls} value={fields.focusKeyword} onChange={set('focusKeyword')} placeholder="website conversion optimisation" />
            </Field>
            <Field label="Canonical URL" hint="Optional absolute URL when this article is a duplicate or syndicated copy.">
              <input className={inputCls} type="url" value={fields.canonicalUrl} onChange={set('canonicalUrl')} placeholder="https://www.online2day.com/blog/..." />
            </Field>
            <Field label="Social image URL" hint="Defaults to the cover image after an upload.">
              <input className={inputCls} type="url" value={fields.ogImageUrl} onChange={set('ogImageUrl')} placeholder="https://..." />
            </Field>
            <Field label="Open Graph title" hint="Optional social-share headline. Defaults to the SEO title or post title.">
              <input className={inputCls} value={fields.ogTitle} onChange={set('ogTitle')} placeholder={fields.seoTitle || fields.title || 'Social headline'} />
            </Field>
            <Field label="Open Graph description" hint="Optional social-share summary. Defaults to the SEO description or excerpt.">
              <textarea className={textareaCls} rows={2} value={fields.ogDescription} onChange={set('ogDescription')} placeholder={fields.seoDesc || fields.excerpt || 'Social summary...'} />
            </Field>
            <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <input type="checkbox" checked={noindex} onChange={(event) => setNoindex(event.target.checked)} className="mt-1 h-4 w-4" />
              <span><strong>Exclude from search results</strong><span className="mt-0.5 block text-xs text-muted-foreground">Adds noindex to this public page and excludes it from the sitemap. Use only for intentionally private-to-search or duplicate content.</span></span>
            </label>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between"><strong className="text-sm">SEO readiness</strong><span className="text-sm font-bold text-primary">{seoScore}%</span></div>
              <ul className="space-y-1 text-xs text-muted-foreground">{seoChecks.map((check) => <li key={check.label} className={check.pass ? 'text-green-400' : ''}>{check.pass ? '✓' : '○'} {check.label}</li>)}</ul>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Save as draft' : 'Save changes'}
        </button>

        {mode === 'edit' && onPublishToggle && (
          <button
            type="button"
            onClick={() => handlePublishToggle(!isPublished)}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border font-semibold text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPublished ? 'Unpublish' : 'Publish post'}
          </button>
        )}

        {mode === 'edit' && initial ? (
          <>
            <div className="flex min-w-[260px] flex-1 items-center gap-2">
              <input className={inputCls} type="datetime-local" min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} aria-label="Scheduled publication time" />
              <button type="button" disabled={isPending || !scheduleAt} onClick={() => handleLifecycle({ status: 'scheduled', scheduledAt: new Date(scheduleAt).toISOString() })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-50"><CalendarClock className="h-4 w-4" /> Schedule</button>
            </div>
            <button type="button" disabled={isPending} onClick={() => handleLifecycle({ status: 'archived' })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"><Archive className="h-4 w-4" /> Archive</button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => router.push('/dashboard/blog')}
          className="px-5 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
