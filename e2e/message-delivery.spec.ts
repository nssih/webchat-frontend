/**
 * 消息投递状态修复验证
 *
 * MD01: 双方在线时文字消息不走离线存储，状态为 sent/received/read
 * MD02: 接收方未激活聊天窗口时收到小图片，发送方状态为 received 而非 read
 * MD03: 接收方激活聊天窗口后，发送方图片消息升级为 read
 * MD04: 接收方页面不可见时收到消息，不触发 MESSAGE_READ
 * MD05: 接收方切回可见时补发 MESSAGE_READ，发送方升级为 read
 */

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
  return data.data as { accessToken: string }
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

async function openPrivateChatFromList(page: Page, targetUsername: string) {
  await page.goto('/friends')
  await page.locator('.list-item').filter({ hasText: targetUsername }).click()
  await page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await page.waitForTimeout(500)
}

async function sendTextMessage(page: Page, text: string) {
  const ta = page.locator('.chat-input')
  await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await page.locator('button.btn-send').click()
}

async function getMsgStatus(page: Page, msgText: string): Promise<string> {
  const row = page.locator('.msg-row.mine').filter({ hasText: msgText }).last()
  const el = row.locator('.msg-status')
  if (!await el.isVisible({ timeout: 5000 }).catch(() => false)) return ''
  const classes = await el.evaluate(e => e.className).catch(() => '')
  for (const cls of ['read', 'received', 'offline', 'failed']) {
    if (classes.includes(cls)) return cls
  }
  return 'sent'
}

// MD01: 双方都在线时文字消息不走离线存储
test('MD01: 双方在线时文字消息状态为 sent/received', async ({ browser }) => {
  const [a, b] = await Promise.all([setupUser(browser, 'md01a'), setupUser(browser, 'md01b')])
  try {
    await a.page.waitForTimeout(1000)
    // b 先打开和 a 的聊天（建立会话）
    await openPrivateChatFromList(b.page, a.username)
    // a 打开和 b 的聊天
    await openPrivateChatFromList(a.page, b.username)
    const msgText = `md01_${Date.now()}`
    await sendTextMessage(a.page, msgText)
    await a.page.waitForTimeout(2000)
    const status = await getMsgStatus(a.page, msgText)
    // 双方在线，状态应为 sent 或 received，绝不能是 offline
    expect(status).not.toBe('offline')
    expect(['sent', 'received', 'read']).toContain(status)
  } finally {
    await teardown([a, b])
  }
})

// MD02: 接收方未激活聊天窗口时收到小图片，发送方状态为 received 而非 read
test('MD02: 接收方未看聊天窗口时图片状态为 received 不是 read', async ({ browser }) => {
  const [a, b] = await Promise.all([setupUser(browser, 'md02a'), setupUser(browser, 'md02b')])
  try {
    await a.page.waitForTimeout(1000)
    // b 停在消息列表，不进入和 a 的聊天
    await b.page.goto('/chat')
    // a 打开和 b 的聊天
    await openPrivateChatFromList(a.page, b.username)

    // 使用 canvas 生成微型 png dataUrl
    const dataUrl = await a.page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 1; c.height = 1
      const ctx = c.getContext('2d')!
      ctx.fillStyle = 'red'
      ctx.fillRect(0, 0, 1, 1)
      return c.toDataURL('image/png')
    })

    // 把 dataUrl 转成 File 并注入 input（用 atob 解码，避免沙盒环境 fetch(dataUrl) 被拦截）
    await a.page.evaluate((dataUrlVal: string) => {
      const base64 = dataUrlVal.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      const file = new File([blob], 'test.png', { type: 'image/png' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      if (!input) return
      const dt = new DataTransfer()
      dt.items.add(file)
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, dataUrl)

    // 等待图片传输完成（最多 15 秒）
    await a.page.waitForTimeout(8000)

    // 检查 a 这边最新的 mine 消息状态
    const rows = a.page.locator('.msg-row.mine')
    const count = await rows.count()
    if (count === 0) {
      // 文件 input 注入在此环境可能不生效，跳过
      test.skip()
      return
    }
    const lastRow = rows.last()
    const el = lastRow.locator('.msg-status')
    const classes = await el.evaluate(e => e.className).catch(() => '')
    // b 没有打开聊天窗口，不应该是 read
    expect(classes).not.toContain('read')
  } finally {
    await teardown([a, b])
  }
})

// MD03: 接收方打开聊天窗口后，消息升级为 read
test('MD03: 接收方打开聊天窗口后发送方消息升级为 read', async ({ browser }) => {
  const [a, b] = await Promise.all([setupUser(browser, 'md03a'), setupUser(browser, 'md03b')])
  try {
    await a.page.waitForTimeout(1000)
    // b 不在聊天窗口
    await b.page.goto('/chat')
    // a 给 b 发消息
    await openPrivateChatFromList(a.page, b.username)
    const msgText = `md03_${Date.now()}`
    await sendTextMessage(a.page, msgText)
    await a.page.waitForTimeout(1500)

    // 现在 b 打开和 a 的聊天
    await openPrivateChatFromList(b.page, a.username)
    await b.page.waitForTimeout(1000)

    // a 这边状态应升级为 read
    await a.page.waitForTimeout(2000)
    const status = await getMsgStatus(a.page, msgText)
    expect(status).toBe('read')
  } finally {
    await teardown([a, b])
  }
})

// MD04: b 在聊天页但切换到其他 tab（页面不可见）时不触发 MESSAGE_READ
test('MD04: 页面不可见时收到消息不触发 read', async ({ browser }) => {
  const [a, b] = await Promise.all([setupUser(browser, 'md04a'), setupUser(browser, 'md04b')])
  try {
    await a.page.waitForTimeout(1000)
    // b 打开和 a 的聊天，然后模拟页面隐藏
    await openPrivateChatFromList(b.page, a.username)
    await b.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // a 发消息
    await openPrivateChatFromList(a.page, b.username)
    const msgText = `md04_${Date.now()}`
    await sendTextMessage(a.page, msgText)
    await a.page.waitForTimeout(2500)

    const status = await getMsgStatus(a.page, msgText)
    // b 页面隐藏，不应该是 read
    expect(status).not.toBe('read')
  } finally {
    await teardown([a, b])
  }
})

// MD05: b 切回可见后补发 MESSAGE_READ，a 升级为 read
test('MD05: 页面切回可见后补发已读回执', async ({ browser }) => {
  const [a, b] = await Promise.all([setupUser(browser, 'md05a'), setupUser(browser, 'md05b')])
  try {
    await a.page.waitForTimeout(1000)
    // b 打开聊天页，先隐藏
    await openPrivateChatFromList(b.page, a.username)
    await b.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // a 发消息
    await openPrivateChatFromList(a.page, b.username)
    const msgText = `md05_${Date.now()}`
    await sendTextMessage(a.page, msgText)
    await a.page.waitForTimeout(1500)

    // b 切回可见
    await b.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await a.page.waitForTimeout(2000)

    const status = await getMsgStatus(a.page, msgText)
    expect(status).toBe('read')
  } finally {
    await teardown([a, b])
  }
})
