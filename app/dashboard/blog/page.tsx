import Link from 'next/link'
import { listAllBlogPosts } from '@/app/actions/blog'
import { BlogListActions } from './blog-list-actions'
import { Plus, FileText, Eye, EyeOff, Calendar } from 'lucide-react'

export default async function AdminBlogPage() {
  const posts = await listAllBlogPosts().catch(() => [])

  const published = posts.filter(p => p.isPublished).length
  const drafts = posts.filter(p => !p.isPublished).length

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Blog Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {published} published · {drafts} draft{drafts !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          New post
        </Link>
      </div>

      {/* Posts table */}
      {posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg mb-1">No posts yet</p>
          <p className="text-muted-foreground text-sm mb-6">Create your first blog post to get started.</p>
          <Link
            href="/dashboard/blog/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Write first post
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {posts.map(post => (
              <div key={post.id} className="flex items-start gap-4 p-4 bg-card hover:bg-muted/30 transition-colors">
                {/* Status dot */}
                <div className="mt-1 flex-shrink-0">
                  {post.isPublished
                    ? <Eye className="h-4 w-4 text-green-400" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />
                  }
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{post.title}</span>
                    {post.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                        {post.category}
                      </span>
                    )}
                    {!post.isPublished && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border flex-shrink-0">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono truncate">/{post.slug}</span>
                    {post.publishedAt && (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.publishedAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    )}
                    {post.readTime && <span className="flex-shrink-0">{post.readTime} min read</span>}
                  </div>
                </div>

                {/* Actions (client component — handles publish toggle + delete) */}
                <BlogListActions post={post} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
