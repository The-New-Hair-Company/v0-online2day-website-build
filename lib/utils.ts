import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.ca', 'yahoo.com.au',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es',
  'outlook.com', 'outlook.fr', 'outlook.de',
  'live.com', 'live.co.uk', 'live.fr',
  'msn.com',
  'aol.com', 'aol.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'yandex.com', 'yandex.ru',
  'mail.com', 'inbox.com',
  'gmx.com', 'gmx.net', 'web.de',
  'qq.com', '163.com', '126.com',
  'btinternet.com', 'sky.com', 'virginmedia.com',
  'ntlworld.com', 'talktalk.net', 'blueyonder.co.uk',
  'tiscali.co.uk', 'o2.co.uk', 'orange.net',
])

export function isBusinessEmail(email: string): boolean {
  const parts = email.toLowerCase().trim().split('@')
  if (parts.length !== 2 || !parts[1]) return false
  return !CONSUMER_DOMAINS.has(parts[1])
}
