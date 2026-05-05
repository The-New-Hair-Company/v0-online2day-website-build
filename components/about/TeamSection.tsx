'use client'

import { useState } from 'react'
import { Users, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'

function PersonSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* head */}
      <path d="M60 14 C47 14 38 23 38 36 C38 49 47 58 60 58 C73 58 82 49 82 36 C82 23 73 14 60 14 Z" />
      {/* neck */}
      <path d="M52 57 L50 68 M68 57 L70 68" />
      {/* shoulders */}
      <path d="M28 90 Q36 68 50 68 Q60 72 70 68 Q84 68 92 90" />
      {/* body */}
      <path d="M28 90 L22 148 L98 148 L92 90" />
      {/* left arm */}
      <path d="M28 90 L12 122 L18 126" />
      {/* right arm */}
      <path d="M92 90 L108 122 L102 126" />
      {/* centre shirt crease */}
      <path d="M60 72 L60 148" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
    </svg>
  )
}

export function TeamSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-0">
      <Card
        className="p-8 bg-card border-border text-center cursor-pointer hover:border-primary/40 transition-colors select-none"
        onClick={() => setOpen(v => !v)}
        role="button"
        aria-expanded={open}
      >
        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-3 flex items-center justify-center gap-2">
          Meet Our Team
          <ChevronDown
            className="h-5 w-5 text-primary transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </h3>
        <p className="text-muted-foreground leading-relaxed">
          Experienced developers, designers, and strategists working together to exceed expectations.
        </p>
      </Card>

      {open && (
        <div className="grid md:grid-cols-2 gap-6 mt-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Oliver King */}
          <Card className="p-8 bg-card border-border flex flex-col items-center text-center gap-4">
            <div className="relative">
              <PersonSketch className="w-28 h-36 text-primary/60" />
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">Oliver King</h4>
              <p className="text-sm font-semibold text-primary mt-1">Managing Director</p>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
                Founder of Online2Day, Oliver leads the company's strategic vision and client partnerships — building digital products that drive real business growth.
              </p>
            </div>
          </Card>

          {/* Mr Alok */}
          <Card className="p-8 bg-card border-border flex flex-col items-center text-center gap-4">
            <div className="relative">
              <PersonSketch className="w-28 h-36 text-primary/60" />
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">Mr Alok</h4>
              <p className="text-sm font-semibold text-primary mt-1">Director &amp; Head of Digital</p>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
                Alok oversees all digital delivery at Online2Day — from architecture and development to campaign strategy and technical execution across every project.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
