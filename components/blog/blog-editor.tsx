'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Youtube from '@tiptap/extension-youtube'
import { createBlogMediaUpload } from '@/app/actions/blog'
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading2, Heading3, List, ListOrdered,
  Quote, Code, Link2, AlignLeft, AlignCenter, Minus, ImagePlus,
  Table2, Rows3, Columns3, Trash2, YoutubeIcon, Loader2, Megaphone,
} from 'lucide-react'

function ToolbarButton({
  onClick, active = false, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 self-center" />
}

interface BlogEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function BlogEditor({ content, onChange, placeholder = 'Start writing your article...' }: BlogEditorProps) {
  const imageInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline underline-offset-2' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: 'cms-image' } }),
      Table.configure({ resizable: false, HTMLAttributes: { class: 'cms-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: 'cms-video' } }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose-content min-h-[400px] outline-none px-6 py-5 focus:outline-none',
      },
    },
  })

  if (!editor) return null

  function setLink() {
    const prev = editor!.getAttributes('link').href ?? ''
    const url = window.prompt('URL', prev)
    if (url === null) return
    if (url === '') { editor!.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Use a JPG, PNG, WebP or GIF no larger than 10 MB.')
      return
    }
    const alt = window.prompt('Describe this image for screen readers and search engines:')?.trim()
    if (!alt) {
      setError('Alt text is required for content images.')
      return
    }
    const caption = window.prompt('Optional visible caption:')?.trim()
    setUploading(true)
    setError(null)
    try {
      const upload = await createBlogMediaUpload({
        filename: file.name,
        mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        sizeBytes: file.size,
      })
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      })
      if (!response.ok) throw new Error('The image upload did not complete.')
      editor.chain().focus().setImage({ src: upload.publicUrl, alt, title: caption || alt }).run()
      if (caption) editor.chain().focus().insertContent(`<p><em>${caption.replace(/[<>&]/g, '')}</em></p>`).run()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.')
    } finally {
      setUploading(false)
      if (imageInput.current) imageInput.current.value = ''
    }
  }

  function addVideo() {
    const url = window.prompt('YouTube URL')?.trim()
    if (!url) return
    if (!/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) {
      setError('Use a valid YouTube URL.')
      return
    }
    setError(null)
    editor.chain().focus().setYoutubeVideo({ src: url, width: 960, height: 540 }).run()
  }

  function addCta() {
    const label = window.prompt('Call-to-action label')?.trim()
    if (!label) return
    const href = window.prompt('Destination URL')?.trim()
    if (!href || !/^https?:\/\//i.test(href)) {
      setError('Use a complete https:// destination URL.')
      return
    }
    const safeLabel = label.replace(/[<>&]/g, '')
    const safeHref = href.replace(/["<>]/g, '')
    editor.chain().focus().insertContent(`<p><strong><a href="${safeHref}">${safeLabel}</a></strong></p>`).run()
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/40">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insert link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => imageInput.current?.click()} title="Upload an image with alt text and caption">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </ToolbarButton>
        <ToolbarButton onClick={addVideo} title="Embed a privacy-enhanced YouTube video">
          <YoutubeIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert 3 × 3 table">
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive('table') && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add table row"><Rows3 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add table column"><Columns3 className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table"><Trash2 className="h-4 w-4" /></ToolbarButton>
          </>
        )}
        <ToolbarButton onClick={addCta} title="Insert call-to-action link"><Megaphone className="h-4 w-4" /></ToolbarButton>
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(event) => void uploadImage(event.target.files?.[0])} />
      </div>

      {error && <p role="alert" className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</p>}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        placeholder={placeholder}
        className="min-h-[400px]"
      />
    </div>
  )
}
