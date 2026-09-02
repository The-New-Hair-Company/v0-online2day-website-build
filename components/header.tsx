import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

const navItems = [
  { href: '/services', label: 'Services' },
  { href: '/work', label: 'Work' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
]

function BrandLink() {
  return (
    <Link href="/" className="text-xl font-bold tracking-tight" aria-label="Online2Day home">
      <span className="text-foreground">online</span>
      <span className="text-primary">2day</span>
    </Link>
  )
}

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${mobile ? 'block py-1' : ''} text-sm font-medium text-muted-foreground transition-colors hover:text-foreground`}
        >
          {item.label}
        </Link>
      ))}
    </>
  )
}

function HeaderActions({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={mobile ? 'grid gap-2 border-t border-border pt-3' : 'hidden items-center gap-3 md:flex'}>
      <Button variant="ghost" asChild>
        <Link href="/auth/login">Login</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <Button asChild>
        <Link href="/contact">Get Started</Link>
      </Button>
    </div>
  )
}

export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/88 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <BrandLink />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            <NavLinks />
          </nav>

          <HeaderActions />

          <details className="group relative md:hidden">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-border bg-card text-foreground [&::-webkit-details-marker]:hidden" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </summary>
            <nav className="absolute right-0 top-12 w-[min(88vw,320px)] rounded-xl border border-border bg-card p-4 shadow-2xl shadow-black/20" aria-label="Mobile navigation">
              <div className="grid gap-3">
                <NavLinks mobile />
                <HeaderActions mobile />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
