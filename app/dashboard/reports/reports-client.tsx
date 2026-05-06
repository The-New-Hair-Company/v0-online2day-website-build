'use client'

import { useMemo, useState, useTransition } from 'react'
import { BarChart3, Download, FileSpreadsheet, ShieldCheck, TrendingUp } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'
import { captureReportSnapshot, type ReportSnapshot } from '@/lib/actions/enterprise-actions'

type Metric = { label: string; value: string | number; delta?: string }
type DataQuality = {
  total: number
  missingEmail: number
  missingPhone: number
  missingCompany: number
  missingSource: number
  missingOwner: number
  missingFollowUp: number
}

export function ReportsClient({
  metrics,
  dataQuality,
  snapshots,
}: {
  metrics: Metric[]
  dataQuality: DataQuality
  snapshots: ReportSnapshot[]
}) {
  const [isPending, startTransition] = useTransition()
  const [snapshotState, setSnapshotState] = useState<ReportSnapshot[]>(snapshots)
  const [notice, setNotice] = useState('')
  const summary = useMemo(() => {
    const missingTotal =
      dataQuality.missingEmail +
      dataQuality.missingPhone +
      dataQuality.missingCompany +
      dataQuality.missingSource +
      dataQuality.missingOwner +
      dataQuality.missingFollowUp
    return {
      score: dataQuality.total > 0 ? Math.max(0, Math.round((1 - missingTotal / (dataQuality.total * 6)) * 100)) : 100,
      missingTotal,
    }
  }, [dataQuality])

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCaptureSnapshot() {
    const periodLabel = `Weekly - ${new Date().toLocaleDateString()}`
    const kpis = metrics.reduce<Record<string, string | number>>((acc, metric) => {
      acc[metric.label] = metric.value
      return acc
    }, {})
    startTransition(async () => {
      const result = await captureReportSnapshot({ periodLabel, kpis })
      if ('error' in result && result.error) {
        setNotice(result.error)
        return
      }
      const local: ReportSnapshot = {
        id: `local-${Date.now()}`,
        periodLabel,
        kpis,
        createdAt: new Date().toISOString(),
        createdBy: null,
      }
      setSnapshotState((current) => [local, ...current].slice(0, 12))
      setNotice('Snapshot captured successfully.')
    })
  }

  return (
    <div className={styles.shell}>
      <DashboardSidebar active="reports" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Reports</h1>
            <p>Executive summaries for leadership, delivery, and governance reviews.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() =>
                download(
                  'online2day-report-summary.json',
                  JSON.stringify({ metrics, dataQuality, generatedAt: new Date().toISOString() }, null, 2),
                  'application/json',
                )
              }
            >
              <Download size={15} />
              Export JSON
            </button>
            <button
              className={styles.primaryButton}
              onClick={() =>
                download(
                  'online2day-report-summary.csv',
                  ['label,value,delta', ...metrics.map((m) => `"${m.label}","${m.value}","${m.delta || ''}"`)].join('\n'),
                  'text/csv',
                )
              }
            >
              <FileSpreadsheet size={15} />
              Export CSV
            </button>
            <button className={styles.utilityButton} disabled={isPending} onClick={handleCaptureSnapshot}>
              <ShieldCheck size={15} />
              {isPending ? 'Saving snapshot...' : 'Capture Snapshot'}
            </button>
          </div>
        </header>
        {notice ? <p className={styles.notifState}>{notice}</p> : null}

        <section className={styles.metricsGrid}>
          <article><span>Report health</span><strong>{summary.score}%</strong><em>Data quality confidence</em></article>
          <article><span>Missing records</span><strong>{summary.missingTotal}</strong><em>Across key CRM fields</em></article>
          <article><span>Leads tracked</span><strong>{dataQuality.total}</strong><em>Current CRM population</em></article>
          <article><span>Review mode</span><strong>Weekly</strong><em>Recommended cadence</em></article>
          <article><span>Governance</span><strong>Live</strong><em>Audit-ready exportable state</em></article>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.panel}>
            <header><TrendingUp size={18} /><strong>Performance Summary</strong></header>
            {!metrics.length ? <p className={styles.notifState}>No metrics available yet.</p> : null}
            <div className={styles.auditList}>
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <span>{metric.delta || 'Current'}</span>
                  <strong>{metric.label}</strong>
                  <p>{metric.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <header><ShieldCheck size={18} /><strong>Data Quality Snapshot</strong></header>
            <div className={styles.scanGrid}>
              <div className={styles.scanStat}><strong>{dataQuality.total}</strong><span>Total leads</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingEmail}</strong><span>Missing email</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingPhone}</strong><span>Missing phone</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingCompany}</strong><span>Missing company</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingSource}</strong><span>Missing source</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingOwner}</strong><span>Missing owner</span></div>
              <div className={styles.scanStat}><strong>{dataQuality.missingFollowUp}</strong><span>Missing follow-up</span></div>
            </div>
          </article>
        </section>

        <section className={styles.panel}>
          <header><BarChart3 size={18} /><strong>Leadership Notes</strong></header>
          <p className={styles.notifState}>Use this report in weekly reviews to track pipeline movement, CRM hygiene, and delivery readiness.</p>
        </section>
        <section className={styles.panel}>
          <header><TrendingUp size={18} /><strong>Recent Snapshots</strong></header>
          {!snapshotState.length ? <p className={styles.notifState}>No snapshots yet. Capture your first weekly baseline.</p> : null}
          <div className={styles.auditList}>
            {snapshotState.map((item) => (
              <div key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>{item.periodLabel}</strong>
                <p>{Object.keys(item.kpis).length} KPI values captured</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
