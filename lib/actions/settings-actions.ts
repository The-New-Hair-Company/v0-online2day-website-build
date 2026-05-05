'use server'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_LICENSE_SEAT_LIMIT,
  FOUNDING_ADMIN_EMAILS,
  type LicensedUser,
  type LicensedUserRole,
  type LicensedUserStatus,
  type LicenseManagementState,
  type LicenseSeatType,
  isFoundingAdminEmail,
  isValidLicenseEmail,
  normalizeEmail,
  seatTypeForRole,
} from '@/lib/license'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type LicenseActionResult = { success?: boolean; error?: string; state?: LicenseManagementState }
type LicensedUserRow = {
  id: string | null
  email: string | null
  full_name: string | null
  role: string | null
  status: string | null
  seat_type: string | null
  created_at: string | null
  updated_at: string | null
  last_seen_at: string | null
}

const fallbackUsersKey = 'license.users'
const seatLimitKey = 'license.seatLimit'

function roleFromValue(value?: string | null): LicensedUserRole {
  if (value === 'admin' || value === 'viewer') return value
  return 'member'
}

function statusFromValue(value?: string | null): LicensedUserStatus {
  if (value === 'pending' || value === 'suspended' || value === 'revoked') return value
  return 'active'
}

function seatTypeFromValue(value?: string | null): LicenseSeatType {
  if (value === 'admin' || value === 'viewer') return value
  return 'standard'
}

function fallbackFullName(email: string) {
  if (email === 'oliverjosephking@gmail.com') return 'Oliver Joseph King'
  if (email === 'info@online2day.com') return 'Online2Day Admin'
  return ''
}

function mapLicensedRow(row: LicensedUserRow): LicensedUser {
  const email = normalizeEmail(row.email)
  const role = roleFromValue(row.role)
  return {
    id: row.id || `license-${email}`,
    email,
    fullName: row.full_name || fallbackFullName(email),
    role,
    status: statusFromValue(row.status),
    seatType: seatTypeFromValue(row.seat_type) || seatTypeForRole(role),
    isProtected: isFoundingAdminEmail(email),
    source: 'database',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  }
}

function normalizeLicensedList(users: LicensedUser[], source: LicensedUser['source'] = 'policy') {
  const byEmail = new Map<string, LicensedUser>()

  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (!email || user.status === 'revoked') continue
    const role = isFoundingAdminEmail(email) ? 'admin' : roleFromValue(user.role)
    byEmail.set(email, {
      ...user,
      id: user.id || `${source}-${email}`,
      email,
      fullName: user.fullName || fallbackFullName(email),
      role,
      status: isFoundingAdminEmail(email) ? 'active' : statusFromValue(user.status),
      seatType: isFoundingAdminEmail(email) ? 'admin' : seatTypeForRole(role),
      isProtected: isFoundingAdminEmail(email),
      source: user.source || source,
    })
  }

  for (const email of FOUNDING_ADMIN_EMAILS) {
    const existing = byEmail.get(email)
    byEmail.set(email, {
      id: existing?.id || `policy-${email}`,
      email,
      fullName: existing?.fullName || fallbackFullName(email),
      role: 'admin',
      status: 'active',
      seatType: 'admin',
      isProtected: true,
      source: existing?.source || source,
      createdAt: existing?.createdAt || null,
      updatedAt: existing?.updatedAt || null,
      lastSeenAt: existing?.lastSeenAt || null,
    })
  }

  return [...byEmail.values()].sort((a, b) => {
    if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return a.email.localeCompare(b.email)
  })
}

function activeSeatCount(users: LicensedUser[]) {
  return users.filter((user) => user.status === 'active' || user.status === 'pending').length
}

function parseFallbackUsers(value?: string) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as Partial<LicensedUser>[]
    return parsed.map((user) => ({
      id: user.id || `fallback-${normalizeEmail(user.email)}`,
      email: normalizeEmail(user.email),
      fullName: user.fullName || fallbackFullName(normalizeEmail(user.email)),
      role: roleFromValue(user.role),
      status: statusFromValue(user.status),
      seatType: seatTypeFromValue(user.seatType),
      isProtected: isFoundingAdminEmail(user.email),
      source: 'fallback' as const,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null,
      lastSeenAt: user.lastSeenAt || null,
    }))
  } catch {
    return []
  }
}

async function readAdminPrefs(supabase: SupabaseServerClient, userId: string, keys: string[]) {
  const { data } = await supabase
    .from('admin_preferences')
    .select('key, value')
    .eq('user_id', userId)
    .in('key', keys)

  const result: Record<string, string> = {}
  for (const row of data || []) result[row.key] = row.value
  return result
}

