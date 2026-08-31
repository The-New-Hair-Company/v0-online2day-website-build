'use client'

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
import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const response = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const result = await response.json().catch(() => ({})) as { error?: string }

    if (!response.ok) {
      setStatus('error')
      setErrorMessage(result.error || 'The password reset email could not be sent.')
    } else {
      setStatus('success')
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we will send you a password reset link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status === 'success' ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-primary font-medium bg-primary/10 p-3 rounded-md border border-primary/20">
                    Check your email for the reset link!
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/auth/login">Return to Login</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {status === 'error' && <p className="text-sm text-destructive">{errorMessage}</p>}
                    <Button type="submit" className="w-full" disabled={status === 'loading'}>
                      {status === 'loading' ? 'Sending link...' : 'Send Reset Link'}
                    </Button>
                  </div>
                  <div className="mt-4 text-center text-sm">
                    Remember your password?{' '}
                    <Link
                      href="/auth/login"
                      className="underline underline-offset-4"
                    >
                      Login
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
