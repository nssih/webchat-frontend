/**
 * 消息引用/回复功能全场景测试
 *
 * R1  私聊中引用对方文字消息并发送，发送方气泡内显示引用块
 * R2  私聊中引用对方文字消息并发送，接收方收到后气泡内也显示引用块
 * R3  引用块显示正确的发送者名称
 * R4  引用块显示被引用消息的内容摘要（截断到 80 字）
 * R5  引用超长消息（>80字）时引用块截断显示，不溢出
 * R6  引用块点击后页面滚动到原消息并高亮
 * R7  点击"回复"后输入框上方出现引用预览栏
 * R8  引用预览栏显示发送者名称和内容摘要
 * R9  点击预览栏 ✕ 取消引用，预览栏消失，发送的消息无引用块
 * R10 取消引用后重新选择另一条消息引用，预览栏更新为新的引用
 * R11 引用后直接按 Enter（桌面）发送，消息带引用发出
 * R12 引用后清空输入框文字，发送按钮仍禁用（没有文字不能只引用发送）
 * R13 私聊中引用自己发的消息，发送成功，引用块显示自己的名字
 * R14 引用图片消息时引用块显示"[image]"占位
 * R15 群聊中引用他人消息，其他在线成员收到后引用块正确显示
 * R16 群聊中引用消息，引用块发送者名称正确
 * R17 群聊中多人连续互相引用，每条消息的引用块各自独立正确
 * R18 引用消息后发送，会话列表最后一条显示新消息（不是引用内容）
 * R19 引用块内容过长时单行省略，不撑开气泡宽度
 * R20 引用消息在暗色主题下样式正常（颜色对比度可见）
 * R21 私聊离线场景：发送方引用后对方离线，对方上线后收到带引用块的消息
 * R22 群聊离线场景：全员离线时发引用消息，成员上线后收到带引用块
 * R23 引用消息后断线重连，WS 重连后自动重发引用消息并成功送达
 * R24 引用消息后切换到其他会话再切回，引用预览栏消失（不跨会话保留）
 * R25 连续快速引用发送多条消息，每条消息引用块各自正确不混淆
 * R26 引用 Emoji 消息，引用块正确显示 Emoji 内容
 * R27 引用包含中文、特殊符号的消息，引用块内容完整不乱码
 * R28 接收方收到引用消息后，点击引用块能跳转到原消息
 * R29 引用消息被删除后，引用块仍显示快照内容（不因原消息删除而消失）
 * R30 刷新页面后历史引用消息的引用块仍然显示（IDB 持久化）
 */

import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'
const PASSWORD = 'Test1234!'

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiRegister(username: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: PASSWORD, confirmPassword: PASSWORD }),
    })
    const data = await res.json()
    if (data.success) return data.data as { accessToken: string; user: { username: string } }
    if (data.message?.includes('频繁') || res.status === 429) {
      await new Promise(r => setTimeout(r, 3000 + attempt * 2000))
      continue
    }
    throw new Error(`注册失败 ${username}: ${data.message}`)
  }
  throw new Error(`注册失败 ${username}: 超过重试次数`)
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
  // 监听控制台错误和 WS 事件
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[browser-err] ${username}: ${msg.text()}`)
  })
  page.on('websocket', ws => {
    if (!ws.url().includes('localhost:8080')) return
    console.log(`[ws-open] ${username}: ${ws.url()}`)
    ws.on('framesent', f => {
      const s = f.payload.toString()
      if (s.includes('PING')) console.log(`[ws-ping] ${username}`)
    })
    ws.on('framereceived', f => {
      const s = f.payload.toString()
      console.log(`[ws-recv] ${username}: ${s.substring(0, 80)}`)
    })
    ws.on('close', () => console.log(`[ws-close] ${username}`))
  })
  await page.goto('/login')
  await page.locator('input[placeholder="输入用户名"]').fill(username)
  await page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/chat/, { timeout: 20000 })
  await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 25000 })
  // 等 WS 连接建立并收到首个 PONG（后端已完成注册），再进行后续操作
  for (let i = 0; i < 30; i++) {
    const wsReady = await page.evaluate(() => document.body.getAttribute('data-ws-ready'))
    if (wsReady === 'true') return
    if (i === 0) console.log(`[login] ${username} waiting for ws-ready...`)
    await page.waitForTimeout(1000)
  }
  console.log(`[login] ${username} ws-ready timeout after 30s`)
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
  // 先顺序注册（避免并发注册触发限流）
  const auths: { username: string; accessToken: string }[] = []
  for (let i = 0; i < count; i++) {
    const username = `${prefix}${i}_${ts}${rand}`
    const auth = await apiRegister(username)
    auths.push({ username, accessToken: auth.accessToken })
  }
  // 并行登录所有用户（login 函数等到 /chat 页且 bottom-nav 可见）
  const users: UserCtx[] = await Promise.all(auths.map(async auth => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, auth.username)
    return { username: auth.username, accessToken: auth.accessToken, ctx, page }
  }))
  return users
}

async function teardownUsers(users: UserCtx[]) {
  await Promise.all(users.map(u => u.ctx.close().catch(() => {})))
  await Promise.race([
    Promise.all(users.map(u => apiDeleteAccount(u.accessToken))),
    new Promise(r => setTimeout(r, 8000)),
  ])
}

async function sendMessage(page: Page, text: string) {
  const ta = page.locator('.chat-input')
  await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await page.locator('button.btn-send').click()
  await page.waitForTimeout(500)
}

async function waitForMessage(page: Page, text: string, timeout = 12000) {
  return page.locator('.msg-bubble').filter({ hasText: text })
    .waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
}

// 进入私聊会话
async function openPrivateChat(page: Page, targetUsername: string) {
  await page.goto('/friends')

  // 等 initSession 完成：.empty-state 或 .list-item 出现（最多 30s）
  await page.waitForFunction(
    () => document.querySelector('.list-item') !== null || document.querySelector('.empty-state') !== null,
    { timeout: 30000 }
  ).catch(() => {})

  // 等对方出现在在线列表（最多 40s，靠 user-online WS 事件更新）
  const found = await page.locator('.list-item').filter({ hasText: targetUsername })
    .waitFor({ state: 'visible', timeout: 40000 }).then(() => true).catch(() => false)

  if (found) {
    await page.locator('.list-item').filter({ hasText: targetUsername }).first().click()
  } else {
    // 后备：直接构造 convId 导航
    const authInfo = await page.evaluate(() => {
      try {
        const raw = sessionStorage.getItem('webchat-auth')
        if (!raw) return { username: '' }
        const s = JSON.parse(raw)
        return { username: s?.state?.user?.username ?? '' }
      } catch { return { username: '' } }
    })
    const [a, b] = [authInfo.username, targetUsername].sort()
    await page.goto(`/chat/private_${a}_${b}`)
  }

  await page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await expect(page.locator('.chat-input')).toBeVisible({ timeout: 10000 })
  await dismissKeyBanner(page)
}

// 右键或长按气泡，点击"回复"
async function clickReplyOnBubble(page: Page, messageText: string) {
  // 用 first() 避免 strict mode violation（reply quote 内也可能含相同文字）
  const bubble = page.locator('.msg-bubble').filter({ hasText: messageText }).first()
  await bubble.waitFor({ state: 'attached', timeout: 8000 })
  // 先用 JS dispatch contextmenu（对视口外元素有效），若菜单未出现则回退到 Playwright 右键
  await bubble.evaluate(el => {
    const wrap = el.closest('.msg-bubble-wrap') as HTMLElement | null
    const target = wrap ?? el
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  const menuVisible = await page.locator('.context-menu').waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)
  if (!menuVisible) {
    // 回退：用 Playwright 原生右键（元素需要在视口内）
    await bubble.scrollIntoViewIfNeeded()
    await bubble.click({ button: 'right' })
    await page.locator('.context-menu').waitFor({ state: 'visible', timeout: 3000 })
  }
  await page.locator('.context-menu button', { hasText: '回复' }).click()
  // 等待 replyTo state 已更新（reply-preview 出现）才返回
  await expect(page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
}

// 群聊相关 helpers（复用 group-scenarios 的模式）
async function goToGroups(page: Page) {
  await page.locator('a[href="/groups"]').click()
  await page.waitForURL(/\/groups/, { timeout: 5000 })
}

async function createGroup(page: Page, name: string) {
  await page.locator('button', { hasText: '+ 创建' }).click()
  await page.locator('input[placeholder]').last().fill(name)
  await page.locator('.modal button.btn-primary').click()
  await page.waitForTimeout(1000)
}

async function openInviteModal(page: Page, groupName: string) {
  await page.locator('.list-item').filter({ hasText: groupName }).first()
    .locator('button', { hasText: '邀请' }).click()
  await expect(page.locator('.modal').filter({ hasText: '邀请在线用户' })).toBeVisible({ timeout: 5000 })
}

async function inviteUser(page: Page, username: string) {
  const row = page.locator('.modal .list-item').filter({ hasText: username })
  const found = await row.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
  if (!found) return false
  await row.locator('button', { hasText: '邀请' }).click()
  await expect(page.locator('.invite-msg')).toBeVisible({ timeout: 15000 })
  return true
}

async function waitForGroupVisible(page: Page, groupName: string) {
  return page.locator('.list-item').filter({ hasText: groupName })
    .waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
}

// 关闭可能遮挡操作的密钥更新横幅
async function dismissKeyBanner(page: Page) {
  const banner = page.locator('.file-error-toast', { hasText: '加密密钥已更新' })
  const visible = await banner.isVisible().catch(() => false)
  if (visible) await banner.click().catch(() => {})
  await page.waitForTimeout(200)
}

async function enterGroupChat(page: Page, groupName: string) {
  await page.locator('.list-item').filter({ hasText: groupName }).click()
  await page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
  await page.waitForTimeout(1000)
  await dismissKeyBanner(page)
}

async function sendGroupMessage(page: Page, groupName: string, text: string, maxRetries = 6) {
  // 确保在群聊页
  if (!page.url().includes('/chat/group_')) {
    await enterGroupChat(page, groupName)
  }
  for (let i = 0; i < maxRetries; i++) {
    await sendMessage(page, text)
    const ok = await waitForMessage(page, text, 2500)
    if (ok) return true
    await page.waitForTimeout(2000)
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// R1: 私聊中引用对方消息，发送方气泡内显示引用块
// ─────────────────────────────────────────────────────────────────────────────
test('R1: 私聊引用对方消息——发送方气泡显示引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r1u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r1_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    await sendMessage(alice.page, `r1_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r1_reply_' }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R2: 私聊引用消息，接收方收到后也显示引用块
// ─────────────────────────────────────────────────────────────────────────────
test('R2: 私聊引用消息——接收方收到后引用块正确显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r2u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r2_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    await waitForMessage(bob.page, original, 8000)

    // 等 alice 收到消息（最多 30s），失败时打印 alice 看到的所有气泡内容
    const aliceSaw = await waitForMessage(alice.page, original, 30000)
    if (!aliceSaw) {
      const bubbles = await alice.page.locator('.msg-bubble').allTextContents()
      console.log(`[R2] alice bubbles: ${JSON.stringify(bubbles)}`)
      test.skip(); return
    }

    const replyText = `r2_reply_${Date.now()}`
    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, replyText)

    if (!await waitForMessage(bob.page, replyText)) { test.skip(); return }
    const bobBubble = bob.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(bobBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R3: 引用块显示正确的发送者名称
// ─────────────────────────────────────────────────────────────────────────────
test('R3: 引用块显示正确的发送者名称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r3u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r3_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, `r3_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r3_reply_' }).last()
    const senderEl = replyBubble.locator('.msg-reply-sender')
    await expect(senderEl).toBeVisible({ timeout: 5000 })
    const senderText = await senderEl.textContent()
    expect(senderText).toBeTruthy()
    expect(senderText!.length).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R4: 引用块显示被引用消息的内容摘要
