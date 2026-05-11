const API_BASE = process.env.DOTNET_API_URL ?? 'https://online2dayapi.fly.dev'

// ── Shared fetch helper ───────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: 'no-store',
  })

  const body: ApiResponse<T> = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `API error ${res.status}`)
  }
  return body.data as T
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface LeadDto {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  website?: string | null
  status: string
  source?: string | null
  notes?: string | null
  assignedTo?: string | null
  followUpDate?: string | null
  lastContactedAt?: string | null
  closedAt?: string | null
  score?: number | null
  engagement?: number | null
  value?: number | null
  role?: string | null
  linkedInUrl?: string | null
  nextAction?: string | null
  lostReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadAssetDto {
  id: string
  leadId: string
  name: string
  type: string
  url?: string | null
  storagePath?: string | null
  publicUrl?: string | null
  slug?: string | null
  viewCount: number
  createdAt: string
  updatedAt?: string | null
}

export interface LeadTaskDto {
  id: string
  leadId: string
  title: string
  description?: string | null
  dueDate?: string | null
  assignedTo?: string | null
  completedAt?: string | null
  isCompleted: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface LeadAgreementDto {
  id: string
  leadId: string
  name: string
  storagePath: string
  signedAt?: string | null
  isSignedByClient: boolean
  createdAt: string
}

export interface ActivityFeedDto {
  id: string
  actorName: string
  type: string
  entityType?: string | null
  entityId?: string | null
  entityName?: string | null
  description?: string | null
  createdAt: string
}

export interface EnterpriseEventDto {
  id: string
  title: string
  eventTime: string
  eventType: string
  createdAt: string
}

export interface EnterpriseTaskDto {
  id: string
  title: string
  isDone: boolean
  completedAt?: string | null
  createdAt: string
}

export interface EnterpriseStateDto {
  id: string
  key: string
  value: string
  createdAt: string
  updatedAt?: string | null
}

export interface AdminPreferenceDto {
  key: string
  value: string
}

export interface AuditLogDto {
  id: string
  userId?: string | null
  actorEmail?: string | null
  action: string
  resource: string
  resourceId?: string | null
  changes?: string | null
  createdAt: string
}

export interface SiteBuildRequestDto {
  id: string
  clientName: string
  clientEmail: string
  businessName?: string | null
  notes?: string | null
  status: string
  stagingUrl?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface ReportSnapshotDto {
  id: string
  type: string
  data: string
  capturedBy?: string | null
  createdAt: string
}

export interface BulkImportResultDto {
  importedCount: number
  skippedCount: number
  importId: string
}

// ── Leads API ─────────────────────────────────────────────────────────────────

export const leadsApi = {
  list(token: string, search?: string, status?: string): Promise<LeadDto[]> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const qs = params.toString()
    return apiFetch<LeadDto[]>(`/api/v1/leads${qs ? `?${qs}` : ''}`, token)
  },

  get(token: string, id: string): Promise<LeadDto> {
    return apiFetch<LeadDto>(`/api/v1/leads/${id}`, token)
  },

  create(token: string, data: {
    name: string
    email?: string | null
    phone?: string | null
    company?: string | null
    website?: string | null
    source?: string | null
    notes?: string | null
    role?: string | null
    linkedInUrl?: string | null
    value?: number | null
    status?: string
    assignedTo?: string | null
  }): Promise<LeadDto> {
    return apiFetch<LeadDto>('/api/v1/leads', token, { method: 'POST', body: JSON.stringify(data) })
  },

  update(token: string, id: string, data: {
    name: string
    email?: string | null
    phone?: string | null
    company?: string | null
    website?: string | null
    source?: string | null
    notes?: string | null
    role?: string | null
    linkedInUrl?: string | null
    followUpDate?: string | null
    value?: number | null
    nextAction?: string | null
    assignedTo?: string | null
  }): Promise<LeadDto> {
    return apiFetch<LeadDto>(`/api/v1/leads/${id}`, token, { method: 'PUT', body: JSON.stringify(data) })
  },

  updateStatus(token: string, id: string, status: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
  },

  addNote(token: string, id: string, note: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}/notes`, token, { method: 'POST', body: JSON.stringify({ note }) })
  },

  delete(token: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}`, token, { method: 'DELETE' })
  },

  logEvent(token: string, leadId: string, type: string, note?: string, metadata?: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${leadId}/events`, token, {
      method: 'POST',
      body: JSON.stringify({ type, note: note ?? null, metadata: metadata ?? null }),
    })
  },

  bulkImport(token: string, data: {
    leads: Array<{
      name: string
      company?: string | null
      email?: string | null
      phone?: string | null
      role?: string | null
      linkedInUrl?: string | null
      source?: string | null
      notes?: string | null
      value?: number | null
    }>
    filename?: string | null
    stage?: string | null
  }): Promise<BulkImportResultDto> {
    return apiFetch<BulkImportResultDto>('/api/v1/imports/leads', token, { method: 'POST', body: JSON.stringify(data) })
  },
}

// ── Lead Assets API ───────────────────────────────────────────────────────────

export const assetsApi = {
  list(token: string, leadId: string): Promise<LeadAssetDto[]> {
    return apiFetch<LeadAssetDto[]>(`/api/v1/leads/${leadId}/assets`, token)
  },

  create(token: string, leadId: string, data: {
    name: string
    type: string
    url?: string | null
    storagePath?: string | null
    publicUrl?: string | null
    slug?: string | null
  }): Promise<LeadAssetDto> {
    return apiFetch<LeadAssetDto>(`/api/v1/leads/${leadId}/assets`, token, { method: 'POST', body: JSON.stringify(data) })
  },

  delete(token: string, leadId: string, assetId: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${leadId}/assets/${assetId}`, token, { method: 'DELETE' })
  },

  recordView(token: string, leadId: string, assetId: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${leadId}/assets/${assetId}/view`, token, { method: 'POST' })
  },
}

// ── Lead Tasks API ────────────────────────────────────────────────────────────

export const tasksApi = {
  list(token: string, leadId: string): Promise<LeadTaskDto[]> {
    return apiFetch<LeadTaskDto[]>(`/api/v1/leads/${leadId}/tasks`, token)
  },

  create(token: string, leadId: string, data: {
    title: string
    description?: string | null
    dueDate?: string | null
    assignedTo?: string | null
  }): Promise<LeadTaskDto> {
    return apiFetch<LeadTaskDto>(`/api/v1/leads/${leadId}/tasks`, token, { method: 'POST', body: JSON.stringify(data) })
  },

  complete(token: string, leadId: string, taskId: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${leadId}/tasks/${taskId}/complete`, token, { method: 'POST' })
  },

  uncomplete(token: string, leadId: string, taskId: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${leadId}/tasks/${taskId}/uncomplete`, token, { method: 'POST' })
  },
}

// ── Lead Agreements API ───────────────────────────────────────────────────────

export const agreementsApi = {
  list(token: string, leadId: string): Promise<LeadAgreementDto[]> {
    return apiFetch<LeadAgreementDto[]>(`/api/v1/leads/${leadId}/agreements`, token)
  },
}

// ── Activity Feed API ─────────────────────────────────────────────────────────

export const activityFeedApi = {
  list(token: string, limit = 50): Promise<ActivityFeedDto[]> {
    return apiFetch<ActivityFeedDto[]>(`/api/v1/activity-feed?limit=${limit}`, token)
  },

  log(token: string, data: {
    actorName: string
    type: string
    entityType?: string | null
    entityId?: string | null
    entityName?: string | null
    description?: string | null
  }): Promise<void> {
    return apiFetch<void>('/api/v1/activity-feed', token, { method: 'POST', body: JSON.stringify(data) })
  },
}

// ── Enterprise API ────────────────────────────────────────────────────────────

export const enterpriseApi = {
  getEvents(token: string): Promise<EnterpriseEventDto[]> {
    return apiFetch<EnterpriseEventDto[]>('/api/v1/enterprise/events', token)
  },

  addEvent(token: string, data: { title: string; eventTime: string; eventType: string }): Promise<EnterpriseEventDto> {
    return apiFetch<EnterpriseEventDto>('/api/v1/enterprise/events', token, { method: 'POST', body: JSON.stringify(data) })
  },

  deleteEvent(token: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/enterprise/events/${id}`, token, { method: 'DELETE' })
  },

  getTasks(token: string): Promise<EnterpriseTaskDto[]> {
    return apiFetch<EnterpriseTaskDto[]>('/api/v1/enterprise/tasks', token)
  },

  addTask(token: string, title: string): Promise<EnterpriseTaskDto> {
    return apiFetch<EnterpriseTaskDto>('/api/v1/enterprise/tasks', token, { method: 'POST', body: JSON.stringify({ title }) })
  },

  toggleTask(token: string, id: string, isDone: boolean): Promise<void> {
    return apiFetch<void>(`/api/v1/enterprise/tasks/${id}/toggle`, token, { method: 'PATCH', body: JSON.stringify({ isDone }) })
  },

  getState(token: string, key: string): Promise<EnterpriseStateDto | null> {
    return apiFetch<EnterpriseStateDto | null>(`/api/v1/enterprise/state/${key}`, token)
  },

  setState(token: string, key: string, value: string): Promise<void> {
    return apiFetch<void>(`/api/v1/enterprise/state/${key}`, token, { method: 'PUT', body: JSON.stringify({ value }) })
  },
}

