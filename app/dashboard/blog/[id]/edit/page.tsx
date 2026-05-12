import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BlogPostForm } from '@/components/blog/blog-post-form'
import { getBlogPost, updateBlogPost, togglePublish } from '@/app/actions/blog'

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getBlogPost(id).catch(() => null)
  if (!post) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard/blog"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit post</h1>
            <p className="text-sm text-muted-foreground">
              {post.isPublished
                ? 'This post is live — changes save immediately.'
                : 'Draft — publish when ready.'}
            </p>
          </div>
        </div>

        <BlogPostForm
          initial={post}
          mode="edit"
          onSave={data => updateBlogPost(id, data)}
          onPublishToggle={publish => togglePublish(id, publish)}
        />
      </div>
    </div>
  )
}