async function writeAdminPrefs(supabase: SupabaseServerClient, userId: string, prefs: Record<string, string>) {
  const rows = Object.entries(prefs).map(([key, value]) => ({
    user_id: userId,
    key,
    value,
    updated_at: new Date().toISOString(),
  }))
  await supabase.from('admin_preferences').upsert(rows, { onConflict: 'user_id,key' })
}

async function getAdminContext(supabase: SupabaseServerClient) {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { user: null, isAdmin: false }

  const email = normalizeEmail(user.email)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (isFoundingAdminEmail(email) || profile?.role === 'admin') {
    return { user, isAdmin: true }
  }

  const { data: license } = await supabase
    .from('licensed_users')
    .select('role, status')
    .eq('email', email)
    .single()

  return { user, isAdmin: license?.role === 'admin' && license?.status === 'active' }
}

async function syncProfileRole(supabase: SupabaseServerClient, email: string, role: LicensedUserRole) {
  await supabase
    .from('user_profiles')
    .update({ role: role === 'admin' ? 'admin' : 'user' })
    .ilike('email', email)
}

async function loadLicenseState(supabase: SupabaseServerClient, adminUserId: string) {
  const prefs = await readAdminPrefs(supabase, adminUserId, [fallbackUsersKey, seatLimitKey])
  const seatLimit = Math.max(Number(prefs[seatLimitKey]) || DEFAULT_LICENSE_SEAT_LIMIT, FOUNDING_ADMIN_EMAILS.length)
  const now = new Date().toISOString()

  await supabase
    .from('licensed_users')
    .upsert(
      FOUNDING_ADMIN_EMAILS.map((email) => ({
        email,
        full_name: fallbackFullName(email),
        role: 'admin',
        status: 'active',
        seat_type: 'admin',
        updated_at: now,
      })),
      { onConflict: 'email' },
    )

  const { data, error } = await supabase
    .from('licensed_users')
    .select('id, email, full_name, role, status, seat_type, created_at, updated_at, last_seen_at')
    .neq('status', 'revoked')
    .order('email', { ascending: true })

  if (error) {
    const users = normalizeLicensedList(parseFallbackUsers(prefs[fallbackUsersKey]), 'fallback')
    return {
      state: {
        users,
        seatLimit,
        activeSeatCount: activeSeatCount(users),
        adminEmails: [...FOUNDING_ADMIN_EMAILS],
        canManage: true,
        warning: 'License users are being stored in admin preferences until the licensed_users database migration is applied.',
      },
      usingFallback: true,
    }
  }

  const users = normalizeLicensedList(((data || []) as LicensedUserRow[]).map(mapLicensedRow), 'database')
  return {
    state: {
      users,
      seatLimit,
      activeSeatCount: activeSeatCount(users),
      adminEmails: [...FOUNDING_ADMIN_EMAILS],
      canManage: true,
      warning: null,
    },
    usingFallback: false,
  }
}

async function saveFallbackUsers(supabase: SupabaseServerClient, adminUserId: string, users: LicensedUser[]) {
  await writeAdminPrefs(supabase, adminUserId, {
    [fallbackUsersKey]: JSON.stringify(normalizeLicensedList(users, 'fallback')),
  })
}

export async function getAdminPref(key: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null

  const { data } = await supabase
    .from('admin_preferences')
    .select('value')
    .eq('user_id', userData.user.id)
    .eq('key', key)
    .single()
  return data?.value ?? null
}

export async function getAdminPrefs(keys: string[]): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return {}

  const { data } = await supabase
    .from('admin_preferences')
    .select('key, value')
    .eq('user_id', userData.user.id)
    .in('key', keys)

  const result: Record<string, string> = {}
  for (const row of data || []) {
    result[row.key] = row.value
  }
  return result
}

