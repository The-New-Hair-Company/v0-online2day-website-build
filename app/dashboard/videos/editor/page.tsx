import { getEmailComposerData } from '@/app/actions/dashboard'
import { VideoEditorClient } from './video-editor-client'

export const metadata = {
  title: 'Video Editor | Online2Day CRM',
  description: 'Enterprise personalised video editor for CRM and email campaigns.',
}

export default async function VideoEditorPage() {
  const data = await getEmailComposerData()
  return <VideoEditorClient leads={data.leads} videos={data.videos} />
}
