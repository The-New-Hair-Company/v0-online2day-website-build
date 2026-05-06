'use client'

import { useState } from 'react'
import { Check, Loader2, User, Mail, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  authEmail: string
  initialName: string
  initialEmail: string
  role: string
}

export default function ProfileClient({ userId, authEmail, initialName, initialEmail, role }: Props) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const initials = (name || authEmail).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, full_name: name.trim(), email: initialEmail },
        { onConflict: 'user_id' },
      )

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account details.</p>
      </div>

      {/* Avatar + role */}
      <div className="flex items-center gap-5 mb-8 p-5 bg-card border border-border rounded-xl">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-bold shrink-0">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-lg">{name || authEmail}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {role === 'admin' ? (
              <ShieldCheck size={14} className="text-primary" />
            ) : (
              <User size={14} className="text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground capitalize">{role}</span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-base mb-1">Personal information</h2>

        <div>
          <label className="block text-sm font-medium mb-1.5">Full name</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full pl-9 pr-4 py-2.5 border border-border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={authEmail}
              disabled
              className="w-full pl-9 pr-4 py-2.5 border border-border bg-muted rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Email is managed through your account and cannot be changed here.</p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saved ? (
            <Check size={16} />
          ) : null}
          {saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
