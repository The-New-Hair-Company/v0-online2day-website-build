import { getClientUsers } from '@/lib/actions/video-actions'
import VideoUploadClient from './upload-client'

export const metadata = {
  title: 'Upload Video | Online2Day CRM',
}

export default async function VideoUploadPage() {
  const clientUsers = await getClientUsers()

  return <VideoUploadClient clientUsers={clientUsers} />
}
