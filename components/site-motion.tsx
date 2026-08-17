'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const revealSelector = [
  'main section:not(:first-child)',
  '.service-card',
  '.process-list article',
  '.price-card',
  '.marketing-card',
  '.contact-option',
  '.legal-shell section',
  '.faq-list details',
].join(',')

export function SiteMotion() {
  const pathname = usePathname()

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(revealSelector))
    const progress = document.querySelector<HTMLElement>('[data-scroll-progress]')

    items.forEach((item, index) => {
      item.dataset.reveal = ''
      item.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 55}ms`)
    })

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    items.forEach((item) => observer.observe(item))

    const updateProgress = () => {
      if (!progress) return
      const height = document.documentElement.scrollHeight - window.innerHeight
      const amount = height > 0 ? Math.min(window.scrollY / height, 1) : 0
      progress.style.transform = `scaleX(${amount})`
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [pathname])

  return <div className="scroll-progress" data-scroll-progress aria-hidden="true" />
}
