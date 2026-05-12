import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BlogPostForm } from '@/components/blog/blog-post-form'
import { createBlogPost } from '@/app/actions/blog'

export default function NewBlogPostPage() {
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
            <h1 className="text-2xl font-bold">New blog post</h1>
            <p className="text-sm text-muted-foreground">Posts are saved as drafts until you publish them.</p>
          </div>
        </div>

        <BlogPostForm
          mode="create"
          onSave={async data => { await createBlogPost(data) }}
        />
      </div>
    </div>
  )
}
