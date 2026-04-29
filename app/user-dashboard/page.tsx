import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatWindow } from '@/components/chat/ChatWindow'

export const metadata = {
  title: 'User Dashboard | Online2Day',
  description: 'Your personal support portal',
}

export default async function UserDashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Support Chat</h1>
        <p className="text-muted-foreground mt-2">
          Need help? Have questions? Chat directly with our team here.
        </p>
      </div>
      
      <div className="flex-1 min-h-[500px]">
        <ChatWindow 
          currentUserId={data.user.id} 
          conversationUserId={data.user.id} 
          isAdmin={false} 
        />
      </div>
    </div>
  )
}
