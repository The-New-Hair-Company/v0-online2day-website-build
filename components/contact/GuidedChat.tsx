'use client'

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { submitContactForm } from '@/app/actions/hubspot'

type Step = 'greeting' | 'topic' | 'detail' | 'done'
type Topic = 'Account Set-up' | 'Billing' | 'Book a Demo' | 'Other'

const TOPICS: Topic[] = ['Account Set-up', 'Billing', 'Book a Demo', 'Other']

type Msg = { from: 'bot' | 'user'; text: string }

export function GuidedChat() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('greeting')
  const [name, setName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [topic, setTopic] = useState<Topic | null>(null)
  const [detail, setDetail] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: "Hello! One of our team will be with you soon. What is your name so I can let them know?" },
  ])

  function push(m: Msg) {
    setMsgs(prev => {
      const next = [...prev, m]
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      return next
    })
  }

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = nameInput.trim()
    if (!n) return
    push({ from: 'user', text: n })
    setName(n)
    setTimeout(() => {
      push({ from: 'bot', text: `Thank you ${n}! Now, to see what the issue is:` })
      setStep('topic')
    }, 400)
  }

  function handleTopicSelect(t: Topic) {
    push({ from: 'user', text: t })
    setTopic(t)
    setTimeout(() => {
      push({ from: 'bot', text: "Please describe your query below, and include your email so we can follow up." })
      setStep('detail')
    }, 400)
  }

  async function handleDetailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!detail.trim()) return
    setSending(true)
    push({ from: 'user', text: detail.trim() })
    try {
      if (email.trim()) {
        await submitContactForm({
          name,
          email: email.trim(),
          company: '',
          message: `[${topic}] ${detail.trim()}`,
        }).catch(() => {})
      }
    } catch { /* swallow */ }
    setTimeout(() => {
      push({ from: 'bot', text: "Thank you! A member of the team will be with you shortly." })
      setStep('done')
      setSending(false)
    }, 500)
  }

  return (
    <div className="flex flex-col" style={{ height: 520 }}>
      {/* message list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.from === 'bot' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-3 mt-0.5">
                <span className="text-primary text-xs font-bold">O2D</span>
              </div>
            )}
            <div
              className={`px-4 py-2.5 rounded-2xl max-w-[75%] text-sm leading-relaxed ${
                m.from === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                  : 'bg-muted text-foreground rounded-tl-none'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input area */}
      <div className="border-t border-border bg-background/50 p-4">
        {step === 'greeting' && (
          <form onSubmit={handleNameSubmit} className="flex gap-3">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-border bg-card text-foreground px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Your name…"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
            >
              <Send size={15} />Send
            </button>
          </form>
        )}

        {step === 'topic' && (
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map(t => (
              <button
                key={t}
                onClick={() => handleTopicSelect(t)}
                className="px-4 py-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {step === 'detail' && (
          <form onSubmit={handleDetailSubmit} className="flex flex-col gap-3">
            <textarea
              autoFocus
              className="w-full rounded-lg border border-border bg-card text-foreground px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="Describe your issue…"
              rows={3}
            />
            <input
              type="email"
              className="w-full rounded-lg border border-border bg-card text-foreground px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email (optional, so we can follow up)"
            />
            <button
              type="submit"
              disabled={sending || !detail.trim()}
              className="self-end flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
            >
              <Send size={15} />{sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p className="text-sm text-muted-foreground text-center py-2">
            We&apos;ll be in touch soon. You can also call us on{' '}
            <a href="tel:+443330506098" className="text-primary font-medium hover:underline">
              +44 333 050 6098
            </a>
            .
          </p>
        )}
      </div>
    </div>
  )
}
