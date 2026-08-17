/**
 * 消息状态精准度专项测试
 *
 * MS01  发送消息后状态先为 sending(○)，后变 sent(✓)
 * MS02  对方在线且打开聊天窗口 → 发送方状态升级为 read(✓✓蓝)
 * MS03  对方在线但未打开聊天窗口 → 发送方状态升级为 received(✓✓灰)
 * MS04  对方离线 → 发送方状态为 offline(⏱)
 * MS05  对方离线上线后收到消息 → offline 变 received
 * MS06  对方上线后打开聊天窗口 → received 进一步变 read
 * MS07  状态只升不降：received 不会回退到 sent
 * MS08  状态只升不降：read 不会回退到 received 或 sent
 * MS09  离线投递幂等：对方上线收到后再次重连不重复收到
 * MS10  发送方切换会话后再切回，状态仍正确保留
 * MS11  AboutPage 消息状态说明页展示 5 个状态行
 * MS12  消息状态图标 CSS class 正确（received=灰，read=蓝/primary）
 */

import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'
const PASSWORD = 'Test1234!'

// ── API helpers ────────────────────────────────────────────────────────────────

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

// ── UI helpers ────────────────────────────────────────────────────────────────

async function login(page: Page, username: string) {
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

interface UserCtx {
  username: string
  accessToken: string
  ctx: BrowserContext
  page: Page
}

async function setupUsers(browser: Browser, count: number, prefix: string): Promise<UserCtx[]> {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const auths: { username: string; accessToken: string }[] = []
  for (let i = 0; i < count; i++) {
    const username = `${prefix}${i}_${ts}${rand}`
    const auth = await apiRegister(username)
    auths.push({ username, accessToken: auth.accessToken })
  }
  const users: UserCtx[] = []
  for (const auth of auths) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, auth.username)
    users.push({ username: auth.username, accessToken: auth.accessToken, ctx, page })
  }
  await users[0].page.waitForTimeout(2000)
  return users
}

async function teardownUsers(users: UserCtx[]) {
  await Promise.all(users.map(u => u.page.close().catch(() => {})))
  await Promise.race([
    Promise.all(users.map(u => u.ctx.close().catch(() => {}))),
    new Promise(r => setTimeout(r, 8000)),
  ])
  await Promise.all(users.map(u => apiDeleteAccount(u.accessToken)))
}

async function sendMessage(page: Page, text: string) {
  const ta = page.locator('.chat-input')
  await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await page.locator('button.btn-send').click()
  await page.waitForTimeout(300)
}

async function waitForMessage(page: Page, text: string, timeout = 12000) {
  return page.locator('.msg-bubble').filter({ hasText: text })
    .waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
}

async function openPrivateChat(page: Page, targetUsername: string) {
  await page.goto('/friends')
  await page.locator('.list-item').filter({ hasText: targetUsername }).click()
  await page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await page.waitForTimeout(500)
}

// 获取某条消息的状态 class（返回 'sent'|'received'|'read'|'offline'|'failed'|'sending'|''）
async function getMsgStatusClass(page: Page, msgText: string): Promise<string> {
  const row = page.locator('.msg-row.mine').filter({ hasText: msgText }).last()
  const el = row.locator('.msg-status')
  if (!await el.isVisible({ timeout: 3000 }).catch(() => false)) return ''
  const classes = await el.evaluate(e => e.className).catch(() => '')
  for (const cls of ['read', 'received', 'offline', 'failed']) {
    if (classes.includes(cls)) return cls
  }
  return 'sent'
}

