import type { SiteBrandingDto, SiteBrandingTokens } from '@/lib/api/client'

export const BRAND_TOKEN_NAMES = [
  'background', 'surface', 'surfaceAlt', 'text', 'muted', 'primary', 'primaryText', 'primaryHover', 'border',
] as const satisfies ReadonlyArray<keyof SiteBrandingTokens>

export const DEFAULT_SITE_BRANDING: SiteBrandingDto = {
  light: {
    background: '#f4f7fb', surface: '#ffffff', surfaceAlt: '#eef3fb', text: '#111827',
    muted: '#526070', primary: '#2563eb', primaryText: '#ffffff', primaryHover: '#1d4ed8', border: '#cbd5e1',
  },
  dark: {
    background: '#05070b', surface: '#0d121c', surfaceAlt: '#0a101b', text: '#f7f9ff',
    muted: '#8f98aa', primary: '#2f6bff', primaryText: '#ffffff', primaryHover: '#4d86ff', border: '#273247',
  },
}

export function isHexColour(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function normaliseBranding(value?: SiteBrandingDto | null): SiteBrandingDto {
  if (!value) return DEFAULT_SITE_BRANDING
  const normaliseTokens = (tokens: Partial<SiteBrandingTokens> | undefined, defaults: SiteBrandingTokens) =>
    Object.fromEntries(BRAND_TOKEN_NAMES.map((name) => [name, isHexColour(tokens?.[name] || '') ? tokens?.[name] : defaults[name]])) as SiteBrandingTokens
  return {
    light: normaliseTokens(value.light, DEFAULT_SITE_BRANDING.light),
    dark: normaliseTokens(value.dark, DEFAULT_SITE_BRANDING.dark),
    updatedAt: value.updatedAt,
  }
}

export function brandingCss(brandingInput?: SiteBrandingDto | null) {
  const branding = normaliseBranding(brandingInput)
  const declarations = (tokens: SiteBrandingTokens) => BRAND_TOKEN_NAMES
    .map((name) => `--brand-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${tokens[name]};`)
    .join('')
  return `:root{${declarations(branding.dark)}}:root[data-theme='light']{${declarations(branding.light)}}`
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

export function contrastRatio(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background))
  const dark = Math.min(luminance(foreground), luminance(background))
  return (light + 0.05) / (dark + 0.05)
}
