/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async headers() {
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' https://va.vercel-scripts.com",
      "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.hubapi.com https://vitals.vercel-insights.com",
      "form-action 'self'",
      'report-uri /api/security/csp-report',
      'upgrade-insecure-requests',
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Reporting-Endpoints', value: 'csp-endpoint="/api/security/csp-report"' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
