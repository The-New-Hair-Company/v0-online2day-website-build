export const FOUNDING_ADMIN_EMAILS = [
  'oliverjosephking@gmail.com',
  'info@online2day.com',
] as const

export const DEFAULT_LICENSE_SEAT_LIMIT = 25

export type LicensedUserRole = 'admin' | 'member' | 'viewer'
export type LicensedUserStatus = 'active' | 'pending' | 'suspended' | 'revoked'
export type LicenseSeatType = 'admin' | 'standard' | 'viewer'

export type LicensedUser = {
  id: string
  email: string
  fullName: string
  role: LicensedUserRole
  status: LicensedUserStatus
  seatType: LicenseSeatType
  isProtected: boolean
  source: 'database' | 'fallback' | 'policy'
  createdAt: string | null
  updatedAt: string | null
  lastSeenAt: string | null
}

export type LicenseManagementState = {
  users: LicensedUser[]
  seatLimit: number
  activeSeatCount: number
  adminEmails: string[]
  canManage: boolean
  warning: string | null
}

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase()
}

export function isFoundingAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email)
  return FOUNDING_ADMIN_EMAILS.includes(normalized as (typeof FOUNDING_ADMIN_EMAILS)[number])
}

export function isValidLicenseEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

export function seatTypeForRole(role: LicensedUserRole): LicenseSeatType {
  if (role === 'admin') return 'admin'
  if (role === 'viewer') return 'viewer'
  return 'standard'
}
