import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'
const PASSWORD = 'Test1234!'

async function apiRegister(username: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, confirmPassword: PASSWORD }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(`注册失败 ${username}: ${data.message}`)
  return data.data as { accessToken: string; user: { username: string } }
}

async function apiDeleteAccount(accessToken: string) {
  await fetch(`${BASE_URL}/api/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  }).catch(() => {})
}

interface UserCtx { username: string; accessToken: string; ctx: BrowserContext; page: Page }

async function loginUI(page: Page, username: string) {
  await page.goto('/login')
  await page.locator('input[placeholder="输入用户名"]').fill(username)
  await page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/chat/, { timeout: 20000 })
  await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 25000 })
  await page.waitForFunction(
    () => document.body.getAttribute('data-ws-ready') === 'true',
    { timeout: 30000 }
  )
}

async function setupUser(browser: Browser, prefix: string): Promise<UserCtx> {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`
  const auth = await apiRegister(username)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await loginUI(page, username)
  return { username, accessToken: auth.accessToken, ctx, page }
}

async function teardown(users: UserCtx[]) {
  await Promise.all(users.map(u => u.page.close().catch(() => {})))
  await Promise.race([
    Promise.all(users.map(u => u.ctx.close().catch(() => {}))),
    new Promise(r => setTimeout(r, 8000)),
  ])
  await Promise.all(users.map(u => apiDeleteAccount(u.accessToken)))
}

async function openPrivateChat(page: Page, targetUsername: string) {
  await page.goto('/friends')
  await page.locator('.list-item').filter({ hasText: targetUsername }).click()
  await page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await page.waitForTimeout(500)
}

// BN01：在消息列表页点浏览器返回，URL 保持 /chat 不变
test('BN01: 消息列表页点浏览器返回保持在 /chat', async ({ browser }) => {
  const u = await setupUser(browser, 'bn01')
  try {
    await u.page.waitForTimeout(500)
    await u.page.goBack()
    await u.page.waitForTimeout(500)
    expect(u.page.url()).toContain('/chat')
    await expect(u.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u])
  }
})

// BN02：连续多次点浏览器返回，始终停在 /chat
test('BN02: 连续多次点返回始终停在 /chat', async ({ browser }) => {
  const u = await setupUser(browser, 'bn02')
  try {
    await u.page.waitForTimeout(500)
    for (let i = 0; i < 5; i++) {
      await u.page.goBack()
      await u.page.waitForTimeout(300)
    }
    expect(u.page.url()).toContain('/chat')
    await expect(u.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u])
  }
})

// BN03：在消息列表进入聊天页后点浏览器返回，回到消息列表
test('BN03: 从消息列表进入聊天页点浏览器返回回到 /chat', async ({ browser }) => {
  const [u1, u2] = await Promise.all([
    setupUser(browser, 'bn03a'),
    setupUser(browser, 'bn03b'),
  ])
  try {
    await u1.page.waitForTimeout(1000)
    // 先通过 friends 建立会话，再回到 /chat，再从列表进入聊天
    await openPrivateChat(u1.page, u2.username)
    await u1.page.waitForURL('**/chat/**')
    await u1.page.locator('.chat-header .icon-btn').first().click()
    await u1.page.waitForURL('**/chat')
    await u1.page.waitForTimeout(300)
    // 现在从消息列表点进聊天（不经过 /friends）
    await u1.page.locator('.list-item').first().click()
    await u1.page.waitForURL('**/chat/**')
    // 点浏览器返回应该回到 /chat
    await u1.page.goBack()
    await u1.page.waitForTimeout(600)
    expect(u1.page.url()).toMatch(/\/chat$/)
    await expect(u1.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u1, u2])
  }
})

// BN04：聊天页点 ← 按钮返回列表后，浏览器返回仍停在 /chat
test('BN04: 点←按钮返回后浏览器返回停在 /chat', async ({ browser }) => {
  const [u1, u2] = await Promise.all([
    setupUser(browser, 'bn04a'),
    setupUser(browser, 'bn04b'),
  ])
  try {
    await u1.page.waitForTimeout(1000)
    await openPrivateChat(u1.page, u2.username)
    await u1.page.waitForURL('**/chat/**')
    await u1.page.locator('.chat-header .icon-btn').first().click()
    await u1.page.waitForURL('**/chat')
    await u1.page.waitForTimeout(500)
    await u1.page.goBack()
    await u1.page.waitForTimeout(500)
    expect(u1.page.url()).toContain('/chat')
    await expect(u1.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u1, u2])
  }
})

// BN05：切换到其他 tab 再切回消息页，点返回仍停在 /chat
test('BN05: 切换 tab 后点返回停在 /chat', async ({ browser }) => {
  const u = await setupUser(browser, 'bn05')
  try {
    await u.page.locator('.nav-item').nth(1).click()
    await u.page.waitForURL('**/friends')
    await u.page.locator('.nav-item').nth(0).click()
    await u.page.waitForURL('**/chat')
    await u.page.waitForTimeout(500)
    await u.page.goBack()
    await u.page.waitForTimeout(500)
    expect(u.page.url()).toContain('/chat')
    await expect(u.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u])
  }
})

// BN06：多次进出聊天页后返回键最终停在 /chat
test('BN06: 多次进出聊天页后返回键停在 /chat', async ({ browser }) => {
  const [u1, u2] = await Promise.all([
    setupUser(browser, 'bn06a'),
    setupUser(browser, 'bn06b'),
  ])
  try {
    await u1.page.waitForTimeout(1000)
    for (let i = 0; i < 3; i++) {
      await openPrivateChat(u1.page, u2.username)
      await u1.page.waitForURL('**/chat/**')
      await u1.page.locator('.chat-header .icon-btn').first().click()
      await u1.page.waitForURL('**/chat')
      await u1.page.waitForTimeout(300)
    }
    await u1.page.goBack()
    await u1.page.waitForTimeout(500)
    expect(u1.page.url()).toContain('/chat')
  } finally {
    await teardown([u1, u2])
  }
})

// BN07：消息列表页标题「消息」可见且点返回后仍可见
test('BN07: 点返回后消息列表标题仍可见', async ({ browser }) => {
  const u = await setupUser(browser, 'bn07')
  try {
    await u.page.waitForTimeout(500)
    await u.page.goBack()
    await u.page.waitForTimeout(500)
    await expect(u.page.locator('.page-header h2', { hasText: '消息' })).toBeVisible()
  } finally {
    await teardown([u])
  }
})

// BN08：刷新后在消息列表页点返回，仍停在 /chat
test('BN08: 刷新后点返回仍停在 /chat', async ({ browser }) => {
  const u = await setupUser(browser, 'bn08')
  try {
    await u.page.reload()
    await u.page.waitForURL(/\/chat/, { timeout: 20000 })
    await expect(u.page.locator('.bottom-nav')).toBeVisible({ timeout: 25000 })
    await u.page.waitForFunction(
      () => document.body.getAttribute('data-ws-ready') === 'true',
      { timeout: 30000 }
    )
    await u.page.waitForTimeout(500)
    await u.page.goBack()
    await u.page.waitForTimeout(500)
    expect(u.page.url()).toContain('/chat')
    await expect(u.page.locator('.bottom-nav')).toBeVisible()
  } finally {
    await teardown([u])
  }
})