// ── Admin Preferences API ─────────────────────────────────────────────────────

export const prefsApi = {
  get(token: string, key: string): Promise<AdminPreferenceDto | null> {
    return apiFetch<AdminPreferenceDto | null>(`/api/v1/admin/preferences/${key}`, token)
  },

  getMany(token: string, keys: string[]): Promise<AdminPreferenceDto[]> {
    return apiFetch<AdminPreferenceDto[]>(`/api/v1/admin/preferences?keys=${keys.join(',')}`, token)
  },

  set(token: string, key: string, value: string): Promise<void> {
    return apiFetch<void>(`/api/v1/admin/preferences/${key}`, token, { method: 'PUT', body: JSON.stringify({ value }) })
  },

  setMany(token: string, prefs: Record<string, string>): Promise<void> {
    return apiFetch<void>('/api/v1/admin/preferences/batch', token, { method: 'PUT', body: JSON.stringify({ prefs }) })
  },
}

// ── Audit Log API ─────────────────────────────────────────────────────────────

export const auditApi = {
  list(token: string, limit = 100): Promise<AuditLogDto[]> {
    return apiFetch<AuditLogDto[]>(`/api/v1/admin/audit-log?limit=${limit}`, token)
  },

  log(token: string, data: { action: string; resource: string; resourceId?: string | null; changes?: string | null }): Promise<void> {
    return apiFetch<void>('/api/v1/admin/audit-log', token, { method: 'POST', body: JSON.stringify(data) })
  },
}

