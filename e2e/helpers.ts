import { type Page } from '@playwright/test'

export const USER_A = { username: 'test_alice_e2e', password: 'Test1234!' }
export const USER_B = { username: 'test_bob_e2e', password: 'Test1234!' }

export async function register(page: Page, username: string, password: string) {
  await page.goto('/register')
  await page.fill('input[placeholder="3-50位字母/数字/下划线"]', username)
  await page.fill('input[placeholder="至少6位"]', password)
  await page.fill('input[placeholder="再次输入密码"]', password)
  await page.click('button[type="submit"], button:has-text("注册")')
  await page.waitForURL(/\/chat/, { timeout: 15_000 })
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 25000 })
  await page.waitForFunction(
    () => document.body.getAttribute('data-ws-ready') === 'true',
    { timeout: 30000 }
  )
}

export async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.fill('input[placeholder="输入用户名"]', username)
  await page.fill('input[placeholder="输入密码"]', password)
  await page.click('button[type="submit"], button:has-text("登录")')
  await page.waitForURL(/\/chat/, { timeout: 15_000 })
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 25000 })
  await page.waitForFunction(
    () => document.body.getAttribute('data-ws-ready') === 'true',
    { timeout: 30000 }
  )
}

export async function logout(page: Page) {
  await page.goto('/profile')
  const logoutBtn = page.getByRole('button', { name: /退出|登出|注销/ })
  await logoutBtn.click()
  const confirmBtn = page.getByRole('button', { name: /确认|确定|退出/ })
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click()
  }
  await page.waitForURL(/\/login/, { timeout: 8_000 })
}

export async function goToChat(page: Page) {
  await page.click('a[href="/friends"], text=在线')
  await page.waitForURL(/\/friends/, { timeout: 5_000 })
  const input = page.locator('input').first()
  await input.fill(USER_B.username)
  await page.keyboard.press('Enter')
  await page.locator(`text=${USER_B.username}`).first().click()
  const msgBtn = page.getByRole('button', { name: /发消息|聊天|私聊/ })
  if (await msgBtn.isVisible({ timeout: 2000 }).catch(() => false)) await msgBtn.click()
  await page.waitForURL(/\/chat\//, { timeout: 8_000 })
}