export async function setAdminPref(key: string, value: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('admin_preferences')
    .upsert(
      { user_id: userData.user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )
  if (error) return { error: error.message }
  return { success: true }
}

export async function setAdminPrefs(prefs: Record<string, string>) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const rows = Object.entries(prefs).map(([key, value]) => ({
    user_id: userData.user!.id,
    key,
    value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('admin_preferences')
    .upsert(rows, { onConflict: 'user_id,key' })
  if (error) return { error: error.message }
  return { success: true }
}

export async function getLicenseManagementState(): Promise<LicenseManagementState> {
  const supabase = await createClient()
  const context = await getAdminContext(supabase)
  if (!context.user || !context.isAdmin) {
    return {
      users: [],
      seatLimit: DEFAULT_LICENSE_SEAT_LIMIT,
      activeSeatCount: 0,
      adminEmails: [...FOUNDING_ADMIN_EMAILS],
      canManage: false,
      warning: 'Only admins can manage licensed users.',
    }
  }

  return (await loadLicenseState(supabase, context.user.id)).state
}

export async function addLicensedUser(input: { email: string; fullName?: string; role?: LicensedUserRole }): Promise<LicenseActionResult> {
  const supabase = await createClient()
  const context = await getAdminContext(supabase)
  if (!context.user || !context.isAdmin) return { error: 'Only admins can add licensed users.' }

  const email = normalizeEmail(input.email)
  if (!isValidLicenseEmail(email)) return { error: 'Enter a valid work email address.' }

  const requestedRole = roleFromValue(input.role)
  const role: LicensedUserRole = isFoundingAdminEmail(email) ? 'admin' : requestedRole
  const { state, usingFallback } = await loadLicenseState(supabase, context.user.id)
  const existing = state.users.find((user) => user.email === email)
  if (!existing && state.activeSeatCount >= state.seatLimit) {
    return { error: 'The license has no free seats. Increase the seat limit before adding another user.', state }
  }

  const now = new Date().toISOString()
  const nextUser: LicensedUser = {
    id: existing?.id || `license-${email}`,
    email,
    fullName: input.fullName?.trim() || existing?.fullName || fallbackFullName(email),
    role,
    status: 'active',
    seatType: seatTypeForRole(role),
    isProtected: isFoundingAdminEmail(email),
    source: usingFallback ? 'fallback' : 'database',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastSeenAt: existing?.lastSeenAt || null,
  }

  if (usingFallback) {
    await saveFallbackUsers(supabase, context.user.id, [...state.users.filter((user) => user.email !== email), nextUser])
    const nextState = (await loadLicenseState(supabase, context.user.id)).state
    return { success: true, state: nextState }
  }

  const { error } = await supabase
    .from('licensed_users')
    .upsert(
      {
        email,
        full_name: nextUser.fullName,
        role: nextUser.role,
        status: nextUser.status,
        seat_type: nextUser.seatType,
        invited_by: context.user.id,
        updated_at: now,
      },
      { onConflict: 'email' },
    )

  if (error) {
    await saveFallbackUsers(supabase, context.user.id, [...state.users.filter((user) => user.email !== email), nextUser])
    const nextState = (await loadLicenseState(supabase, context.user.id)).state
    return { success: true, state: nextState, error: 'Database write was unavailable, so this user was saved to admin preferences.' }
  }

  await syncProfileRole(supabase, email, role)
  return { success: true, state: (await loadLicenseState(supabase, context.user.id)).state }
}

export async function updateLicensedUserRole(emailInput: string, roleInput: LicensedUserRole): Promise<LicenseActionResult> {
  const supabase = await createClient()
  const context = await getAdminContext(supabase)
  if (!context.user || !context.isAdmin) return { error: 'Only admins can update licensed users.' }

  const email = normalizeEmail(emailInput)
  if (isFoundingAdminEmail(email)) return { error: 'Protected admin accounts cannot be downgraded.' }

  const role = roleFromValue(roleInput)
  const { state, usingFallback } = await loadLicenseState(supabase, context.user.id)
  const current = state.users.find((user) => user.email === email)
  if (!current) return { error: 'That licensed user could not be found.', state }

  if (usingFallback) {
    await saveFallbackUsers(supabase, context.user.id, state.users.map((user) => (
      user.email === email ? { ...user, role, seatType: seatTypeForRole(role), updatedAt: new Date().toISOString() } : user
    )))
    return { success: true, state: (await loadLicenseState(supabase, context.user.id)).state }
  }

  const { error } = await supabase
    .from('licensed_users')
    .update({ role, seat_type: seatTypeForRole(role), updated_at: new Date().toISOString() })
    .eq('email', email)

  if (error) return { error: error.message, state }

  await syncProfileRole(supabase, email, role)
  return { success: true, state: (await loadLicenseState(supabase, context.user.id)).state }
}

export async function removeLicensedUser(emailInput: string): Promise<LicenseActionResult> {
  const supabase = await createClient()
  const context = await getAdminContext(supabase)
  if (!context.user || !context.isAdmin) return { error: 'Only admins can remove licensed users.' }

  const email = normalizeEmail(emailInput)
  if (isFoundingAdminEmail(email)) return { error: 'Protected admin accounts cannot be removed.' }

  const { state, usingFallback } = await loadLicenseState(supabase, context.user.id)
  if (!state.users.some((user) => user.email === email)) return { error: 'That licensed user could not be found.', state }

  if (usingFallback) {
    await saveFallbackUsers(supabase, context.user.id, state.users.filter((user) => user.email !== email))
    return { success: true, state: (await loadLicenseState(supabase, context.user.id)).state }
  }

  const { error } = await supabase
    .from('licensed_users')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('email', email)

  if (error) return { error: error.message, state }

  await syncProfileRole(supabase, email, 'member')
  return { success: true, state: (await loadLicenseState(supabase, context.user.id)).state }
}
