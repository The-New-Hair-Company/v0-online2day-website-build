import { test, expect } from '@playwright/test'

const viewports = [
  [375, 667],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]

for (const [width, height] of viewports) {
  test(`public shell and communication UI fit ${width}x${height} at 100% zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')

    const pageSize = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      zoom: window.devicePixelRatio,
    }))
    expect(pageSize.scrollWidth).toBeLessThanOrEqual(pageSize.clientWidth + 1)

    await page.getByRole('button', { name: 'Open chat' }).click()
    const chat = page.locator('[data-public-chat-panel]')
    await expect(chat).toBeVisible()
    const bounds = await chat.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1)

    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
    const loginSize = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(loginSize.scrollWidth).toBeLessThanOrEqual(loginSize.clientWidth + 1)
  })
}
