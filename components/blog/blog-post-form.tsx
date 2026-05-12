'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BlogEditor } from './blog-editor'
import type { BlogPostDto, BlogPostWriteDto } from '@/lib/api/client'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

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
  })
  const [content, setContent] = useState(initial?.content ?? '')

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
    }
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <input className={inputCls} value={fields.category} onChange={set('category')} placeholder="Web Development" />
          </Field>
          <Field label="Read time (minutes)">
            <input className={inputCls} type="number" min="1" value={fields.readTime} onChange={set('readTime')} placeholder="5" />
          </Field>
        </div>

        <Field label="Cover image URL" hint="Shown as hero on the post page and OG image (1200×630px recommended)">
          <input className={inputCls} value={fields.coverUrl} onChange={set('coverUrl')} placeholder="https://..." />
        </Field>

        <div className="grid grid-cols-2 gap-4">
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