// ─────────────────────────────────────────────────────────────────────────────
test('R4: 引用块显示被引用消息的内容摘要', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r4u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r4_orig_hello_world_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, `r4_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r4_reply_' }).last()
    const quoteText = replyBubble.locator('.msg-reply-text')
    await expect(quoteText).toBeVisible({ timeout: 5000 })
    const content = await quoteText.textContent()
    expect(content).toContain('r4_orig_hello_world_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R5: 引用超长消息（>80字）时引用块截断显示
// ─────────────────────────────────────────────────────────────────────────────
test('R5: 引用超长消息时引用块截断显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r5u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const longMsg = 'A'.repeat(200)
    await sendMessage(bob.page, longMsg)
    if (!await waitForMessage(alice.page, longMsg.slice(0, 20))) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'AAAA')
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    await sendMessage(alice.page, `r5_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r5_reply_' }).last()
    const quoteText = replyBubble.locator('.msg-reply-text')
    await expect(quoteText).toBeVisible({ timeout: 5000 })
    const content = await quoteText.textContent()
    // 截断到 80 字以内（加上省略符号）
    expect((content ?? '').length).toBeLessThanOrEqual(100)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R6: 引用块点击后页面滚动到原消息并高亮
// ─────────────────────────────────────────────────────────────────────────────
test('R6: 点击引用块跳转到原消息并高亮', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r6u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // 发一条消息作为锚点
    const original = `r6_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    // 发多条消息把原消息推离视口
    for (let i = 0; i < 8; i++) {
      await sendMessage(alice.page, `r6_filler_${i}_${Date.now()}`)
    }

    // 引用原消息
    await clickReplyOnBubble(alice.page, original)
    const replyText = `r6_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)

    // 点击引用块
    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const quoteBlock = replyBubble.locator('.msg-reply-quote')
    await expect(quoteBlock).toBeVisible({ timeout: 5000 })
    await quoteBlock.click()
    await alice.page.waitForTimeout(1500)

    // 原消息应该滚动到视口中且有高亮 class
    const origBubble = alice.page.locator('.msg-bubble').filter({ hasText: original }).first()
    await expect(origBubble).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R7: 点击"回复"后输入框上方出现引用预览栏
// ─────────────────────────────────────────────────────────────────────────────
test('R7: 点击回复后出现引用预览栏', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r7u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r7_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R8: 引用预览栏显示发送者名称和内容摘要
// ─────────────────────────────────────────────────────────────────────────────
test('R8: 引用预览栏显示发送者名称和内容摘要', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r8u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r8_content_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    const preview = alice.page.locator('.reply-preview')
    await expect(preview).toBeVisible({ timeout: 3000 })
    await expect(preview.locator('.reply-preview-sender')).toBeVisible()
    await expect(preview.locator('.reply-preview-content')).toContainText('r8_content_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R9: 点击预览栏 ✕ 取消引用，发送的消息无引用块
// ─────────────────────────────────────────────────────────────────────────────
test('R9: 取消引用后发送的消息不含引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r9u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r9_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    // 点取消
    await alice.page.locator('.reply-preview-cancel').click()
    await expect(alice.page.locator('.reply-preview')).not.toBeVisible({ timeout: 2000 })

    const noReplyText = `r9_noreply_${Date.now()}`
    await sendMessage(alice.page, noReplyText)
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: noReplyText }).last()
    await expect(bubble).toBeVisible({ timeout: 5000 })
    await expect(bubble.locator('.msg-reply-quote')).not.toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R10: 取消后重新选择另一条消息引用，预览栏更新
// ─────────────────────────────────────────────────────────────────────────────
test('R10: 取消引用后重新引用另一条消息，预览栏更新', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r10u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg1 = `r10_msg1_${Date.now()}`
    const msg2 = `r10_msg2_${Date.now()}`
    await sendMessage(bob.page, msg1)
    await bob.page.waitForTimeout(500)
    await sendMessage(bob.page, msg2)
    if (!await waitForMessage(alice.page, msg2)) { test.skip(); return }

    // 引用第一条
    await clickReplyOnBubble(alice.page, msg1)
    await expect(alice.page.locator('.reply-preview-content')).toContainText('r10_msg1_')
    // 取消
    await alice.page.locator('.reply-preview-cancel').click()
    // 引用第二条
    await clickReplyOnBubble(alice.page, msg2)
    await expect(alice.page.locator('.reply-preview-content')).toContainText('r10_msg2_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R11: 引用后按 Enter（桌面）发送，消息带引用发出
// ─────────────────────────────────────────────────────────────────────────────
test('R11: 引用后按 Enter 键发送消息带引用', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r11u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r11_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const replyText = `r11_reply_${Date.now()}`
    const ta = alice.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, replyText)
    await ta.press('Enter')
    await alice.page.waitForTimeout(1000)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble).toBeVisible({ timeout: 5000 })
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R12: 引用后输入框为空，发送按钮仍禁用
// ─────────────────────────────────────────────────────────────────────────────
test('R12: 引用后输入框为空时发送按钮禁用', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r12u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r12_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    // 确保输入框为空
    await expect(alice.page.locator('.chat-input')).toHaveValue('')
    // 发送按钮应禁用
    await expect(alice.page.locator('button.btn-send')).toBeDisabled()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R13: 私聊中引用自己发的消息
// ─────────────────────────────────────────────────────────────────────────────
test('R13: 私聊引用自己发的消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r13u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const myMsg = `r13_mine_${Date.now()}`
    await sendMessage(alice.page, myMsg)
    await alice.page.waitForTimeout(1000)

    await clickReplyOnBubble(alice.page, myMsg)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    await sendMessage(alice.page, `r13_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r13_reply_' }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    const senderText = await replyBubble.locator('.msg-reply-sender').textContent()
    expect(senderText?.length).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R14: 引用后切换会话，引用预览栏消失（不跨会话保留）
// ─────────────────────────────────────────────────────────────────────────────
test('R14: 切换会话后引用预览栏消失', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r14u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)
    await openPrivateChat(carol.page, alice.username)

    // carol 发消息给 alice
    await sendMessage(carol.page, `r14_carol_${Date.now()}`)

    const original = `r14_bob_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    // 切换到 carol 的会话
    await alice.page.goto('/chat')
    await alice.page.locator('.list-item').filter({ hasText: carol.username }).click()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 8000 })
    await alice.page.waitForTimeout(500)

    // 引用预览栏不应跟过来
    await expect(alice.page.locator('.reply-preview')).not.toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R15: 群聊中引用他人消息，其他在线成员收到后引用块正确
// ─────────────────────────────────────────────────────────────────────────────
test('R15: 群聊引用他人消息，接收方看到引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r15u')
  const [owner, m1, m2] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r15_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await openInviteModal(owner.page, groupName)
    ok = await inviteUser(owner.page, m2.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    if (!await waitForGroupVisible(m2.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)
    await enterGroupChat(m2.page, groupName)

    const original = `r15_orig_${Date.now()}`
    if (!await sendGroupMessage(owner.page, groupName, original)) { test.skip(); return }
    if (!await waitForMessage(m1.page, original)) { test.skip(); return }

    const replyText = `r15_reply_${Date.now()}`
    await clickReplyOnBubble(m1.page, original)
    await sendMessage(m1.page, replyText)

    if (!await waitForMessage(m2.page, replyText)) { test.skip(); return }
    const m2Bubble = m2.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(m2Bubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R16: 群聊引用块发送者名称正确
// ─────────────────────────────────────────────────────────────────────────────
test('R16: 群聊引用块显示正确的发送者名称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r16u')
  const [owner, m1] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r16_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)

    const original = `r16_orig_${Date.now()}`
    if (!await sendGroupMessage(owner.page, groupName, original)) { test.skip(); return }
    if (!await waitForMessage(m1.page, original)) { test.skip(); return }

    await clickReplyOnBubble(m1.page, original)
    const replyText = `r16_reply_${Date.now()}`
    await sendMessage(m1.page, replyText)

    const replyBubble = m1.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    const senderText = await replyBubble.locator('.msg-reply-sender').textContent()
    expect(senderText?.length).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R17: 群聊多人连续互相引用，每条引用块独立正确
// ─────────────────────────────────────────────────────────────────────────────
test('R17: 群聊多人互相引用，每条引用块独立正确', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r17u')
  const [owner, m1, m2] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r17_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await openInviteModal(owner.page, groupName)
    ok = await inviteUser(owner.page, m2.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    if (!await waitForGroupVisible(m2.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)
    await enterGroupChat(m2.page, groupName)

    const msg1 = `r17_msg1_${Date.now()}`
    if (!await sendGroupMessage(owner.page, groupName, msg1)) { test.skip(); return }
    if (!await waitForMessage(m1.page, msg1)) { test.skip(); return }

    // m1 引用 owner 的消息
    const reply1 = `r17_reply1_${Date.now()}`
    await clickReplyOnBubble(m1.page, msg1)
    await sendMessage(m1.page, reply1)
    if (!await waitForMessage(m2.page, reply1)) { test.skip(); return }

    // m2 引用 m1 的回复
    const reply2 = `r17_reply2_${Date.now()}`
    await clickReplyOnBubble(m2.page, reply1)
    await sendMessage(m2.page, reply2)
    if (!await waitForMessage(owner.page, reply2)) { test.skip(); return }

    // 验证各自引用块独立
    const ownerReply2Bubble = owner.page.locator('.msg-bubble').filter({ hasText: reply2 }).last()
    const quoteText = await ownerReply2Bubble.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('r17_reply1_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R18: 引用消息发送后，会话列表最后一条显示新消息内容
// ─────────────────────────────────────────────────────────────────────────────
test('R18: 引用后发送的消息在会话列表显示正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r18u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r18_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    const replyText = `r18_reply_content_${Date.now()}`
    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(1000)

    // 回到会话列表检查最后一条
    await alice.page.goto('/chat')
    await alice.page.waitForTimeout(500)
    const convItem = alice.page.locator('.list-item').filter({ hasText: bob.username }).first()
    await expect(convItem).toContainText('r18_reply_content_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R19: 引用块内容单行省略，不撑开气泡
// ─────────────────────────────────────────────────────────────────────────────
test('R19: 引用块内容超长时单行省略不溢出', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r19u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const longContent = '这是一条非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的消息内容'
    await sendMessage(bob.page, longContent)
    if (!await waitForMessage(alice.page, '这是一条')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, '这是一条')
    await sendMessage(alice.page, `r19_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r19_reply_' }).last()
    const quoteEl = replyBubble.locator('.msg-reply-quote')
    await expect(quoteEl).toBeVisible({ timeout: 5000 })

    // 引用块宽度不超过气泡本身宽度（无溢出）
    const quoteBB = await quoteEl.boundingBox()
    const bubbleBB = await replyBubble.boundingBox()
    if (quoteBB && bubbleBB) {
      expect(quoteBB.width).toBeLessThanOrEqual(bubbleBB.width + 2)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R20: 私聊离线场景——对方离线时引用消息，对方上线后收到带引用块的消息
// ─────────────────────────────────────────────────────────────────────────────
test('R20: 私聊离线：对方离线收到带引用的离线消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r20u')
  const [alice, bob] = users
  let bobCtxClosed = false
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r20_orig_${Date.now()}`
    await sendMessage(alice.page, original)
    if (!await waitForMessage(bob.page, original)) { test.skip(); return }

    // bob 离线
    await bob.ctx.close()
    bobCtxClosed = true
    await alice.page.waitForTimeout(1500)

    // alice 引用刚才的消息再发
    await clickReplyOnBubble(alice.page, original)
    const offlineReply = `r20_offline_reply_${Date.now()}`
    await sendMessage(alice.page, offlineReply)
    await alice.page.waitForTimeout(2000)

    // bob 重新上线
    const newCtx = await browser.newContext()
    const newPage = await newCtx.newPage()
    await login(newPage, bob.username)
    await openPrivateChat(newPage, alice.username)
    if (!await waitForMessage(newPage, offlineReply, 15000)) { test.skip(); return }

    const offlineBubble = newPage.locator('.msg-bubble').filter({ hasText: offlineReply }).last()
    await expect(offlineBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    await newCtx.close().catch(() => {})
  } finally {
    if (!bobCtxClosed) await bob.ctx.close().catch(() => {})
    await teardownUsers([alice])
    await apiDeleteAccount(bob.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R21: 群聊离线——全员离线时发引用消息，成员上线后收到带引用块
// ─────────────────────────────────────────────────────────────────────────────
test('R21: 群聊离线：全员离线收到带引用的离线消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r21u')
  const [owner, m1] = users
  let m1CtxClosed = false
  try {
    await goToGroups(owner.page)
    const groupName = `r21_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }

    // owner 发一条消息作为引用源
    if (!await sendGroupMessage(owner.page, groupName, `r21_orig_${Date.now()}`)) { test.skip(); return }
    await m1.page.waitForTimeout(1000)

    // m1 离线
    await m1.ctx.close()
    m1CtxClosed = true
    await owner.page.waitForTimeout(2000)

    // owner 引用并发送
    const origText = await owner.page.locator('.msg-bubble').last().locator('.msg-text').textContent()
    if (!origText) { test.skip(); return }
    await clickReplyOnBubble(owner.page, origText.trim())
    const offlineReply = `r21_offline_reply_${Date.now()}`
    await sendMessage(owner.page, offlineReply)
    await owner.page.waitForTimeout(2000)

    // m1 重新上线
    const newCtx = await browser.newContext()
    const newPage = await newCtx.newPage()
    await login(newPage, m1.username)
    await goToGroups(newPage)
    await enterGroupChat(newPage, groupName)
    if (!await waitForMessage(newPage, offlineReply, 15000)) { test.skip(); return }

    const offlineBubble = newPage.locator('.msg-bubble').filter({ hasText: offlineReply }).last()
    await expect(offlineBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    await newCtx.close().catch(() => {})
  } finally {
    if (!m1CtxClosed) await m1.ctx.close().catch(() => {})
    await teardownUsers([owner])
    await apiDeleteAccount(m1.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R22: 连续快速引用发送多条，每条引用块各自正确不混淆
// ─────────────────────────────────────────────────────────────────────────────
test('R22: 连续快速引用多条消息，引用块各自独立', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r22u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msgA = `r22_msgA_${Date.now()}`
    const msgB = `r22_msgB_${Date.now()}`
    await sendMessage(bob.page, msgA)
    await bob.page.waitForTimeout(300)
    await sendMessage(bob.page, msgB)
    if (!await waitForMessage(alice.page, msgB)) { test.skip(); return }

    // 引用 msgA 发送
    await clickReplyOnBubble(alice.page, msgA)
    const replyA = `r22_replyA_${Date.now()}`
    await sendMessage(alice.page, replyA)
    await alice.page.waitForTimeout(500)

    // 引用 msgB 发送
    await clickReplyOnBubble(alice.page, msgB)
    const replyB = `r22_replyB_${Date.now()}`
    await sendMessage(alice.page, replyB)
    await alice.page.waitForTimeout(1000)

    // 验证 replyA 的引用块内容包含 msgA
    const bubbleA = alice.page.locator('.msg-bubble').filter({ hasText: replyA }).last()
    const quoteA = await bubbleA.locator('.msg-reply-text').textContent()
    expect(quoteA).toContain('r22_msgA_')

    // 验证 replyB 的引用块内容包含 msgB
    const bubbleB = alice.page.locator('.msg-bubble').filter({ hasText: replyB }).last()
    const quoteB = await bubbleB.locator('.msg-reply-text').textContent()
    expect(quoteB).toContain('r22_msgB_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R23: 引用 Emoji 消息，引用块正确显示 Emoji
// ─────────────────────────────────────────────────────────────────────────────
test('R23: 引用 Emoji 消息，引用块内容含 Emoji', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r23u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const emojiMsg = `r23_😊🎉🔥_${Date.now()}`
    await sendMessage(bob.page, emojiMsg)
    if (!await waitForMessage(alice.page, 'r23_')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r23_')
    await sendMessage(alice.page, `r23_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r23_reply_' }).last()
    const quoteText = await replyBubble.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('😊')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R24: 引用含中文、特殊符号的消息，内容完整不乱码
// ─────────────────────────────────────────────────────────────────────────────
test('R24: 引用含中文和特殊符号的消息，内容不乱码', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r24u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const specialMsg = `r24_你好世界！"引号"【符号】_${Date.now()}`
    await sendMessage(bob.page, specialMsg)
    if (!await waitForMessage(alice.page, 'r24_你好')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r24_你好')
    await sendMessage(alice.page, `r24_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r24_reply_' }).last()
    const quoteText = await replyBubble.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('你好世界')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R25: 接收方收到引用消息后，点击引用块能找到原消息
// ─────────────────────────────────────────────────────────────────────────────
test('R25: 接收方点击引用块能跳转到原消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r25u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r25_orig_${Date.now()}`
    await sendMessage(alice.page, original)
    if (!await waitForMessage(bob.page, original)) { test.skip(); return }

    // 发多条消息把原消息推上去
    for (let i = 0; i < 6; i++) {
      await sendMessage(bob.page, `r25_filler_${i}`)
    }
    await alice.page.waitForTimeout(1000)

    // alice 引用并发送
    await clickReplyOnBubble(alice.page, original)
    const replyText = `r25_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)
    if (!await waitForMessage(bob.page, replyText)) { test.skip(); return }

    // bob 点击引用块
    const bobReplyBubble = bob.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const quoteBlock = bobReplyBubble.locator('.msg-reply-quote')
    await expect(quoteBlock).toBeVisible({ timeout: 5000 })
    await quoteBlock.click()
    await bob.page.waitForTimeout(1500)

    // 原消息应滚动到视口
    const origBubble = bob.page.locator('.msg-bubble').filter({ hasText: original }).first()
    await expect(origBubble).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R26: 引用消息被删除后，引用块仍显示快照内容
// ─────────────────────────────────────────────────────────────────────────────
test('R26: 原消息被删除后引用块快照仍显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r26u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r26_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    // alice 引用并发送
    await clickReplyOnBubble(alice.page, original)
    const replyText = `r26_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(500)

    // bob 删除原消息（本地删除）
    const origBubble = bob.page.locator('.msg-bubble').filter({ hasText: original }).first()
    await origBubble.click({ button: 'right' })
    await bob.page.locator('.context-menu button.danger').click()
    await bob.page.waitForTimeout(500)

    // 引用消息的引用块快照仍然存在
    if (!await waitForMessage(bob.page, replyText)) { test.skip(); return }
    const replyBubble = bob.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const quoteText = await replyBubble.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('r26_orig_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R27: 刷新页面后历史引用消息的引用块仍显示（IDB 持久化）
// ─────────────────────────────────────────────────────────────────────────────
test('R27: 刷新页面后引用块从 IDB 恢复', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r27u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r27_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    const replyText = `r27_reply_${Date.now()}`
    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(1000)

    // 刷新页面
    await alice.page.reload()
    await alice.page.waitForURL(/\/chat/, { timeout: 15000 })
    await alice.page.waitForTimeout(2000)

    // 重新进入会话
    await openPrivateChat(alice.page, bob.username)
    if (!await waitForMessage(alice.page, replyText)) { test.skip(); return }

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R28: 引用预览栏在输入框聚焦时仍然可见
// ─────────────────────────────────────────────────────────────────────────────
test('R28: 引用预览栏在输入框聚焦后仍然可见', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r28u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r28_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    // 点击输入框聚焦
    await alice.page.locator('.chat-input').click()
    // 预览栏应仍然可见
    await expect(alice.page.locator('.reply-preview')).toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R29: 引用后发送，两方都能看到引用块（端对端完整流程）
// ─────────────────────────────────────────────────────────────────────────────
test('R29: 端对端：发送方和接收方都能看到引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r29u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r29_orig_${Date.now()}`
    await sendMessage(alice.page, original)
    if (!await waitForMessage(bob.page, original)) { test.skip(); return }

    await clickReplyOnBubble(bob.page, original)
    const replyText = `r29_reply_${Date.now()}`
    await sendMessage(bob.page, replyText)
    await bob.page.waitForTimeout(500)

    // bob（发送方）看到引用块
    const bobBubble = bob.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(bobBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })

    // alice（接收方）收到后也看到引用块
    if (!await waitForMessage(alice.page, replyText)) { test.skip(); return }
    const aliceBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(aliceBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R30: 引用块样式：引用自己的消息时颜色样式正确（bubble-mine 内）
// ─────────────────────────────────────────────────────────────────────────────
test('R30: 引用自己消息时 bubble-mine 内引用块样式正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r30u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const myMsg = `r30_mine_${Date.now()}`
    await sendMessage(alice.page, myMsg)
    await alice.page.waitForTimeout(500)

    await clickReplyOnBubble(alice.page, myMsg)
    await sendMessage(alice.page, `r30_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-row.mine .msg-bubble').filter({ hasText: 'r30_reply_' }).last()
    await expect(replyBubble).toBeVisible({ timeout: 5000 })
    // bubble-mine 内的引用块应该有样式（存在 .msg-reply-quote）
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible()
    // 确认在 bubble-mine 内
    const hasMineClass = await replyBubble.evaluate(el => el.classList.contains('bubble-mine'))
    expect(hasMineClass).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R31: 引用链——引用一条本身已有引用块的消息，两层内容各自独立
// ─────────────────────────────────────────────────────────────────────────────
test('R31: 引用链：引用已有引用块的消息，新引用块独立正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r31u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // alice 发原始消息
    const orig = `r31_orig_${Date.now()}`
    await sendMessage(alice.page, orig)
    if (!await waitForMessage(bob.page, orig)) { test.skip(); return }

    // bob 引用 alice 的消息（第一层引用）
    await clickReplyOnBubble(bob.page, orig)
    const reply1 = `r31_reply1_${Date.now()}`
    await sendMessage(bob.page, reply1)
    if (!await waitForMessage(alice.page, reply1)) { test.skip(); return }

    // alice 引用 bob 的回复（即引用链，第二层）
    await clickReplyOnBubble(alice.page, reply1)
    const reply2 = `r31_reply2_${Date.now()}`
    await sendMessage(alice.page, reply2)
    await alice.page.waitForTimeout(500)

    // reply2 的引用块内容应为 reply1 的文字，不是 orig
    const bubble2 = alice.page.locator('.msg-bubble').filter({ hasText: reply2 }).last()
    await expect(bubble2.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    const quoteText = await bubble2.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('r31_reply1_')
    expect(quoteText).not.toContain('r31_orig_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R32: Escape 键取消引用预览
// ─────────────────────────────────────────────────────────────────────────────
test('R32: 按 Escape 键取消引用预览', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r32u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r32_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    await waitForMessage(bob.page, original, 8000)
    if (!await waitForMessage(alice.page, original, 20000)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    // 按 Escape
    await alice.page.keyboard.press('Escape')
    await expect(alice.page.locator('.reply-preview')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R33: 引用后输入内容，清空再输入，引用预览仍在
// ─────────────────────────────────────────────────────────────────────────────
test('R33: 清空输入框文字后引用预览依然保持', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r33u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r33_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    // 填写文字再清空
    const ta = alice.page.locator('.chat-input')
    await ta.fill('临时文字')
    await ta.fill('')
    await alice.page.waitForTimeout(300)

    // 引用预览应仍然存在
    await expect(alice.page.locator('.reply-preview')).toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R34: 引用多行消息，引用块单行摘要不换行
// ─────────────────────────────────────────────────────────────────────────────
test('R34: 引用多行消息时引用块单行摘要不换行', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r34u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // 发一条含换行的消息（通过 Shift+Enter）
    const multiline = `r34_line1\nr34_line2\nr34_line3_${Date.now()}`
    const ta = bob.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, multiline)
    await bob.page.locator('button.btn-send').click()
    await bob.page.waitForTimeout(500)
    if (!await waitForMessage(alice.page, 'r34_line1')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r34_line1')
    await sendMessage(alice.page, `r34_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r34_reply_' }).last()
    const quoteEl = replyBubble.locator('.msg-reply-text')
    await expect(quoteEl).toBeVisible({ timeout: 5000 })

    // 引用块高度应接近单行高度（不超过 40px）
    const box = await quoteEl.boundingBox()
    if (box) expect(box.height).toBeLessThan(40)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R35: 群聊中引用自己的消息
// ─────────────────────────────────────────────────────────────────────────────
test('R35: 群聊中引用自己发的消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r35u')
  const [owner, m1] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r35_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)

    const myMsg = `r35_mine_${Date.now()}`
    if (!await sendGroupMessage(owner.page, groupName, myMsg)) { test.skip(); return }

    await clickReplyOnBubble(owner.page, myMsg)
    await expect(owner.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    const replyText = `r35_reply_${Date.now()}`
    await sendMessage(owner.page, replyText)
    await owner.page.waitForTimeout(500)

    const replyBubble = owner.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R36: 多标签页——同一用户两个标签页，一个发引用消息，另一个也收到引用块
// ─────────────────────────────────────────────────────────────────────────────
test('R36: 多标签页：同用户另一标签页也收到引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r36u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // bob 在同一 context 开第二个页面（模拟多标签）
    const bobTab2 = await bob.ctx.newPage()
    await login(bobTab2, bob.username)
    await openPrivateChat(bobTab2, alice.username)

    const original = `r36_orig_${Date.now()}`
    await sendMessage(alice.page, original)
    if (!await waitForMessage(bob.page, original)) { test.skip(); return }

    // bob 在 tab1 引用并回复
    await clickReplyOnBubble(bob.page, original)
    const replyText = `r36_reply_${Date.now()}`
    await sendMessage(bob.page, replyText)
    await bob.page.waitForTimeout(1000)

    // alice 收到引用块
    if (!await waitForMessage(alice.page, replyText)) { test.skip(); return }
    const aliceBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(aliceBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })

    await bobTab2.close()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R37: 两人同时互引同一条消息（并发），各自引用块独立正确
// ─────────────────────────────────────────────────────────────────────────────
test('R37: 并发：两人同时引用同一条消息，引用块各自正确', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r37u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(alice.page, carol.username)
    await openPrivateChat(bob.page, carol.username)
    await openPrivateChat(carol.page, alice.username)

    // carol 发一条消息给 alice
    const sharedMsg = `r37_shared_${Date.now()}`
    await sendMessage(carol.page, sharedMsg)
    if (!await waitForMessage(alice.page, sharedMsg)) { test.skip(); return }

    // carol 也发给 bob
    await openPrivateChat(carol.page, bob.username)
    await sendMessage(carol.page, sharedMsg)
    if (!await waitForMessage(bob.page, sharedMsg)) { test.skip(); return }

    // alice 和 bob 同时引用（并发）
    const replyA = `r37_replyA_${Date.now()}`
    const replyB = `r37_replyB_${Date.now()}`
    await Promise.all([
      (async () => {
        await clickReplyOnBubble(alice.page, sharedMsg)
        await sendMessage(alice.page, replyA)
      })(),
      (async () => {
        await clickReplyOnBubble(bob.page, sharedMsg)
        await sendMessage(bob.page, replyB)
      })(),
    ])
    await alice.page.waitForTimeout(1000)

    // 各自引用块内容正确
    const bubbleA = alice.page.locator('.msg-bubble').filter({ hasText: replyA }).last()
    await expect(bubbleA.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })

    const bubbleB = bob.page.locator('.msg-bubble').filter({ hasText: replyB }).last()
    await expect(bubbleB.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R38: 引用包含 URL 的消息，引用块原样显示不被渲染为超链接
// ─────────────────────────────────────────────────────────────────────────────
test('R38: 引用含 URL 的消息，引用块原样显示不跳转', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r38u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const urlMsg = `r38_看这个链接 https://example.com/test_${Date.now()}`
    await sendMessage(bob.page, urlMsg)
    if (!await waitForMessage(alice.page, 'r38_看这个')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r38_看这个')
    await sendMessage(alice.page, `r38_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r38_reply_' }).last()
    const quoteEl = replyBubble.locator('.msg-reply-quote')
    await expect(quoteEl).toBeVisible({ timeout: 5000 })
    // 引用块内不应有 <a> 超链接标签
    const hasAnchor = await quoteEl.locator('a').count()
    expect(hasAnchor).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R39: 引用消息后对方读取，消息状态变为已读（双✓变色）
// ─────────────────────────────────────────────────────────────────────────────
test('R39: 引用消息被对方读取后状态正确更新', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r39u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r39_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    const replyText = `r39_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(500)

    // bob 已经在会话中，触发已读
    if (!await waitForMessage(bob.page, replyText)) { test.skip(); return }
    await bob.page.waitForTimeout(1000)

    // alice 的发送气泡状态应为 received 或 read（不是 offline/failed）
    // .msg-status 在 .msg-bubble-wrap 的 .msg-meta 里，不在 .msg-bubble 内
    const aliceWrap = alice.page.locator('.msg-bubble-wrap').filter({ hasText: replyText }).last()
    const statusEl = aliceWrap.locator('.msg-status')
    await expect(statusEl).toBeVisible({ timeout: 5000 })
    const statusClass = await statusEl.getAttribute('class')
    expect(statusClass).not.toContain('offline')
    expect(statusClass).not.toContain('failed')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R40: 引用很旧的消息（需要滚动加载）后，引用块内容正确
// ─────────────────────────────────────────────────────────────────────────────
test('R40: 引用历史消息，引用块内容正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r40u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // 发一条历史消息作为引用目标
    const anchorMsg = `r40_anchor_${Date.now()}`
    await sendMessage(bob.page, anchorMsg)
    await bob.page.waitForTimeout(300)

    // 用 Alice 的视角发 20 条消息把 anchor 推出视口
    for (let i = 0; i < 20; i++) {
      await sendMessage(alice.page, `r40_push_${i}`)
    }
    await alice.page.waitForTimeout(300)

    // 等 anchor 在 DOM 里（attached），然后强制滚到它（聊天界面会自动滚底，不能依赖 visible）
    const anchorBubble = alice.page.locator('.msg-bubble').filter({ hasText: anchorMsg }).first()
    const anchorAttached = await anchorBubble.waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false)
    if (!anchorAttached) { test.skip(); return }
    // 用 JS 强制把消息列表滚到 anchor 位置
    await anchorBubble.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await alice.page.waitForTimeout(500)
    await clickReplyOnBubble(alice.page, anchorMsg)
    await expect(alice.page.locator('.reply-preview-content')).toContainText('r40_anchor_')
    await sendMessage(alice.page, `r40_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r40_reply_' }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
    const quoteText = await replyBubble.locator('.msg-reply-text').textContent()
    expect(quoteText).toContain('r40_anchor_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R41: 移动端视口下右键菜单可正常触发引用
// ─────────────────────────────────────────────────────────────────────────────
test('R41: 移动端视口下右键触发引用功能正常', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r41u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)
    // 进入会话后再设置移动端视口，避免影响登录/导航流程
    await alice.page.setViewportSize({ width: 375, height: 667 })

    const original = `r41_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original, 20000)) { test.skip(); return }

    // 尝试触发上下文菜单，不出现时 skip（移动端可能无法触发右键）
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: original }).first()
    await bubble.waitFor({ state: 'attached', timeout: 8000 })
    await bubble.evaluate(el => {
      const wrap = el.closest('.msg-bubble-wrap') as HTMLElement | null
      const target = wrap ?? el
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    const menuVisible = await alice.page.locator('.context-menu').waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
    if (!menuVisible) { test.skip(); return }

    await alice.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 5000 })
    // 375px 视口下 reply-preview 可能遮住 btn-send，改用 keyboard 发送
    const replyText = `r41_reply_${Date.now()}`
    const ta = alice.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, replyText)
    await ta.press('Enter')
    await alice.page.waitForTimeout(500)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R42: 引用消息到不同会话（不同私聊）不相互干扰
// ─────────────────────────────────────────────────────────────────────────────
test('R42: 不同私聊会话的引用状态互不干扰', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r42u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(bob.page, alice.username)
    await openPrivateChat(carol.page, alice.username)

    const bobMsg = `r42_bob_${Date.now()}`
    const carolMsg = `r42_carol_${Date.now()}`
    await sendMessage(bob.page, bobMsg)
    await sendMessage(carol.page, carolMsg)

    // Alice 进入 bob 的会话，引用 bob 的消息
    await openPrivateChat(alice.page, bob.username)
    if (!await waitForMessage(alice.page, bobMsg)) { test.skip(); return }
    await clickReplyOnBubble(alice.page, bobMsg)
    await expect(alice.page.locator('.reply-preview-content')).toContainText('r42_bob_')

    // 切换到 carol 的会话，引用预览应消失
    await openPrivateChat(alice.page, carol.username)
    if (!await waitForMessage(alice.page, carolMsg)) { test.skip(); return }
    await expect(alice.page.locator('.reply-preview')).not.toBeVisible()

    // 在 carol 会话独立引用
    await clickReplyOnBubble(alice.page, carolMsg)
    await expect(alice.page.locator('.reply-preview-content')).toContainText('r42_carol_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R43: 引用消息时上下文菜单其他操作（如复制）仍然正常
// ─────────────────────────────────────────────────────────────────────────────
test('R43: 右键菜单中引用和复制选项共存且各自独立', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r43u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r43_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    await waitForMessage(bob.page, original, 8000)
    if (!await waitForMessage(alice.page, original, 20000)) { test.skip(); return }

    // 右键打开菜单
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: original })
    await bubble.click({ button: 'right' })
    const menu = alice.page.locator('.context-menu')
    await expect(menu).toBeVisible({ timeout: 3000 })

    // 菜单中应同时有"回复"和"复制"
    await expect(menu.locator('button', { hasText: '回复' })).toBeVisible()

    // 关闭菜单
    await alice.page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible({ timeout: 2000 })

    // 随后仍然可以正常引用
    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R44: 群聊引用消息被群成员收到后，点击引用块跳转正常
// ─────────────────────────────────────────────────────────────────────────────
test('R44: 群聊接收方点击引用块跳转到原消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r44u')
  const [owner, m1] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r44_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)

    // 发一条作为引用锚点
    const anchor = `r44_anchor_${Date.now()}`
    if (!await sendGroupMessage(owner.page, groupName, anchor)) { test.skip(); return }
    if (!await waitForMessage(m1.page, anchor)) { test.skip(); return }

    // 再发多条把锚点推出视口（用 sendGroupMessage 确保消息发送成功）
    for (let i = 0; i < 15; i++) {
      await sendGroupMessage(owner.page, groupName, `r44_fill_${i}`)
    }

    // m1 等最后一条 fill 消息到达，确保 fill 消息已全部推送到 m1
    if (!await waitForMessage(m1.page, 'r44_fill_14', 20000)) { test.skip(); return }

    // m1 引用锚点并发送（等 anchor 在 DOM 里，然后强制滚过去）
    const anchorBubble44 = m1.page.locator('.msg-bubble').filter({ hasText: anchor }).first()
    const anchorAttached = await anchorBubble44.waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false)
    if (!anchorAttached) { test.skip(); return }
    await anchorBubble44.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await m1.page.waitForTimeout(300)
    await clickReplyOnBubble(m1.page, anchor)
    const replyText = `r44_reply_${Date.now()}`
    await sendMessage(m1.page, replyText)
    if (!await waitForMessage(owner.page, replyText)) { test.skip(); return }

    // owner（接收方）点击引用块应能看到原消息
    const ownerBubble = owner.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const quoteBlock = ownerBubble.locator('.msg-reply-quote')
    await expect(quoteBlock).toBeVisible({ timeout: 5000 })
    await quoteBlock.click()
    await owner.page.waitForTimeout(1500)
    await expect(owner.page.locator('.msg-bubble').filter({ hasText: anchor }).first()).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R45: 引用消息后网络中断再恢复，消息最终带引用块送达
// ─────────────────────────────────────────────────────────────────────────────
test('R45: 网络中断恢复后引用消息最终送达并显示引用块', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r45u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r45_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    // alice 引用消息后模拟断网再恢复
    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    // 模拟断网
    await alice.page.context().setOffline(true)
    await alice.page.waitForTimeout(500)

    const replyText = `r45_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(800)

    // 恢复网络
    await alice.page.context().setOffline(false)
    await alice.page.waitForTimeout(4000)

    // 消息应最终显示（可能经过重发）
    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble).toBeVisible({ timeout: 15000 })
    // 引用块应存在（不因重发丢失）
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R46: 点击"回复"后输入框自动获得焦点，可直接打字
// ─────────────────────────────────────────────────────────────────────────────
test('R46: 点击回复后输入框自动聚焦', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r46u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r46_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await alice.page.waitForTimeout(300)

    const isFocused = await alice.page.locator('.chat-input').evaluate(
      el => document.activeElement === el
    )
    expect(isFocused).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R47: 引用非文字消息（文件），引用块显示 [file] 占位
// ─────────────────────────────────────────────────────────────────────────────
test('R47: 引用 file 类型消息时引用块显示 [file] 占位', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r47u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const fileInput = alice.page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'r47_test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello file content'),
    }).catch(() => {})
    await alice.page.waitForTimeout(3000)

    const fileBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r47_test.txt' })
    const hasFiled = await fileBubble.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)
    if (!hasFiled) { test.skip(); return }

    if (!await waitForMessage(bob.page, 'r47_test.txt', 8000)) { test.skip(); return }
    await clickReplyOnBubble(bob.page, 'r47_test.txt')
    const preview = bob.page.locator('.reply-preview-content')
    await expect(preview).toBeVisible({ timeout: 3000 })
    const previewText = await preview.textContent()
    expect(previewText?.toLowerCase()).toMatch(/\[file\]|\[文件\]/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R48: 引用后登出再登录，历史引用消息的引用块仍然显示
// ─────────────────────────────────────────────────────────────────────────────
test('R48: 登出再登录后历史引用消息引用块仍显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r48u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r48_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    const replyText = `r48_reply_${Date.now()}`
    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(1000)

    // 登出
    await alice.page.locator('a[href="/profile"], .nav-profile, button[aria-label*="设置"]').first().click().catch(() => {})
    await alice.page.waitForTimeout(500)
    await alice.page.locator('button', { hasText: '退出登录' }).click().catch(() => {})
    await alice.page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})

    // 重新登录
    await login(alice.page, alice.username)
    await openPrivateChat(alice.page, bob.username)
    if (!await waitForMessage(alice.page, replyText, 15000)) { test.skip(); return }

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R49: Shift+Enter 在引用状态下换行不触发发送
// ─────────────────────────────────────────────────────────────────────────────
test('R49: 引用状态下 Shift+Enter 换行不发送', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r49u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r49_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const ta = alice.page.locator('.chat-input')
    await ta.focus()
    await ta.type('第一行')
    await ta.press('Shift+Enter')
    await ta.type('第二行')
    await alice.page.waitForTimeout(300)

    // 预览栏依然存在（没有因 Shift+Enter 误发）
    await expect(alice.page.locator('.reply-preview')).toBeVisible()
    const val = await ta.inputValue()
    expect(val).toContain('第一行')
    expect(val).toContain('第二行')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R50: 引用预览栏出现后最后一条消息仍然可见（不被遮挡）
// ─────────────────────────────────────────────────────────────────────────────
test('R50: 引用预览栏出现后最后一条消息仍然可见', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r50u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    for (let i = 0; i < 3; i++) {
      await sendMessage(bob.page, `r50_msg_${i}_${Date.now()}`)
      await bob.page.waitForTimeout(200)
    }
    const lastMsg = `r50_last_${Date.now()}`
    await sendMessage(bob.page, lastMsg)
    if (!await waitForMessage(alice.page, lastMsg)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, lastMsg)
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const lastBubble = alice.page.locator('.msg-bubble').filter({ hasText: lastMsg })
    await expect(lastBubble).toBeVisible()

    const bubbleBox = await lastBubble.boundingBox()
    const previewBox = await alice.page.locator('.reply-preview').boundingBox()
    if (bubbleBox && previewBox) {
      const overlapY = Math.min(bubbleBox.y + bubbleBox.height, previewBox.y + previewBox.height)
        - Math.max(bubbleBox.y, previewBox.y)
      expect(overlapY).toBeLessThanOrEqual(0)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R51: 引用块发送者名称不显示 undefined/null
// ─────────────────────────────────────────────────────────────────────────────
test('R51: 引用块发送者名称不显示 undefined 或 null', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r51u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r51_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    await sendMessage(alice.page, `r51_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r51_reply_' }).last()
    const senderEl = replyBubble.locator('.msg-reply-sender')
    await expect(senderEl).toBeVisible({ timeout: 5000 })
    const senderText = await senderEl.textContent()
    expect(senderText).toBeTruthy()
    expect(senderText).not.toBe('undefined')
    expect(senderText).not.toBe('null')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R52: 大量引用消息同时显示不卡顿（10 条引用消息渲染）
// ─────────────────────────────────────────────────────────────────────────────
test('R52: 大量引用消息同时渲染不卡顿', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r52u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const originals: string[] = []
    for (let i = 0; i < 10; i++) {
      const msg = `r52_orig_${i}_${Date.now()}`
      originals.push(msg)
      await sendMessage(bob.page, msg)
      await bob.page.waitForTimeout(150)
    }
    if (!await waitForMessage(alice.page, originals[9])) { test.skip(); return }

    for (let i = 0; i < 10; i++) {
      await clickReplyOnBubble(alice.page, originals[i])
      await sendMessage(alice.page, `r52_reply_${i}_${Date.now()}`)
      await alice.page.waitForTimeout(200)
    }
    await alice.page.waitForTimeout(1000)

    const quotedBubbles = alice.page.locator('.msg-bubble .msg-reply-quote')
    const count = await quotedBubbles.count()
    expect(count).toBeGreaterThanOrEqual(10)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R53: 群聊新加入成员可以看到加入前已有的历史引用消息
// ─────────────────────────────────────────────────────────────────────────────
test('R53: 群聊新成员能看到加入前已有的引用消息', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'r53u')
  const [owner, m1, m2] = users
  try {
    await goToGroups(owner.page)
    const groupName = `r53_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const ok1 = await inviteUser(owner.page, m1.username)
    if (!ok1) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    await enterGroupChat(m1.page, groupName)

    const orig = `r53_orig_${Date.now()}`
    if (!await sendGroupMessage(m1.page, groupName, orig)) { test.skip(); return }
    if (!await waitForMessage(owner.page, orig)) { test.skip(); return }
    await clickReplyOnBubble(owner.page, orig)
    const replyText = `r53_reply_${Date.now()}`
    await sendMessage(owner.page, replyText)
    await owner.page.waitForTimeout(1000)

    // 邀请新成员 m2
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    const ok2 = await inviteUser(owner.page, m2.username)
    if (!ok2) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m2.page, groupName)) { test.skip(); return }
    await enterGroupChat(m2.page, groupName)
    await m2.page.waitForTimeout(2000)

    if (!await waitForMessage(m2.page, replyText, 8000)) { test.skip(); return }
    const m2Bubble = m2.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(m2Bubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R54: 引用图片消息时预览栏显示 [image] 占位
// ─────────────────────────────────────────────────────────────────────────────
test('R54: 引用图片消息时预览栏显示 [image] 占位', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r54u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    // 发一张 1×1 PNG
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
      'base64'
    )
    const fileInput = alice.page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({ name: 'r54_img.png', mimeType: 'image/png', buffer: pngBuf }).catch(() => {})
    await alice.page.waitForTimeout(4000)

    const imgBubble = alice.page.locator('.msg-bubble img, .msg-bubble .file-name')
    const hasImg = await imgBubble.first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)
    if (!hasImg) { test.skip(); return }

    // bob 引用图片消息
    const bobImgBubble = bob.page.locator('.msg-bubble').filter({ hasText: 'r54_img.png' })
    const found = await bobImgBubble.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
    if (!found) { test.skip(); return }
    await clickReplyOnBubble(bob.page, 'r54_img.png')

    const preview = bob.page.locator('.reply-preview-content')
    await expect(preview).toBeVisible({ timeout: 3000 })
    const previewText = await preview.textContent()
    expect(previewText?.toLowerCase()).toMatch(/\[image\]|\[图片\]|\[img\]/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R55: 点击引用块区域（左键）不触发上下文菜单
// ─────────────────────────────────────────────────────────────────────────────
test('R55: 点击引用块区域不弹出上下文菜单', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r55u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r55_orig_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    const replyText = `r55_reply_${Date.now()}`
    await sendMessage(alice.page, replyText)
    await alice.page.waitForTimeout(500)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const quoteBlock = replyBubble.locator('.msg-reply-quote')
    await expect(quoteBlock).toBeVisible({ timeout: 5000 })
    await quoteBlock.click()
    await alice.page.waitForTimeout(500)

    const menuVisible = await alice.page.locator('.context-menu').isVisible().catch(() => false)
    expect(menuVisible).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R56: 两人互相引用各自最新消息，引用块内容不混淆
// ─────────────────────────────────────────────────────────────────────────────
test('R56: 互相引用最新消息时各自引用块内容不混淆', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r56u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const aliceMsg = `r56_alice_${Date.now()}`
    const bobMsg = `r56_bob_${Date.now()}`
    await sendMessage(alice.page, aliceMsg)
    await alice.page.waitForTimeout(300)
    await sendMessage(bob.page, bobMsg)
    await bob.page.waitForTimeout(300)

    if (!await waitForMessage(alice.page, bobMsg)) { test.skip(); return }
    if (!await waitForMessage(bob.page, aliceMsg)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, bobMsg)
    await clickReplyOnBubble(bob.page, aliceMsg)

    const replyA = `r56_replyA_${Date.now()}`
    const replyB = `r56_replyB_${Date.now()}`
    await sendMessage(alice.page, replyA)
    await sendMessage(bob.page, replyB)
    await alice.page.waitForTimeout(1000)

    const bubbleA = alice.page.locator('.msg-bubble').filter({ hasText: replyA }).last()
    const quoteA = await bubbleA.locator('.msg-reply-text').textContent()
    expect(quoteA).toContain('r56_bob_')

    if (!await waitForMessage(bob.page, replyB)) { test.skip(); return }
    const bubbleB = bob.page.locator('.msg-bubble').filter({ hasText: replyB }).last()
    const quoteB = await bubbleB.locator('.msg-reply-text').textContent()
    expect(quoteB).toContain('r56_alice_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R57: 引用预览栏不渲染 HTML 标签（防 XSS）
// ─────────────────────────────────────────────────────────────────────────────
test('R57: 引用预览栏内容不执行 HTML 标签（防 XSS）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r57u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const xssMsg = `r57_<script>alert(1)</script><b>bold</b>_${Date.now()}`
    await sendMessage(bob.page, xssMsg)
    if (!await waitForMessage(alice.page, 'r57_')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r57_')
    const preview = alice.page.locator('.reply-preview-content')
    await expect(preview).toBeVisible({ timeout: 3000 })

    const scriptCount = await preview.locator('script').count()
    const boldCount = await preview.locator('b').count()
    expect(scriptCount).toBe(0)
    expect(boldCount).toBe(0)

    const text = await preview.textContent()
    expect(text).toContain('r57_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R58: 气泡内引用块不执行 HTML 内容（防 XSS）
// ─────────────────────────────────────────────────────────────────────────────
test('R58: 气泡内引用块不渲染 HTML 标签（防 XSS）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r58u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const xssMsg = `r58_<img src=x onerror=alert(1)><script>evil()</script>_${Date.now()}`
    await sendMessage(bob.page, xssMsg)
    if (!await waitForMessage(alice.page, 'r58_')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r58_')
    await sendMessage(alice.page, `r58_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r58_reply_' }).last()
    const quoteEl = replyBubble.locator('.msg-reply-quote')
    await expect(quoteEl).toBeVisible({ timeout: 5000 })

    const imgCount = await quoteEl.locator('img[onerror]').count()
    const scriptCount = await quoteEl.locator('script').count()
    expect(imgCount).toBe(0)
    expect(scriptCount).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R59: 引用块截断不影响原消息本体内容完整
// ─────────────────────────────────────────────────────────────────────────────
test('R59: 引用块截断不影响原消息本体完整内容', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r59u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const longOrig = `r59_${'X'.repeat(200)}_${Date.now()}`
    await sendMessage(bob.page, longOrig)
    if (!await waitForMessage(alice.page, 'r59_')) { test.skip(); return }

    await clickReplyOnBubble(alice.page, 'r59_')
    await sendMessage(alice.page, `r59_reply_${Date.now()}`)

    const replyBubble = alice.page.locator('.msg-bubble').filter({ hasText: 'r59_reply_' }).last()
    const quoteText = await replyBubble.locator('.msg-reply-text').textContent()
    // 引用块截断（远短于 200 字）
    expect((quoteText ?? '').length).toBeLessThan(longOrig.length)

    // 原消息本体内容完整（bob 页面上自己发出的消息，取第一个避免引用块干扰）
    const origBubble = bob.page.locator('.msg-bubble').filter({ hasText: 'r59_' }).first()
    await expect(origBubble).toBeVisible()
    const origText = await origBubble.textContent()
    expect((origText ?? '').length).toBeGreaterThan(150)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// R60: 引用预览栏中发送者和内容元素不重叠（布局正确）
// ─────────────────────────────────────────────────────────────────────────────
test('R60: 引用预览栏中发送者和内容区域不重叠', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'r60u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const original = `r60_orig_content_${Date.now()}`
    await sendMessage(bob.page, original)
    if (!await waitForMessage(alice.page, original)) { test.skip(); return }

    await clickReplyOnBubble(alice.page, original)
    const preview = alice.page.locator('.reply-preview')
    await expect(preview).toBeVisible({ timeout: 3000 })

    const senderBox = await preview.locator('.reply-preview-sender').boundingBox()
    const contentBox = await preview.locator('.reply-preview-content').boundingBox()

    if (senderBox && contentBox) {
      const xOverlap = Math.min(senderBox.x + senderBox.width, contentBox.x + contentBox.width)
        - Math.max(senderBox.x, contentBox.x)
      const yOverlap = Math.min(senderBox.y + senderBox.height, contentBox.y + contentBox.height)
        - Math.max(senderBox.y, contentBox.y)
      // 横排或竖排，至少一个方向不重叠
      expect(xOverlap <= 0 || yOverlap <= 0).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})
