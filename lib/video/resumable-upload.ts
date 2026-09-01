'use client'

import * as tus from 'tus-js-client'
import { createClient } from '@/lib/supabase/client'

type UploadOptions = {
  file: File
  objectPath: string
  onProgress?: (percentage: number) => void
  signal?: AbortSignal
}

export async function uploadVideoResumable({ file, objectPath, onProgress, signal }: UploadOptions) {
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Your session has expired. Sign in again before uploading.')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Video storage is not configured.')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  if (!projectRef) throw new Error('Video storage project is invalid.')

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: 'lead-videos',
        objectName: objectPath,
        contentType: file.type,
        cacheControl: '3600',
      },
      onError: (uploadError) => reject(new Error(uploadError.message || 'The video upload failed.')),
      onProgress: (uploaded, total) => onProgress?.(total > 0 ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    })

    const abort = () => {
      void upload.abort(true)
      reject(new DOMException('Upload cancelled.', 'AbortError'))
    }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })

    void upload.findPreviousUploads()
      .then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(reject)
  })
}

export function safeVideoObjectName(fileName: string) {
  const cleaned = fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
  return cleaned.slice(-180) || 'video.webm'
}