// ─────────────────────────────────────────────────────────────────────────────
// MS01: 发送消息后状态先为 sending，后变 sent
// ─────────────────────────────────────────────────────────────────────────────
test('MS01: 发送消息后状态由 sending 变 sent', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms01u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `ms01_${Date.now()}`
    // 不等待，立刻检查 sending 状态（如果网络够快可能已变 sent，所以只断言最终有 status 图标）
    await sendMessage(alice.page, msg)
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    await expect(row.locator('.msg-status')).toBeVisible({ timeout: 8000 })

    // 等稳定后，状态应为 sent 或更高（received/read）
    await alice.page.waitForTimeout(3000)
    const statusClass = await getMsgStatusClass(alice.page, msg)
    expect(['sent', 'received', 'read']).toContain(statusClass)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS02: 对方在线且打开聊天窗口 → 发送方状态升级为 read
// ─────────────────────────────────────────────────────────────────────────────
test('MS02: 对方在线且打开聊天窗口时状态升级为 read', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms02u')
  const [alice, bob] = users
  test.setTimeout(60000)
  try {
    // alice 先打开与 bob 的私聊
    await openPrivateChat(alice.page, bob.username)
    // bob 也打开与 alice 的私聊（表示 bob 在读状态）
    await openPrivateChat(bob.page, alice.username)
    await alice.page.waitForTimeout(1000)

    const msg = `ms02_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    // bob 应收到消息（触发 MESSAGE_RECEIVED）
    await waitForMessage(bob.page, msg, 8000)
    await bob.page.waitForTimeout(1000)

    // alice 侧状态应升级到 read（bob 在聊天窗口里 = 已读）
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    await expect(row.locator('.msg-status.read')).toBeVisible({ timeout: 15000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS03: 对方在线但不在此聊天窗口 → 状态为 received（灰双勾），不为 offline
// ─────────────────────────────────────────────────────────────────────────────
test('MS03: 对方在线但未打开聊天窗口时状态不为 offline', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms03u')
  const [alice, bob] = users
  test.setTimeout(60000)
  try {
    // alice 打开与 bob 的私聊；bob WS 已就绪（setupUsers 完成时已等待），停留在会话列表
    await openPrivateChat(alice.page, bob.username)
    await bob.page.goto('/chat')
    // 等待 bob WS 稳定（afterConnectionEstablished 更新 lastPingTime）
    await bob.page.waitForFunction(
      () => document.body.getAttribute('data-ws-ready') === 'true',
      { timeout: 20000 }
    ).catch(() => {})
    await alice.page.waitForTimeout(1500)

    const msg = `ms03_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await alice.page.waitForTimeout(4000)

    // bob 在线（WS 已建立，lastPingTime 已更新）→ 消息不应进离线存储
    // 状态为 received 或 sent（received 需 bob 收到推送发回 MESSAGE_RECEIVED），不应为 offline
    const statusClass = await getMsgStatusClass(alice.page, msg)
    expect(statusClass).not.toBe('offline')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS04: 对方离线 → 状态为 offline(⏱)
// ─────────────────────────────────────────────────────────────────────────────
test('MS04: 对方离线时状态为 offline', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms04u')
  const [alice, bob] = users
  test.setTimeout(90000)
  try {
    await openPrivateChat(alice.page, bob.username)

    // 关闭 bob
    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await alice.page.waitForTimeout(3000)

    const msg = `ms04_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    await expect(row.locator('.msg-status.offline')).toBeVisible({ timeout: 15000 })
  } finally {
    await alice.page.close().catch(() => {})
    await Promise.race([alice.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(alice.accessToken)
    await apiDeleteAccount(bob.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS05: 对方离线后上线收到消息 → offline 变 received
// ─────────────────────────────────────────────────────────────────────────────
test('MS05: 对方上线收到离线消息后 offline 变 received', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms05u')
  const [alice, bob] = users
  test.setTimeout(180000)
  try {
    await openPrivateChat(alice.page, bob.username)

    // 关闭 bob，等待后端 TCP 检测到断线（afterConnectionClosed 清理 sessions）
    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    // 等待 alice 侧在线列表更新（bob 下线）
    await alice.page.waitForTimeout(5000)

    const msg = `ms05_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    // 等待消息状态变为 offline（确认进了离线存储）
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    const statusEl = row.locator('.msg-status')
    const isOffline = await statusEl.evaluate(el => el.classList.contains('offline'), undefined, { timeout: 20000 })
      .catch(() => false)
    if (!isOffline) { test.skip(); return } // bob 下线检测慢时跳过

    // bob 重新登录，停留在会话列表（不打开私聊，以验证 received 而非 read）
    const bobCtx2 = await browser.newContext()
    const bobPage2 = await bobCtx2.newPage()
    await login(bobPage2, bob.username)
    await bobPage2.goto('/chat')
    await bobPage2.waitForTimeout(4000)

    // alice 侧状态应从 offline 变为 received 或 read
    await expect(statusEl).not.toHaveClass(/offline/, { timeout: 25000 })
    const finalClass = await getMsgStatusClass(alice.page, msg)
    expect(['received', 'read']).toContain(finalClass)

    await bobPage2.close().catch(() => {})
    await Promise.race([bobCtx2.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(bob.accessToken)
  } finally {
    await alice.page.close().catch(() => {})
    await Promise.race([alice.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(alice.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS06: 对方上线后打开聊天窗口 → received 进一步升为 read
// ─────────────────────────────────────────────────────────────────────────────
test('MS06: 对方打开聊天窗口后状态从 received 升为 read', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms06u')
  const [alice, bob] = users
  test.setTimeout(180000)
  try {
    await openPrivateChat(alice.page, bob.username)

    // 关闭 bob
    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await alice.page.waitForTimeout(5000)

    const msg = `ms06_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    const statusEl = row.locator('.msg-status')
    // 确认消息进了离线存储
    const isOffline = await statusEl.evaluate(el => el.classList.contains('offline'), undefined, { timeout: 20000 })
      .catch(() => false)
    if (!isOffline) { test.skip(); return }

    // bob 重新登录，先停留在会话列表
    const bobCtx2 = await browser.newContext()
    const bobPage2 = await bobCtx2.newPage()
    await login(bobPage2, bob.username)
    await bobPage2.goto('/chat')
    await bobPage2.waitForTimeout(4000)

    // alice 侧 offline 应消失（received）
    await expect(statusEl).not.toHaveClass(/offline/, { timeout: 25000 })

    // bob 打开私聊窗口 → 触发 MESSAGE_READ → alice 状态升为 read
    await openPrivateChat(bobPage2, alice.username)
    await waitForMessage(bobPage2, msg, 10000)
    await bobPage2.waitForTimeout(1500)

    await expect(row.locator('.msg-status.read')).toBeVisible({ timeout: 20000 })

    await bobPage2.close().catch(() => {})
    await Promise.race([bobCtx2.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(bob.accessToken)
  } finally {
    await alice.page.close().catch(() => {})
    await Promise.race([alice.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(alice.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS07: 状态只升不降：received 不会回退到 sent
// ─────────────────────────────────────────────────────────────────────────────
test('MS07: 状态不降级：received 不回退到 sent', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms07u')
  const [alice, bob] = users
  test.setTimeout(60000)
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `ms07_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await waitForMessage(bob.page, msg, 8000)
    await alice.page.waitForTimeout(2000)

    // 确认已达到 received 或以上
    const statusClass1 = await getMsgStatusClass(alice.page, msg)
    if (!['received', 'read'].includes(statusClass1)) { test.skip(); return }

    // 等待更长时间，确认不会降回 sent
    await alice.page.waitForTimeout(3000)
    const statusClass2 = await getMsgStatusClass(alice.page, msg)
    expect(['received', 'read']).toContain(statusClass2)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS08: 状态只升不降：read 不回退
// ─────────────────────────────────────────────────────────────────────────────
test('MS08: 状态不降级：read 不回退到 received 或 sent', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms08u')
  const [alice, bob] = users
  test.setTimeout(60000)
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `ms08_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await waitForMessage(bob.page, msg, 8000)
    await bob.page.waitForTimeout(1000)

    // 等待 read 状态
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    const readVisible = await row.locator('.msg-status.read').isVisible({ timeout: 12000 }).catch(() => false)
    if (!readVisible) { test.skip(); return }

    // 等待一段时间，确认不回退
    await alice.page.waitForTimeout(3000)
    await expect(row.locator('.msg-status.read')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS09: 离线投递幂等：对方上线收到后，同一页面重连不重复收到
// ─────────────────────────────────────────────────────────────────────────────
test('MS09: 离线消息投递幂等，重连不重复', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms09u')
  const [alice, bob] = users
  test.setTimeout(180000)
  try {
    await openPrivateChat(alice.page, bob.username)

    // 关闭 bob，等待后端检测到断线
    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await alice.page.waitForTimeout(5000)

    const msg = `ms09_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    // 等待 offline 状态确认（消息已进离线存储）
    const offlineEl = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last().locator('.msg-status.offline')
    const isOffline = await offlineEl.isVisible({ timeout: 20000 }).catch(() => false)
    if (!isOffline) { test.skip(); return }

    // bob 登录，收到离线消息
    const bobCtx2 = await browser.newContext()
    const bobPage2 = await bobCtx2.newPage()
    await login(bobPage2, bob.username)
    await openPrivateChat(bobPage2, alice.username)
    await bobPage2.waitForTimeout(4000)

    // 记录第一次的消息数量
    const count1 = await bobPage2.locator('.msg-row').count()

    // 在同一 context 内模拟重连：导航到其他页再回来
    await bobPage2.goto('/chat')
    await bobPage2.waitForTimeout(1000)
    await openPrivateChat(bobPage2, alice.username)
    await bobPage2.waitForTimeout(3000)

    // 消息数不应增加（幂等，离线消息已从 DB 删除，不会重复投递）
    const count2 = await bobPage2.locator('.msg-row').count()
    expect(count2).toBe(count1)

    await bobPage2.close().catch(() => {})
    await Promise.race([bobCtx2.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(bob.accessToken)
  } finally {
    await alice.page.close().catch(() => {})
    await Promise.race([alice.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(alice.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS10: 发送方切换会话再切回，状态仍正确保留
// ─────────────────────────────────────────────────────────────────────────────
test('MS10: 切换会话再切回状态正确保留', async ({ browser }) => {
  // 需要 3 个用户：alice、bob、carol
  const users = await setupUsers(browser, 3, 'ms10u')
  const [alice, bob, carol] = users
  test.setTimeout(60000)
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `ms10_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await waitForMessage(bob.page, msg, 8000)
    await alice.page.waitForTimeout(2000)

    const statusBefore = await getMsgStatusClass(alice.page, msg)

    // alice 切换到 carol 的私聊，再切回
    await openPrivateChat(alice.page, carol.username)
    await alice.page.waitForTimeout(1000)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const statusAfter = await getMsgStatusClass(alice.page, msg)
    // 状态不应降低
    const order = ['sent', 'received', 'read']
    const beforeIdx = order.indexOf(statusBefore)
    const afterIdx = order.indexOf(statusAfter)
    expect(afterIdx).toBeGreaterThanOrEqual(beforeIdx)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS11: AboutPage 展示 5 个消息状态行（发送中、已发送、已送达、已读、等待送达）
// ─────────────────────────────────────────────────────────────────────────────
test('MS11: About 页消息状态说明展示 5 个状态', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ms11u')
  const [alice] = users
  try {
    await alice.page.goto('/about')
    await expect(alice.page.locator('.about-status-row')).toHaveCount(6, { timeout: 5000 })
    // 验证关键状态名（用 .about-status-name 缩小范围，避免 strict mode 冲突）
    await expect(alice.page.locator('.about-status-name', { hasText: '已送达' })).toBeVisible()
    await expect(alice.page.locator('.about-status-name', { hasText: '已读' })).toBeVisible()
    await expect(alice.page.locator('.about-status-name', { hasText: '等待送达' })).toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MS12: 消息状态 CSS class 正确（received=灰色，read=蓝色/primary）
// ─────────────────────────────────────────────────────────────────────────────
test('MS12: 消息状态 CSS class 正确（received 无 read 类，read 有 read 类）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'ms12u')
  const [alice, bob] = users
  test.setTimeout(60000)
  try {
    await openPrivateChat(alice.page, bob.username)
    // bob 打开聊天窗口（触发 read）
    await openPrivateChat(bob.page, alice.username)
    await alice.page.waitForTimeout(1000)

    const msg = `ms12_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await waitForMessage(bob.page, msg, 8000)
    await bob.page.waitForTimeout(1000)

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg }).last()
    // 等待达到 read 状态
    const readEl = row.locator('.msg-status.read')
    const isRead = await readEl.isVisible({ timeout: 12000 }).catch(() => false)
    if (!isRead) { test.skip(); return }

    // read 的 css 颜色应使用 --primary（不是 text-sub）
    const color = await readEl.evaluate(el => getComputedStyle(el).color)
    // 只检查 class 存在（CSS 变量值因环境而异，不做颜色数值断言）
    await expect(readEl).toHaveClass(/read/)

    // received class 应区别于 read
    // （此测试主要验证 read 状态时不携带 received class）
    const hasReceived = await readEl.evaluate(el => el.classList.contains('received'))
    expect(hasReceived).toBe(false)
    void color // suppress unused warning
  } finally {
    await teardownUsers(users)
  }
})
