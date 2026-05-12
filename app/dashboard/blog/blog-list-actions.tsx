'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { togglePublish, deleteBlogPost } from '@/app/actions/blog'
import type { BlogPostDto } from '@/lib/api/client'
import { Edit2, Trash2, Globe, EyeOff, ExternalLink } from 'lucide-react'

export function BlogListActions({ post }: { post: BlogPostDto }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleTogglePublish() {
    startTransition(async () => {
      await togglePublish(post.id, !post.isPublished)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      await deleteBlogPost(post.id)
      router.refresh()
      setConfirming(false)
    })
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {post.isPublished && (
        <a
          href={`/blog/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="View live post"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}

      <Link
        href={`/dashboard/blog/${post.id}/edit`}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Edit post"
      >
        <Edit2 className="h-4 w-4" />
      </Link>

      <button
        onClick={handleTogglePublish}
        disabled={isPending}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        title={post.isPublished ? 'Unpublish' : 'Publish'}
      >
        {post.isPublished ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
      </button>

      <button
        onClick={handleDelete}
        disabled={isPending}
        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
          confirming
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'text-muted-foreground hover:text-red-400 hover:bg-muted'
        }`}
        title={confirming ? 'Click again to confirm delete' : 'Delete post'}
        onBlur={() => setConfirming(false)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
