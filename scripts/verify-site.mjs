import process from 'node:process'

const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const tests = []
const timings = []

function check(name, condition, detail = '') {
  tests.push({ name, passed: Boolean(condition), detail })
}

async function get(path, expected = 200) {
  const started = performance.now()
  const response = await fetch(`${base}${path}`, { redirect: 'manual' })
  timings.push({ path, ms: Math.round(performance.now() - started) })
  check(`GET ${path} returns ${expected}`, response.status === expected, `status=${response.status}`)
  return { response, body: await response.text() }
}

for (const path of ['/', '/pricing', '/start', '/marketing', '/about', '/contact', '/terms', '/privacy', '/complaints', '/robots.txt', '/sitemap.xml']) {
  await get(path)
}

const home = await get('/')
const headers = home.response.headers
check('HTML declares British English', /<html[^>]+lang="en-GB"/i.test(home.body))
check('Skip link is present', /class="skip-link"/i.test(home.body))
check('Primary navigation is labelled', /aria-label="Primary navigation"/i.test(home.body))
check('Homepage has one clear H1', (home.body.match(/<h1\b/gi) || []).length === 1)
check('Open Graph image is configured', /property="og:image"[^>]+og\.png/i.test(home.body))
check('Canonical metadata uses online2day.com', /https:\/\/www\.online2day\.com/i.test(home.body))
check('X-Content-Type-Options is nosniff', headers.get('x-content-type-options') === 'nosniff')
check('HSTS includes preload', headers.get('strict-transport-security')?.includes('preload'))
check('Referrer policy is strict', headers.get('referrer-policy') === 'strict-origin-when-cross-origin')
check('Framing is denied', headers.get('x-frame-options') === 'DENY')
check('Permissions policy disables sensitive APIs', headers.get('permissions-policy')?.includes('camera=()'))
check('Cross-origin opener policy is isolated', headers.get('cross-origin-opener-policy') === 'same-origin')
check('Cross-origin resource policy is same-origin', headers.get('cross-origin-resource-policy') === 'same-origin')
check('Legacy cross-domain policy is disabled', headers.get('x-permitted-cross-domain-policies') === 'none')
check('CSP report-only policy is present', headers.get('content-security-policy-report-only')?.includes("object-src 'none'"))
check('Framework identity header is absent', !headers.has('x-powered-by'))

const robots = await get('/robots.txt')
check('Robots excludes private and API routes', ['/api/', '/dashboard/', '/protected/', '/user-dashboard/'].every((entry) => robots.body.includes(entry)))
check('Robots advertises canonical sitemap', robots.body.includes('https://www.online2day.com/sitemap.xml'))

const sitemap = await get('/sitemap.xml')
check('Sitemap contains core public pages', ['/', '/pricing', '/start', '/privacy', '/terms'].every((path) => sitemap.body.includes(`https://www.online2day.com${path}`)))
check('Sitemap excludes dashboards', !sitemap.body.includes('/dashboard'))

const success = await get('/checkout/success')
check('Checkout success page is noindex', /name="robots"[^>]+noindex/i.test(success.body))
await get('/this-route-must-not-exist', 404)

async function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

let response = await post('/api/checkout', '{')
check('Checkout rejects malformed JSON', response.status === 400, `status=${response.status}`)
response = await post('/api/checkout', { plan: 'bespoke', billing: 'monthly' })
check('Checkout rejects non-allowlisted plans', response.status === 400, `status=${response.status}`)
response = await post('/api/checkout', { plan: 'launch', billing: 'monthly' }, { origin: 'https://attacker.invalid' })
check('Checkout blocks cross-origin requests', response.status === 403, `status=${response.status}`)
response = await post('/api/checkout', { plan: 'launch', billing: 'monthly' })
if (new URL(base).hostname === 'www.online2day.com') {
  const checkoutPayload = await response.json().catch(() => ({}))
  check('Checkout creates a live Stripe session', response.status === 201, `status=${response.status}`)
  check('Checkout returns a Stripe-hosted URL', /^https:\/\/checkout\.stripe\.com\//.test(checkoutPayload.url || ''))
} else {
  check('Checkout fails closed when secrets are absent', response.status === 503, `status=${response.status}`)
}
check('API responses are never cacheable', response.headers.get('cache-control')?.includes('no-store'))

response = await post('/api/requirements', '{')
check('Brief intake rejects malformed JSON', response.status === 400, `status=${response.status}`)
response = await post('/api/requirements', {}, { origin: 'https://attacker.invalid' })
check('Brief intake blocks cross-origin requests', response.status === 403, `status=${response.status}`)
response = await post('/api/requirements', 'x'.repeat(20_001), { 'content-type': 'text/plain' })
check('Brief intake enforces its 20KB limit', response.status === 413, `status=${response.status}`)

const validBrief = {
  plan: 'launch', projectType: 'new-website', pages: '1-5', features: [],
  timeline: '4-8-weeks', budget: '1k-3k', name: 'Test Person',
  email: 'test@example.invalid', company: '', notes: '', website: 'bot-filled',
  startedAt: Date.now() - 5000,
}
response = await post('/api/requirements', validBrief)
check('Brief honeypot safely absorbs bots', response.status === 202, `status=${response.status}`)

const warmSamples = []
for (let index = 0; index < 5; index += 1) {
  const started = performance.now()
  const warm = await fetch(`${base}/`)
  await warm.arrayBuffer()
  warmSamples.push(performance.now() - started)
}
const warmMedian = warmSamples.sort((a, b) => a - b)[2]
check('Warm homepage median is under 500ms', warmMedian < 500, `median=${Math.round(warmMedian)}ms`)

const passed = tests.filter((test) => test.passed).length
const failed = tests.length - passed
console.log(JSON.stringify({ base, passed, failed, total: tests.length, warmMedianMs: Math.round(warmMedian), routeTimings: timings, tests }, null, 2))
process.exitCode = failed ? 1 : 0
