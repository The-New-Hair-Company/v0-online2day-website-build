'use server'

import { createClient } from '@/lib/supabase/server'
import { prefsApi, licensedUsersApi } from '@/lib/api/client'
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

type LicenseActionResult = { success?: boolean; error?: string; state?: LicenseManagementState }

const fallbackUsersKey = 'license.users'
const seatLimitKey = 'license.seatLimit'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

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

function parseFallbackUsers(value?: string): LicensedUser[] {
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

async function readPrefsViaApi(token: string, keys: string[]): Promise<Record<string, string>> {
  try {
    const items = await prefsApi.getMany(token, keys)
    const result: Record<string, string> = {}
    for (const item of items) result[item.key] = item.value
    return result
  } catch {
    return {}
  }
}

async function writePrefsViaApi(token: string, prefs: Record<string, string>): Promise<void> {
  try {
    await prefsApi.setMany(token, prefs)
  } catch { /* non-fatal */ }
}

async function loadLicenseState(token: string) {
  const prefs = await readPrefsViaApi(token, [fallbackUsersKey, seatLimitKey])
  const seatLimit = Math.max(Number(prefs[seatLimitKey]) || DEFAULT_LICENSE_SEAT_LIMIT, FOUNDING_ADMIN_EMAILS.length)

  // Ensure founding admins exist via API (fire-and-forget, non-fatal)
  await Promise.allSettled(
    FOUNDING_ADMIN_EMAILS.map((email) =>
      licensedUsersApi.add(token, {
        email,
        role: 'admin',
        fullName: fallbackFullName(email),
        seatType: 'admin',
      }),
    ),
  )

  try {
    const rows = await licensedUsersApi.list(token)
    const users = normalizeLicensedList(
      rows.map((r) => ({
        id: r.id,
        email: normalizeEmail(r.email),
        fullName: r.fullName || '',
        role: roleFromValue(r.role),
        status: statusFromValue(r.status),
        seatType: seatTypeFromValue(r.seatType),
        isProtected: isFoundingAdminEmail(r.email),
        source: 'database' as const,
        createdAt: r.createdAt || null,
        updatedAt: r.updatedAt || null,
        lastSeenAt: r.lastSeenAt || null,
      })),
      'database',
    )
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
  } catch {
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
}

async function saveFallbackUsers(token: string, users: LicensedUser[]) {
  await writePrefsViaApi(token, {
    [fallbackUsersKey]: JSON.stringify(normalizeLicensedList(users, 'fallback')),
  })
}

// ─── ADMIN PREFERENCES ───────────────────────────────────────────────────────

export async function getAdminPref(key: string): Promise<string | null> {
  try {
    const token = await getToken()
    const item = await prefsApi.get(token, key)
    return item?.value ?? null
  } catch {
    return null
  }
}

export async function getAdminPrefs(keys: string[]): Promise<Record<string, string>> {
  try {
    const token = await getToken()
    return await readPrefsViaApi(token, keys)
  } catch {
    return {}
  }
}

export async function setAdminPref(key: string, value: string) {
  try {
    const token = await getToken()
    await prefsApi.set(token, key, value)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function setAdminPrefs(prefs: Record<string, string>) {
  try {
    const token = await getToken()
    await prefsApi.setMany(token, prefs)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── LICENSE MANAGEMENT ───────────────────────────────────────────────────────

export async function getLicenseManagementState(): Promise<LicenseManagementState> {
  try {
    const token = await getToken()
    return (await loadLicenseState(token)).state
  } catch {
    return {
      users: [],
      seatLimit: DEFAULT_LICENSE_SEAT_LIMIT,
      activeSeatCount: 0,
      adminEmails: [...FOUNDING_ADMIN_EMAILS],
      canManage: false,
      warning: 'Only admins can manage licensed users.',
    }
  }
}

export async function addLicensedUser(input: { email: string; fullName?: string; role?: LicensedUserRole }): Promise<LicenseActionResult> {
  try {
    const token = await getToken()
    const email = normalizeEmail(input.email)
    if (!isValidLicenseEmail(email)) return { error: 'Enter a valid work email address.' }

    const requestedRole = roleFromValue(input.role)
    const role: LicensedUserRole = isFoundingAdminEmail(email) ? 'admin' : requestedRole
    const { state, usingFallback } = await loadLicenseState(token)

    const existing = state.users.find((u) => u.email === email)
    if (!existing && state.activeSeatCount >= state.seatLimit) {
      return { error: 'The license has no free seats. Increase the seat limit before adding another user.', state }
    }

    const nextUser: LicensedUser = {
      id: existing?.id || `license-${email}`,
      email,
      fullName: input.fullName?.trim() || existing?.fullName || fallbackFullName(email),
      role,
      status: 'active',
      seatType: seatTypeForRole(role),
      isProtected: isFoundingAdminEmail(email),
      source: usingFallback ? 'fallback' : 'database',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeenAt: existing?.lastSeenAt || null,
    }

    if (usingFallback) {
      await saveFallbackUsers(token, [...state.users.filter((u) => u.email !== email), nextUser])
      return { success: true, state: (await loadLicenseState(token)).state }
    }

    try {
      await licensedUsersApi.add(token, { email, role, fullName: nextUser.fullName, seatType: nextUser.seatType })
    } catch {
      await saveFallbackUsers(token, [...state.users.filter((u) => u.email !== email), nextUser])
      const nextState = (await loadLicenseState(token)).state
      return { success: true, state: nextState, error: 'Database write was unavailable, so this user was saved to admin preferences.' }
    }

    return { success: true, state: (await loadLicenseState(token)).state }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateLicensedUserRole(emailInput: string, roleInput: LicensedUserRole): Promise<LicenseActionResult> {
  try {
    const token = await getToken()
    const email = normalizeEmail(emailInput)
    if (isFoundingAdminEmail(email)) return { error: 'Protected admin accounts cannot be downgraded.' }

    const role = roleFromValue(roleInput)
    const { state, usingFallback } = await loadLicenseState(token)
    const current = state.users.find((u) => u.email === email)
    if (!current) return { error: 'That licensed user could not be found.', state }

    if (usingFallback) {
      await saveFallbackUsers(token, state.users.map((u) =>
        u.email === email ? { ...u, role, seatType: seatTypeForRole(role), updatedAt: new Date().toISOString() } : u
      ))
      return { success: true, state: (await loadLicenseState(token)).state }
    }

    await licensedUsersApi.updateRole(token, email, role)
    return { success: true, state: (await loadLicenseState(token)).state }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeLicensedUser(emailInput: string): Promise<LicenseActionResult> {
  try {
    const token = await getToken()
    const email = normalizeEmail(emailInput)
    if (isFoundingAdminEmail(email)) return { error: 'Protected admin accounts cannot be removed.' }

    const { state, usingFallback } = await loadLicenseState(token)
    if (!state.users.some((u) => u.email === email)) return { error: 'That licensed user could not be found.', state }

    if (usingFallback) {
      await saveFallbackUsers(token, state.users.filter((u) => u.email !== email))
      return { success: true, state: (await loadLicenseState(token)).state }
    }

    await licensedUsersApi.remove(token, email)
    return { success: true, state: (await loadLicenseState(token)).state }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
