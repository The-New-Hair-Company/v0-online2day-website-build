const API_BASE = process.env.DOTNET_API_URL ?? 'https://online2dayapi.fly.dev'

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

  create(
    token: string,
    data: {
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
    },
  ): Promise<LeadDto> {
    return apiFetch<LeadDto>('/api/v1/leads', token, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update(
    token: string,
    id: string,
    data: {
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
    },
  ): Promise<LeadDto> {
    return apiFetch<LeadDto>(`/api/v1/leads/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  updateStatus(token: string, id: string, status: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  addNote(token: string, id: string, note: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}/notes`, token, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })
  },

  delete(token: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/leads/${id}`, token, {
      method: 'DELETE',
    })
  },
}
