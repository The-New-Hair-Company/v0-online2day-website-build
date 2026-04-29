'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Download, SlidersHorizontal, Search, X, Eye, EyeOff, FileDown } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  'New': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Contacted': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Video Sent': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Follow-up Due': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Proposal Sent': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Won': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Lost': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const ALL_STATUSES = ['New', 'Contacted', 'Video Sent', 'Follow-up Due', 'Proposal Sent', 'Won', 'Lost']

const ALL_COLUMNS = [
  { key: 'name', label: 'Name / Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'created_at', label: 'Added' },
  { key: 'actions', label: 'Actions' },
]

interface Lead {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  source: string | null
  status: string | null
  follow_up_date: string | null
  created_at: string
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMNS.map((c) => c.key))
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const isVisible = (key: string) => visibleColumns.includes(key)

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.email?.toLowerCase().includes(search.toLowerCase()) ||
        lead.company?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter || lead.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [leads, search, statusFilter])

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDownloadAgreements = async () => {
    if (selectedIds.size === 0) return
    setDownloadingPdf(true)
    const ids = Array.from(selectedIds).join(',')
    window.open(`/api/download-agreements?ids=${ids}`, '_blank')
    setDownloadingPdf(false)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Column Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:border-primary/40 transition-colors"
          >
            <SlidersHorizontal size={15} />
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl p-3 z-10 min-w-[180px]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Toggle Columns</p>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-card-foreground">{col.label}</span>
                  {isVisible(col.key)
                    ? <Eye size={12} className="ml-auto text-primary" />
                    : <EyeOff size={12} className="ml-auto text-muted-foreground" />
                  }
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Download Agreements */}
        {selectedIds.size > 0 && (
          <button
            onClick={handleDownloadAgreements}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <FileDown size={15} />
            Download {selectedIds.size === 1 ? 'Agreement' : `${selectedIds.size} Agreements`}
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              {isVisible('name') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name / Company</th>}
              {isVisible('contact') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>}
              {isVisible('source') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>}
              {isVisible('status') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>}
              {isVisible('follow_up') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-up</th>}
              {isVisible('created_at') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Added</th>}
              {isVisible('actions') && <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredLeads.map((lead) => {
              const isSelected = selectedIds.has(lead.id)
              const statusClass = STATUS_COLORS[lead.status || ''] || 'bg-muted text-muted-foreground border-border'
              return (
                <tr
                  key={lead.id}
                  className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={isSelected}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  {isVisible('name') && (
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/leads/${lead.id}`} className="group">
                        <div className="font-semibold text-card-foreground group-hover:text-primary transition-colors">{lead.name}</div>
                        <div className="text-sm text-muted-foreground">{lead.company || '—'}</div>
                      </Link>
                    </td>
                  )}
                  {isVisible('contact') && (
                    <td className="px-5 py-4">
                      <div className="text-sm text-card-foreground">{lead.email}</div>
                      <div className="text-xs text-muted-foreground">{lead.phone || '—'}</div>
                    </td>
                  )}
                  {isVisible('source') && (
                    <td className="px-5 py-4 text-sm text-muted-foreground">{lead.source || '—'}</td>
                  )}
                  {isVisible('status') && (
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}>
                        {lead.status}
                      </span>
                    </td>
                  )}
                  {isVisible('follow_up') && (
                    <td className="px-5 py-4 text-sm">
                      {lead.follow_up_date ? (
                        <span className="text-orange-400 font-medium">
                          {new Date(lead.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {isVisible('created_at') && (
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  )}
                  {isVisible('actions') && (
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="text-primary hover:text-primary/80 text-sm font-medium"
                      >
                        Open →
                      </Link>
                    </td>
                  )}
                </tr>
              )
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={ALL_COLUMNS.length + 1} className="px-6 py-16 text-center text-muted-foreground">
                  {leads.length === 0
                    ? 'No leads yet. Create your first lead to get started.'
                    : 'No leads match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
