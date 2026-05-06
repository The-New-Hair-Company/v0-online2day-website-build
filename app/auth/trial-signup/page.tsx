'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Mail, Phone, Shield } from 'lucide-react'
import { startTrialAccount } from '@/lib/actions/trial-signup'
import { isBusinessEmail } from '@/lib/utils'

// Update this to your real contact number
const SUPPORT_PHONE = '+44 (0) 800 XXX XXXX'
const SUPPORT_EMAIL = 'info@online2day.com'

// useSearchParams() must live inside a Suspense boundary for static prerendering
function TrialSignupContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'Pro'

  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    jobTitle: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)

  function set(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
    setError(null)
    setFieldError(null)
    if (key === 'email') {
      const trimmed = value.trim()
      if (trimmed.includes('@') && !isBusinessEmail(trimmed)) {
        setEmailWarning('Personal email addresses are not accepted. Please use your business email.')
      } else {
        setEmailWarning(null)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldError(null)

    if (fields.password !== fields.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!agreed) {
      setError('Please accept the terms and privacy policy to continue.')
      return
    }

    setLoading(true)
    try {
      const result = await startTrialAccount({
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        companyName: fields.companyName,
        jobTitle: fields.jobTitle,
        phone: fields.phone,
        password: fields.password,
        plan,
      })
      if (result.success) {
        setSuccess(true)
      } else {
        if (result.field) setFieldError(result.field)
        setError(result.error)
      }
    } catch {
      setError('Something went wrong. Please try again or contact us.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={s.shell}>
        <div style={s.successCard}>
          <div style={s.successIcon}><CheckCircle2 size={40} color="#22c55e" /></div>
          <h1 style={s.successTitle}>Check your inbox</h1>
          <p style={s.successText}>
            We&apos;ve sent a confirmation link to <strong>{fields.email}</strong>. Click it to verify your address and activate your 14-day free trial on the <strong>{plan}</strong> plan.
          </p>
          <p style={s.successSub}>No credit card required. Cancel any time.</p>
          <div style={s.successActions}>
            <Link href="/auth/login" style={s.btnPrimary}>Go to login</Link>
            <Link href="/pricing" style={s.btnSecondary}>Back to pricing</Link>
          </div>
          <div style={s.supportNote}>
            <span>Didn&apos;t receive the email?</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={s.supportLink}>{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.shell}>
      <div style={s.container}>
        {/* Left: Form */}
        <div style={s.formSide}>
          <Link href="/pricing" style={s.backLink}><ArrowLeft size={14} />Back to pricing</Link>

          <div style={s.formHeader}>
            <div style={s.planBadge}>{plan} plan</div>
            <h1 style={s.heading}>Start your 14-day free trial</h1>
            <p style={s.subheading}>No credit card required. Full access from day one.</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} style={s.form} noValidate>
            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label} htmlFor="firstName">First name <span style={s.req}>*</span></label>
                <input
                  id="firstName"
                  style={s.input}
                  value={fields.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="Jane"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="lastName">Last name <span style={s.req}>*</span></label>
                <input
                  id="lastName"
                  style={s.input}
                  value={fields.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder="Smith"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="email">Business email <span style={s.req}>*</span></label>
              <input
                id="email"
                type="email"
                style={{ ...s.input, ...(emailWarning ? s.inputWarn : {}) }}
                value={fields.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="jane@yourcompany.com"
                required
                autoComplete="email"
              />
              {emailWarning ? <p style={s.warnText}>{emailWarning}</p> : null}
            </div>

            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label} htmlFor="companyName">Company name <span style={s.req}>*</span></label>
                <input
                  id="companyName"
                  style={s.input}
                  value={fields.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder="Acme Ltd"
                  required
                  autoComplete="organization"
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="jobTitle">Job title</label>
                <input
                  id="jobTitle"
                  style={s.input}
                  value={fields.jobTitle}
                  onChange={(e) => set('jobTitle', e.target.value)}
                  placeholder="Sales Director"
                  autoComplete="organization-title"
                />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="phone">Phone number <span style={s.optional}>(optional)</span></label>
              <input
                id="phone"
                type="tel"
                style={s.input}
                value={fields.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+44 7700 900000"
                autoComplete="tel"
              />
            </div>

            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label} htmlFor="password">Password <span style={s.req}>*</span></label>
                <input
                  id="password"
                  type="password"
                  style={s.input}
                  value={fields.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="confirmPassword">Confirm password <span style={s.req}>*</span></label>
                <input
                  id="confirmPassword"
                  type="password"
                  style={s.input}
                  value={fields.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={s.checkbox}
              />
              <span>
                I agree to the{' '}
                <Link href="/legal/terms" style={s.inlineLink}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="/legal/privacy" style={s.inlineLink}>Privacy Policy</Link>
              </span>
            </label>

            {error ? (
              <div style={s.errorBox}>
                <span>{error}</span>
                {error.toLowerCase().includes('contact') || error.toLowerCase().includes('support') ? (
                  <div style={s.errorContact}>
                    <a href={`mailto:${SUPPORT_EMAIL}`} style={s.errorContactLink}><Mail size={13} />{SUPPORT_EMAIL}</a>
                    <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} style={s.errorContactLink}><Phone size={13} />{SUPPORT_PHONE}</a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button type="submit" disabled={loading || !!emailWarning} style={{ ...s.submitBtn, ...(loading || !!emailWarning ? s.submitBtnDisabled : {}) }}>
              {loading ? 'Creating your account…' : `Start free ${plan} trial`}
            </button>

            <div style={s.loginLink}>
              Already have an account?{' '}
              <Link href="/auth/login" style={s.inlineLink}>Log in</Link>
            </div>
          </form>
        </div>

        {/* Right: Benefits + Support */}
        <div style={s.benefitsSide}>
          <div style={s.benefitsCard}>
            <h2 style={s.benefitsTitle}>What&apos;s included in your trial</h2>
            <ul style={s.benefitsList}>
              {[
                'Full access to the Online2Day CRM',
                'Personalised video outreach tools',
                'Lead pipeline management',
                'Activity timeline and audit log',
                'Email templates and sequences',
                'GDPR-ready data controls',
                'No credit card needed',
              ].map((b) => (
                <li key={b} style={s.benefitItem}>
                  <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                  {b}
                </li>
              ))}
            </ul>

            <div style={s.gdprNote}>
              <Shield size={16} style={{ flexShrink: 0, color: '#72aeff' }} />
              <span>Your account is isolated from all other data. We never share your leads or business information with other users.</span>
            </div>
          </div>

          <div style={s.supportCard}>
            <h3 style={s.supportTitle}>Need help signing up?</h3>
            <p style={s.supportText}>Our team is here if you hit any issues.</p>
            <div style={s.supportContacts}>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} style={s.supportContact}>
                <div style={s.supportContactIcon}><Phone size={16} /></div>
                <div>
                  <strong style={s.supportContactLabel}>Call us</strong>
                  <span style={s.supportContactValue}>{SUPPORT_PHONE}</span>
                </div>
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} style={s.supportContact}>
                <div style={s.supportContactIcon}><Mail size={16} /></div>
                <div>
                  <strong style={s.supportContactLabel}>Email us</strong>
                  <span style={s.supportContactValue}>{SUPPORT_EMAIL}</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TrialSignupPage() {
  return (
    <Suspense fallback={null}>
      <TrialSignupContent />
    </Suspense>
  )
}

// Inline styles — keeps the page self-contained and matches the dark theme
const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 18% -6%, rgba(37,99,235,0.2), transparent 28%), radial-gradient(circle at 84% 6%, rgba(6,182,212,0.12), transparent 22%), #05070b',
    color: '#f5f8ff',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 24px 80px',
  },
  container: {
    width: '100%',
    maxWidth: 1020,
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: 32,
    alignItems: 'start',
  },
  formSide: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  backLink: {
    color: '#72aeff',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  formHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  planBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    background: 'rgba(59,130,246,0.15)',
    border: '1px solid rgba(59,130,246,0.35)',
    color: '#72aeff',
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  heading: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  subheading: {
    margin: 0,
    color: '#8090a5',
    fontSize: 15,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: '#c5d0e6',
  },
  req: { color: '#f59e0b' },
  optional: { color: '#8090a5', fontWeight: 400 },
  input: {
    height: 42,
    borderRadius: 9,
    border: '1px solid rgba(116,147,196,0.24)',
    background: 'rgba(4,9,17,0.82)',
    color: '#f5f8ff',
    padding: '0 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  inputWarn: {
    borderColor: 'rgba(245,158,11,0.5)',
  },
  warnText: {
    margin: 0,
    fontSize: 12,
    color: '#f59e0b',
    lineHeight: 1.4,
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: '#8090a5',
    cursor: 'pointer',
    lineHeight: 1.5,
  },
  checkbox: {
    marginTop: 2,
    accentColor: '#3b82f6',
    flexShrink: 0,
  },
  inlineLink: {
    color: '#72aeff',
    textDecoration: 'underline',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 9,
    padding: '12px 14px',
    fontSize: 13,
    color: '#fca5a5',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  errorContact: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  errorContactLink: {
    color: '#fca5a5',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    border: 0,
    background: 'linear-gradient(180deg, #3e7fff, #1862ff)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 24px rgba(24,98,255,0.3)',
    transition: 'opacity 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8090a5',
  },
  // Success screen
  successCard: {
    maxWidth: 500,
    width: '100%',
    background: 'rgba(12,18,30,0.96)',
    border: '1px solid rgba(116,147,196,0.18)',
    borderRadius: 16,
    padding: '40px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center',
  },
  successIcon: { lineHeight: 1 },
  successTitle: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' },
  successText: { margin: 0, color: '#8090a5', fontSize: 15, lineHeight: 1.6 },
  successSub: { margin: 0, fontSize: 13, color: '#22c55e', fontWeight: 700 },
  successActions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    padding: '0 20px',
    borderRadius: 9,
    background: 'linear-gradient(180deg, #3e7fff, #1862ff)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 14,
    textDecoration: 'none',
    boxShadow: '0 6px 18px rgba(24,98,255,0.28)',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    padding: '0 20px',
    borderRadius: 9,
    border: '1px solid rgba(116,147,196,0.28)',
    color: '#c5d0e6',
    fontWeight: 700,
    fontSize: 14,
    textDecoration: 'none',
    background: 'transparent',
  },
  supportNote: {
    fontSize: 13,
    color: '#8090a5',
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportLink: { color: '#72aeff', textDecoration: 'underline' },
  // Benefits panel
  benefitsSide: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 32,
  },
  benefitsCard: {
    background: 'rgba(12,18,30,0.96)',
    border: '1px solid rgba(116,147,196,0.18)',
    borderRadius: 14,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  benefitsTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  benefitsList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 14,
    color: '#c5d0e6',
    lineHeight: 1.4,
  },
  gdprNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 12,
    color: '#8090a5',
    lineHeight: 1.5,
    borderTop: '1px solid rgba(116,147,196,0.14)',
    paddingTop: 14,
  },
  supportCard: {
    background: 'rgba(12,18,30,0.96)',
    border: '1px solid rgba(116,147,196,0.18)',
    borderRadius: 14,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  supportTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  supportText: {
    margin: 0,
    fontSize: 13,
    color: '#8090a5',
  },
  supportContacts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  supportContact: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 9,
    border: '1px solid rgba(116,147,196,0.14)',
    background: 'rgba(255,255,255,0.02)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  supportContactIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(59,130,246,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#72aeff',
    flexShrink: 0,
  },
  supportContactLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 800,
    color: '#c5d0e6',
  },
  supportContactValue: {
    display: 'block',
    fontSize: 12,
    color: '#8090a5',
    marginTop: 2,
  },
}
