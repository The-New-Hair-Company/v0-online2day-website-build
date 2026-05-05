'use server'

import { createAdminClient } from '@/lib/supabase/admin-client'

// Consumer email domains that are not accepted for business trial signups
const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.ca', 'yahoo.com.au',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es',
  'outlook.com', 'outlook.fr', 'outlook.de',
  'live.com', 'live.co.uk', 'live.fr',
  'msn.com',
  'aol.com', 'aol.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'yandex.com', 'yandex.ru',
  'mail.com', 'inbox.com',
  'gmx.com', 'gmx.net', 'web.de',
  'qq.com', '163.com', '126.com',
  'btinternet.com', 'sky.com', 'virginmedia.com',
  'ntlworld.com', 'talktalk.net', 'blueyonder.co.uk',
  'tiscali.co.uk', 'o2.co.uk', 'orange.net',
])

export function isBusinessEmail(email: string): boolean {
  const parts = email.toLowerCase().trim().split('@')
  if (parts.length !== 2 || !parts[1]) return false
  return !CONSUMER_DOMAINS.has(parts[1])
}

export type TrialSignupInput = {
  firstName: string
  lastName: string
  email: string
  companyName: string
  jobTitle?: string
  phone?: string
  password: string
  plan?: string
}

export type TrialSignupResult =
  | { success: true; message: string }
  | { success: false; error: string; field?: string }

export async function startTrialAccount(input: TrialSignupInput): Promise<TrialSignupResult> {
  const { firstName, lastName, email, companyName, jobTitle, phone, password, plan = 'Pro' } = input

  const cleanEmail = email.trim().toLowerCase()
  const cleanFirst = firstName.trim()
  const cleanLast = lastName.trim()
  const cleanCompany = companyName.trim()

  // Server-side validation
  if (!cleanFirst) return { success: false, error: 'First name is required.', field: 'firstName' }
  if (!cleanLast) return { success: false, error: 'Last name is required.', field: 'lastName' }
  if (!cleanEmail) return { success: false, error: 'Email address is required.', field: 'email' }
  if (!cleanCompany) return { success: false, error: 'Company name is required.', field: 'companyName' }
  if (!password) return { success: false, error: 'Password is required.', field: 'password' }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.', field: 'email' }
  }

  if (!isBusinessEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Personal email addresses (Gmail, Yahoo, Outlook, etc.) are not accepted. Please sign up with your business email address.',
      field: 'email',
    }
  }

  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.', field: 'password' }
  }

  const adminClient = createAdminClient()

  // Check if email already registered (licensed_users)
  const { data: existing } = await adminClient
    .from('licensed_users')
    .select('email, status')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: 'An account with this email already exists. Please log in or contact us if you need help.',
      field: 'email',
    }
  }

  // Create the Supabase auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: false, // user must verify email before logging in
    user_metadata: {
      first_name: cleanFirst,
      last_name: cleanLast,
      company_name: cleanCompany,
      job_title: jobTitle?.trim() || null,
      phone: phone?.trim() || null,
    },
  })

  if (authError || !authData.user) {
    if (authError?.message?.toLowerCase().includes('already registered') || authError?.message?.toLowerCase().includes('already been registered')) {
      return {
        success: false,
        error: 'An account with this email already exists. Please log in or contact us if you need help.',
        field: 'email',
      }
    }
    return {
      success: false,
      error: authError?.message || 'Failed to create account. Please try again or contact support.',
    }
  }

  const userId = authData.user.id
  const fullName = `${cleanFirst} ${cleanLast}`
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // Create trial account record
  const { error: trialError } = await adminClient.from('trial_accounts').insert({
    user_id: userId,
    email: cleanEmail,
    first_name: cleanFirst,
    last_name: cleanLast,
    company_name: cleanCompany,
    job_title: jobTitle?.trim() || null,
    phone: phone?.trim() || null,
    plan,
    trial_end: trialEnd,
  })

  if (trialError) {
    // Clean up the auth user so they can try again
    await adminClient.auth.admin.deleteUser(userId).catch(() => {})
    return {
      success: false,
      error: 'Failed to set up your trial. Please try again or contact support.',
    }
  }

  // Add to licensed_users so the login flow allows them in after email confirmation
  await adminClient.from('licensed_users').insert({
    email: cleanEmail,
    full_name: fullName,
    role: 'member',
    status: 'active',
    seat_type: 'standard',
  }).then(() => {}) // non-fatal — admin can add manually if this fails

  return {
    success: true,
    message: 'Account created! Check your inbox to confirm your email address. Your 14-day free trial starts as soon as you verify.',
  }
}
