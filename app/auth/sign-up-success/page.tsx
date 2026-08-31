'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Page() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function resend(event: FormEvent) {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const response = await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const result = await response.json().catch(() => ({})) as { error?: string }

    if (!response.ok) {
      setStatus('error')
      setMessage(result.error || 'The confirmation email could not be sent.')
      return
    }

    setStatus('sent')
    setMessage('If this account is awaiting confirmation, a new link has been sent.')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Confirm your email</CardTitle>
            <CardDescription>Open the confirmation link before signing in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Check your inbox and spam folder. Delivery can take a few minutes.
            </p>
            <form onSubmit={resend} className="space-y-3">
              <Label htmlFor="resend-email">Didn&apos;t receive it?</Label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {message && (
                <p className={`text-sm ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {message}
                </p>
              )}
              <Button type="submit" variant="outline" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Resend confirmation email'}
              </Button>
            </form>
            <Button className="w-full" asChild>
              <Link href="/auth/login">Return to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