// ── Site Build Requests API ───────────────────────────────────────────────────

export const siteBuildApi = {
  list(token: string): Promise<SiteBuildRequestDto[]> {
    return apiFetch<SiteBuildRequestDto[]>('/api/v1/site-builds', token)
  },

  submit(token: string, data: {
    clientName: string
    clientEmail: string
    businessName?: string | null
    notes?: string | null
  }): Promise<SiteBuildRequestDto> {
    return apiFetch<SiteBuildRequestDto>('/api/v1/site-builds', token, { method: 'POST', body: JSON.stringify(data) })
  },

  updateStatus(token: string, id: string, status: string, stagingUrl?: string | null): Promise<void> {
    return apiFetch<void>(`/api/v1/site-builds/${id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status, stagingUrl: stagingUrl ?? null }),
    })
  },
}

// ── Report Snapshots API ──────────────────────────────────────────────────────

export const reportsApi = {
  list(token: string, limit = 20): Promise<ReportSnapshotDto[]> {
    return apiFetch<ReportSnapshotDto[]>(`/api/v1/reports/snapshots?limit=${limit}`, token)
  },

  capture(token: string, data: { type: string; data: string }): Promise<ReportSnapshotDto> {
    return apiFetch<ReportSnapshotDto>('/api/v1/reports/snapshots', token, { method: 'POST', body: JSON.stringify(data) })
  },
}
