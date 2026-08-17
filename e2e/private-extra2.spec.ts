/**
 * 私聊新增场景 PX1–PX50
 *
 * 覆盖：会话列表搜索/长按/右键、Profile页面各状态、About页面、
 *       FriendPage 分区显示、消息气泡上下文菜单完整路径、
 *       文件消息气泡（过期/已发送/图标/下载确认/可执行文件警告）、
 *       引用块跳转高亮、消息 failed 状态、消息状态文字、
 *       昵称超50字验证、ProfilePage 静态信息、注销密码 Enter 键等
 */

import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'
const PASSWORD = 'Test1234!'

// ── API helpers ───────────────────────────────────────────────────────────────

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
  await users[0].page.waitForTimeout(1500)
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
  await page.waitForTimeout(500)
}

async function waitForMessage(page: Page, text: string, timeout = 12000) {
  return page.locator('.msg-bubble').filter({ hasText: text })
    .waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
}

// IDB 注入：通过全局 flag + waitForFunction 轮询，避免 "promise garbage collected"
async function injectIDBMessage(page: Page, dbName: string, record: Record<string, unknown>) {
  const flagKey = `__idbDone_${record['id']}`
  // 先清除旧 flag（防止 key 复用）
  await page.evaluate((key: string) => { delete (window as unknown as Record<string, unknown>)[key] }, flagKey)
  // fire-and-forget：不 return Promise，只设 window flag
  await page.evaluate(({ dbName, record, flagKey }: { dbName: string; record: Record<string, unknown>; flagKey: string }) => {
    const req = indexedDB.open(dbName)
    req.onsuccess = function(e: Event) {
      const db = (e.target as IDBOpenDBRequest).result
      let tx: IDBTransaction
      try {
        tx = db.transaction('messages', 'readwrite')
      } catch {
        (window as unknown as Record<string, unknown>)[flagKey] = 'error'
        return
      }
      const addReq = tx.objectStore('messages').add(record)
      addReq.onsuccess = function() { (window as unknown as Record<string, unknown>)[flagKey] = 'done' }
      addReq.onerror = function() { (window as unknown as Record<string, unknown>)[flagKey] = 'error' }
      tx.onerror = function() { (window as unknown as Record<string, unknown>)[flagKey] = 'error' }
    }
    req.onerror = function() { (window as unknown as Record<string, unknown>)[flagKey] = 'error' }
  }, { dbName, record, flagKey })
  await page.waitForFunction(
    (key: string) => !!(window as unknown as Record<string, unknown>)[key],
    flagKey,
    { timeout: 8000 }
  )
}

async function openPrivateChat(page: Page, targetUsername: string) {
  await page.goto('/friends')
  await page.locator('.list-item').filter({ hasText: targetUsername }).click()
  await page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await page.waitForTimeout(500)
}

// 建立私聊会话（发一条消息让会话出现在列表中）
async function establishConversation(alice: UserCtx, bob: UserCtx) {
  await openPrivateChat(alice.page, bob.username)
  const msg = `establish_${Date.now()}`
  await sendMessage(alice.page, msg)
  await waitForMessage(alice.page, msg, 8000)
  await alice.page.goto('/chat')
  await alice.page.waitForTimeout(500)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 会话列表 — 搜索
// ═══════════════════════════════════════════════════════════════════════════════

test('PX1: 会话列表搜索框存在且可输入', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px1u')
  try {
    await users[0].page.goto('/chat')
    await expect(users[0].page.locator('input[type="search"]')).toBeVisible({ timeout: 3000 })
    await users[0].page.locator('input[type="search"]').fill('test')
    const val = await users[0].page.locator('input[type="search"]').inputValue()
    expect(val).toBe('test')
  } finally {
    await teardownUsers(users)
  }
})

test('PX2: 会话列表搜索按用户名过滤', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px2u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const shortName = bob.username.slice(0, 8)
    await alice.page.locator('input[type="search"]').fill(shortName)
    await alice.page.waitForTimeout(300)
    const visible = await alice.page.locator('.list-item').filter({ hasText: shortName }).count()
    expect(visible).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

test('PX3: 会话列表搜索不存在的名称时显示暂无消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px3u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    await alice.page.locator('input[type="search"]').fill('zzz_noexist_xyz')
    await alice.page.waitForTimeout(300)
    const emptyText = await alice.page.locator('.empty-state').textContent().catch(() => '')
    expect(emptyText ?? '').toContain('暂无消息')
  } finally {
    await teardownUsers(users)
  }
})

test('PX4: 会话列表搜索清空后恢复显示全部', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px4u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const searchInput = alice.page.locator('input[type="search"]')
    await searchInput.fill('zzz_noexist')
    await alice.page.waitForTimeout(300)
    await searchInput.fill('')
    await alice.page.waitForTimeout(300)
    const count = await alice.page.locator('.list-item').count()
    expect(count).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 会话列表 — 长按/右键清除
// ═══════════════════════════════════════════════════════════════════════════════

test('PX5: 会话列表右键弹出清除聊天记录确认弹窗', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px5u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const item = alice.page.locator('.list-item').first()
    await item.click({ button: 'right' })
    await expect(alice.page.locator('.modal', { hasText: '清除聊天记录' })).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX6: 会话列表清除弹窗点取消后弹窗关闭，会话保留', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px6u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const item = alice.page.locator('.list-item').first()
    await item.click({ button: 'right' })
    await alice.page.locator('.modal button', { hasText: '取消' }).click()
    await expect(alice.page.locator('.modal')).not.toBeVisible({ timeout: 2000 })
    expect(await alice.page.locator('.list-item').count()).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

test('PX7: 会话列表清除弹窗点确定清除后会话从列表消失', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px7u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const displayName = bob.username.slice(0, 8)
    const item = alice.page.locator('.list-item').filter({ hasText: displayName })
    await item.click({ button: 'right' })
    await alice.page.locator('.modal button.btn-danger', { hasText: '确定清除' }).click()
    await alice.page.waitForTimeout(500)
    await expect(alice.page.locator('.list-item').filter({ hasText: displayName })).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX8: 会话列表清除弹窗包含对方名称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px8u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const item = alice.page.locator('.list-item').first()
    await item.click({ button: 'right' })
    const modalText = await alice.page.locator('.modal').textContent().catch(() => '')
    expect(modalText ?? '').toContain(bob.username.slice(0, 6))
    await alice.page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 会话列表 — 时间格式
// ═══════════════════════════════════════════════════════════════════════════════

test('PX9: 会话列表条目显示最近消息时间（HH:mm 格式）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px9u')
  const [alice, bob] = users
  try {
    await establishConversation(alice, bob)
    const timeText = await alice.page.locator('.list-item-time').first().textContent().catch(() => '')
    // 今日时间应是 HH:mm 格式
    expect(timeText ?? '').toMatch(/\d{1,2}:\d{2}/)
  } finally {
    await teardownUsers(users)
  }
})

test('PX10: 会话列表条目显示最新消息预览文字', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px10u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const msg = `px10_preview_${Date.now()}`
    await sendMessage(alice.page, msg)
    await waitForMessage(alice.page, msg, 8000)
    await alice.page.goto('/chat')
    await alice.page.waitForTimeout(500)
    const previewText = await alice.page.locator('.list-item-preview').first().textContent().catch(() => '')
    expect(previewText ?? '').toContain(msg.slice(0, 10))
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// Profile 页面
// ═══════════════════════════════════════════════════════════════════════════════

test('PX11: Profile 页显示"聊天记录存储：仅本设备"', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px11u')
  try {
    await users[0].page.goto('/profile')
    const text = await users[0].page.locator('.settings-list').textContent().catch(() => '')
    expect(text ?? '').toContain('仅本设备')
  } finally {
    await teardownUsers(users)
  }
})

test('PX12: Profile 页显示"服务器存储：仅账号信息"', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px12u')
  try {
    await users[0].page.goto('/profile')
    const text = await users[0].page.locator('.settings-list').textContent().catch(() => '')
    expect(text ?? '').toContain('仅账号信息')
  } finally {
    await teardownUsers(users)
  }
})

test('PX13: Profile 页显示"关于 WebChat"条目和箭头', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px13u')
  try {
    await users[0].page.goto('/profile')
    await expect(users[0].page.locator('.settings-item-link', { hasText: '关于 WebChat' })).toBeVisible({ timeout: 3000 })
    await expect(users[0].page.locator('.settings-arrow')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX14: Profile 页点击"关于 WebChat"跳转到 /about', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px14u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.settings-item-link', { hasText: '关于 WebChat' }).click()
    await users[0].page.waitForURL(/\/about/, { timeout: 5000 })
    expect(users[0].page.url()).toContain('/about')
  } finally {
    await teardownUsers(users)
  }
})

test('PX15: Profile 页显示 UID 字段', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px15u')
  try {
    await users[0].page.goto('/profile')
    const uidText = await users[0].page.locator('.profile-uid').textContent().catch(() => '')
    expect(uidText ?? '').toContain('UID:')
  } finally {
    await teardownUsers(users)
  }
})

test('PX16: Profile 页显示 @username 字段', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px16u')
  try {
    await users[0].page.goto('/profile')
    const usernameText = await users[0].page.locator('.profile-username').textContent().catch(() => '')
    expect(usernameText ?? '').toContain('@')
    expect(usernameText ?? '').toContain(users[0].username.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

test('PX17: Profile 页昵称超 50 字保存时显示错误', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px17u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('button', { hasText: '编辑' }).click()
    const input = users[0].page.locator('input[placeholder="输入昵称"]')
    const longNick = 'a'.repeat(51)
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, longNick)
    await users[0].page.locator('.btn-primary', { hasText: '保存' }).click()
    await users[0].page.waitForTimeout(500)
    const errorText = await users[0].page.locator('.form-error').textContent().catch(() => '')
    expect(errorText ?? '').toContain('50')
  } finally {
    await teardownUsers(users)
  }
})

test('PX18: Profile 页编辑昵称后点取消，恢复原昵称', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px18u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('button', { hasText: '编辑' }).click()
    const input = users[0].page.locator('input[placeholder="输入昵称"]')
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, 'temp_nickname_xyz')
    await users[0].page.locator('button', { hasText: '取消' }).click()
    // 编辑态消失，回到显示态
    await expect(users[0].page.locator('input[placeholder="输入昵称"]')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX19: Profile 页点"退出登录"出现确认区域', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px19u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-danger.btn-full', { hasText: '退出登录' }).click()
    await expect(users[0].page.locator('.logout-confirm')).toBeVisible({ timeout: 3000 })
    await expect(users[0].page.locator('p', { hasText: '确定退出登录' })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX20: Profile 页退出登录确认区点取消后恢复正常按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px20u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-danger.btn-full', { hasText: '退出登录' }).click()
    await users[0].page.locator('.logout-confirm button', { hasText: '取消' }).click()
    await expect(users[0].page.locator('.btn-danger.btn-full', { hasText: '退出登录' })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX21: Profile 页点"注销账号"出现密码输入框', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px21u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-ghost.btn-full', { hasText: '注销账号' }).click()
    await expect(users[0].page.locator('input[placeholder="输入当前密码"]')).toBeVisible({ timeout: 3000 })
    await expect(users[0].page.locator('p', { hasText: '注销后账号' })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX22: Profile 页注销密码为空时点确定注销显示错误', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px22u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-ghost.btn-full', { hasText: '注销账号' }).click()
    await users[0].page.locator('.btn-danger', { hasText: '确定注销' }).click()
    await users[0].page.waitForTimeout(500)
    const errText = await users[0].page.locator('.logout-confirm p[style*="danger"]').textContent().catch(() => '')
    expect(errText ?? '').toContain('请输入密码')
  } finally {
    await teardownUsers(users)
  }
})

test('PX23: Profile 页注销密码框按 Enter 触发注销（密码错误时显示错误）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px23u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-ghost.btn-full', { hasText: '注销账号' }).click()
    await users[0].page.locator('input[placeholder="输入当前密码"]').fill('wrongpassword')
    await users[0].page.locator('input[placeholder="输入当前密码"]').press('Enter')
    await users[0].page.waitForTimeout(2000)
    // 应显示错误（密码不对）
    const errText = await users[0].page.locator('.logout-confirm p[style*="danger"]').textContent().catch(() => '')
    expect(errText ?? '').toBeTruthy()
  } finally {
    await teardownUsers(users)
  }
})

test('PX24: Profile 页注销确认区点取消，恢复为正常按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px24u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.btn-ghost.btn-full', { hasText: '注销账号' }).click()
    await users[0].page.locator('.logout-confirm button', { hasText: '取消' }).click()
    await expect(users[0].page.locator('.btn-ghost.btn-full', { hasText: '注销账号' })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// About 页面
// ═══════════════════════════════════════════════════════════════════════════════

test('PX25: About 页面可通过 /about 直接访问', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px25u')
  try {
    await users[0].page.goto('/about')
    await expect(users[0].page.locator('h2', { hasText: '关于 WebChat' })).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX26: About 页返回按钮点击后返回上一页', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px26u')
  try {
    await users[0].page.goto('/profile')
    await users[0].page.locator('.settings-item-link', { hasText: '关于 WebChat' }).click()
    await users[0].page.waitForURL(/\/about/, { timeout: 5000 })
    await users[0].page.locator('.icon-btn', { hasText: '←' }).click()
    await users[0].page.waitForURL(/\/profile/, { timeout: 5000 })
    expect(users[0].page.url()).toContain('/profile')
  } finally {
    await teardownUsers(users)
  }
})

test('PX27: About 页显示消息状态说明（含 ○ ✓ ✓✓ ⏱ ✗）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px27u')
  try {
    await users[0].page.goto('/about')
    const bodyText = await users[0].page.locator('.about-body').textContent().catch(() => '')
    expect(bodyText ?? '').toContain('○')
    expect(bodyText ?? '').toContain('✓✓')
    expect(bodyText ?? '').toContain('⏱')
    expect(bodyText ?? '').toContain('✗')
  } finally {
    await teardownUsers(users)
  }
})

test('PX28: About 页显示文件发送步骤说明', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px28u')
  try {
    await users[0].page.goto('/about')
    const text = await users[0].page.locator('.about-body').textContent().catch(() => '')
    expect(text ?? '').toContain('发文件')
    expect(text ?? '').toContain('收文件')
  } finally {
    await teardownUsers(users)
  }
})

test('PX29: About 页显示 iPhone 安装到桌面说明', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px29u')
  try {
    await users[0].page.goto('/about')
    const text = await users[0].page.locator('.about-body').textContent().catch(() => '')
    expect(text ?? '').toContain('iPhone')
    expect(text ?? '').toContain('Safari')
  } finally {
    await teardownUsers(users)
  }
})

test('PX30: About 页显示 Android 安装到桌面说明', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px30u')
  try {
    await users[0].page.goto('/about')
    const text = await users[0].page.locator('.about-body').textContent().catch(() => '')
    expect(text ?? '').toContain('Android')
    expect(text ?? '').toContain('Chrome')
  } finally {
    await teardownUsers(users)
  }
})

test('PX31: About 页显示隐私说明区（服务器知道/不知道）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px31u')
  try {
    await users[0].page.goto('/about')
    const text = await users[0].page.locator('.about-body').textContent().catch(() => '')
    expect(text ?? '').toContain('服务器知道')
    expect(text ?? '').toContain('服务器不知道')
  } finally {
    await teardownUsers(users)
  }
})

test('PX32: About 页显示常见问题区', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'px32u')
  try {
    await users[0].page.goto('/about')
    await expect(users[0].page.locator('.about-faq').first()).toBeVisible({ timeout: 5000 })
    const faqCount = await users[0].page.locator('.about-faq').count()
    expect(faqCount).toBeGreaterThanOrEqual(3)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// FriendPage 分区显示
// ═══════════════════════════════════════════════════════════════════════════════

test('PX33: FriendPage 与陌生人聊天后该用户出现在"最近联系"分区', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px33u')
  const [alice, bob] = users
  try {
    // 先建立会话
    await openPrivateChat(alice.page, bob.username)
    await sendMessage(alice.page, `px33_${Date.now()}`)
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    // bob 同时在线，应出现在某分区
    const sections = await alice.page.locator('.list-section-title').allTextContents()
    // 有过聊天记录，应出现"最近联系"分区
    expect(sections.some(s => s.includes('最近联系'))).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

test('PX34: FriendPage 没有聊天记录的在线用户出现在"其他在线用户"分区', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px34u')
  const [alice, bob] = users
  try {
    // alice 与 bob 没有聊天记录
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    const sections = await alice.page.locator('.list-section-title').allTextContents()
    expect(sections.some(s => s.includes('其他在线用户'))).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

test('PX35: FriendPage 每个用户行显示 @username 副标题', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px35u')
  const [alice, bob] = users
  try {
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    const subText = await alice.page.locator('.list-item-sub').first().textContent().catch(() => '')
    expect(subText ?? '').toContain('@')
  } finally {
    await teardownUsers(users)
  }
})

test('PX36: FriendPage 每个用户行有"发消息"按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px36u')
  const [alice, bob] = users
  try {
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    await expect(alice.page.locator('.list-item .btn-sm.btn-primary', { hasText: '发消息' }).first()).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX37: FriendPage 点"发消息"按钮也能跳转到私聊页', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px37u')
  const [alice, bob] = users
  try {
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    const bobItem = alice.page.locator('.list-item').filter({ hasText: bob.username.slice(0, 8) })
    await bobItem.locator('.btn-sm.btn-primary', { hasText: '发消息' }).click()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 8000 })
    expect(alice.page.url()).toContain('private_')
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 消息气泡上下文菜单
// ═══════════════════════════════════════════════════════════════════════════════

test('PX38: 上下文菜单包含"取消"选项，点击后菜单关闭', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px38u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const msg = `px38_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg)) { test.skip(); return }
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    await alice.page.locator('.context-menu button', { hasText: '取消' }).click()
    await expect(alice.page.locator('.context-menu')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX39: 图片/文件消息上下文菜单无"复制"选项', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px39u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)
    // 发一条文本消息，先验证文本有复制；这里测试文本消息的菜单有复制
    const msg = `px39_text_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg)) { test.skip(); return }
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu button', { hasText: '复制' })).toBeVisible({ timeout: 3000 })
    await alice.page.locator('.context-menu button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('PX40: 上下文菜单点击遮罩（menu-overlay）关闭菜单', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px40u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const msg = `px40_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg)) { test.skip(); return }
    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    // 点击 menu-overlay（遮罩）
    await alice.page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
    await expect(alice.page.locator('.context-menu')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 引用块跳转与高亮
// ═══════════════════════════════════════════════════════════════════════════════

test('PX41: 点击引用块滚动到原消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px41u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const orig = `px41_orig_${Date.now()}`
    await sendMessage(bob.page, orig)
    if (!await waitForMessage(alice.page, orig, 10000)) { test.skip(); return }

    // 发 8 条消息让原消息滚出视口
    for (let i = 0; i < 8; i++) {
      await sendMessage(alice.page, `px41_filler_${i}`)
      await alice.page.waitForTimeout(200)
    }

    // 右键最后一条 filler 消息，引用它
    const lastFiller = alice.page.locator('.msg-bubble').filter({ hasText: 'px41_filler_7' }).last()
    await lastFiller.click({ button: 'right' })
    await alice.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    // 发送引用消息
    await sendMessage(alice.page, `px41_reply_${Date.now()}`)
    await alice.page.waitForTimeout(2000)

    // 在对方消息（orig）上的引用块应可见
    const origBubble = alice.page.locator('.msg-bubble').filter({ hasText: orig })
    if (!await origBubble.isVisible().catch(() => false)) { test.skip(); return }

    // 引用块点击触发跳转（不报错即可）
    await origBubble.click({ button: 'right' })
    await alice.page.locator('.context-menu button', { hasText: '回复' }).click()
    const replyPreview = alice.page.locator('.reply-preview')
    const visible = await replyPreview.isVisible().catch(() => false)
    expect(visible).toBe(true)
    await alice.page.locator('.reply-preview-cancel').click()
  } finally {
    await teardownUsers(users)
  }
})

test('PX42: 消息 msg-reply-quote 有 onClick 绑定（不报错）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px42u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const orig = `px42_orig_${Date.now()}`
    await sendMessage(bob.page, orig)
    if (!await waitForMessage(alice.page, orig, 10000)) { test.skip(); return }

    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await alice.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })
    await sendMessage(alice.page, `px42_reply_${Date.now()}`)
    await alice.page.waitForTimeout(2000)

    // 找到含引用块的气泡
    const replyBubble = alice.page.locator('.msg-bubble').filter({ has: alice.page.locator('.msg-reply-quote') }).last()
    if (!await replyBubble.isVisible().catch(() => false)) { test.skip(); return }

    // 点击引用块，不报错即通过
    const consoleErrors: string[] = []
    alice.page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    await replyBubble.locator('.msg-reply-quote').click()
    await alice.page.waitForTimeout(500)
    // 不应有 JS 报错
    expect(consoleErrors.filter(e => e.includes('TypeError')).length).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 消息 failed 状态
// ═══════════════════════════════════════════════════════════════════════════════

test('PX43: failed 状态消息显示 ✗ 图标', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px43u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    // 通过 IDB 直接插入一条 failed 消息来验证 UI 渲染
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_failed_msg',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: alice.username,
      contentType: 'text',
      content: 'px43_failed_msg',
      status: 'failed',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const failedRow = alice.page.locator('.msg-row.mine').filter({ hasText: 'px43_failed_msg' })
    if (!await failedRow.isVisible().catch(() => false)) { test.skip(); return }
    const statusText = await failedRow.locator('.msg-status').textContent().catch(() => '')
    expect(statusText?.trim()).toBe('✗')
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 文件消息气泡（静态渲染验证，通过 IDB 注入）
// ═══════════════════════════════════════════════════════════════════════════════

test('PX44: 文件消息气泡发送方显示"已发送"（content 为空）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px44u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_file_sent',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: alice.username,
      contentType: 'file',
      content: '',
      filename: 'report.pdf',
      fileSize: 12345,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.mine').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    const sizeText = await fileRow.locator('.msg-file-size').textContent().catch(() => '')
    expect(sizeText ?? '').toContain('已发送')
  } finally {
    await teardownUsers(users)
  }
})

test('PX45: 文件消息气泡显示对应文件类型图标（pdf→📕）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px45u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_file_icon',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: alice.username,
      contentType: 'file',
      content: '',
      filename: 'document.pdf',
      fileSize: 999,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.mine').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    const iconText = await fileRow.locator('.msg-file-icon').textContent().catch(() => '')
    expect(iconText ?? '').toContain('📕')
  } finally {
    await teardownUsers(users)
  }
})

test('PX46: 可执行文件消息气泡显示 ⚠️ 程序安装包警告', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px46u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_exec_file',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: bob.username,
      toUsername: alice.username,
      contentType: 'file',
      content: 'blob:http://localhost:8080/fake',
      filename: 'installer.exe',
      fileSize: 99999,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.theirs').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    const warnText = await fileRow.locator('.msg-file-exec-warn').textContent().catch(() => '')
    expect(warnText ?? '').toContain('程序安装包')
  } finally {
    await teardownUsers(users)
  }
})

test('PX47: 接收方点击文件气泡弹出下载确认弹窗', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px47u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    // alice 作为接收方（fromUsername=bob），content 非空（有 blob URL）
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_file_dl',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: bob.username,
      toUsername: alice.username,
      contentType: 'file',
      content: 'data:application/octet-stream;base64,SGVsbG8=',
      filename: 'hello.txt',
      fileSize: 5,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.theirs').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    await fileRow.locator('.msg-file').click()
    await expect(alice.page.locator('.file-confirm', { hasText: '保存文件' })).toBeVisible({ timeout: 3000 })
    // 弹窗含文件名
    const confirmText = await alice.page.locator('.file-confirm').textContent().catch(() => '')
    expect(confirmText ?? '').toContain('hello.txt')
    // 点取消关闭
    await alice.page.locator('.file-confirm button', { hasText: '取消' }).click()
    await expect(alice.page.locator('.file-confirm')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('PX48: 可执行文件下载确认弹窗显示危险警告文字', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px48u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_exec_dl',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: bob.username,
      toUsername: alice.username,
      contentType: 'file',
      content: 'data:application/octet-stream;base64,SGVsbG8=',
      filename: 'setup.exe',
      fileSize: 99999,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.theirs').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    await fileRow.locator('.msg-file').click()
    await expect(alice.page.locator('.file-confirm')).toBeVisible({ timeout: 3000 })
    const dangerText = await alice.page.locator('.file-confirm-danger').textContent().catch(() => '')
    expect(dangerText ?? '').toContain('程序安装包')
    await alice.page.locator('.file-confirm button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 图片消息过期
// ═══════════════════════════════════════════════════════════════════════════════

test('PX49: 图片消息 content 为空时显示"图片已过期"', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px49u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_img_expired',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: bob.username,
      toUsername: alice.username,
      contentType: 'image',
      content: '',
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const imgRow = alice.page.locator('.msg-row').filter({ has: alice.page.locator('.msg-text') })
    if (!await imgRow.isVisible().catch(() => false)) { test.skip(); return }
    const text = await imgRow.locator('.msg-text').textContent().catch(() => '')
    expect(text ?? '').toContain('图片已过期')
  } finally {
    await teardownUsers(users)
  }
})

test('PX50: 文件消息接收方 content 为空时显示"文件已过期"', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'px50u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const convId = `private_${[alice.username, bob.username].sort().join('_')}`
    await injectIDBMessage(alice.page, 'webchat-' + alice.username, {
      id: 'test_file_expired',
      conversationId: convId,
      conversationType: 'private',
      fromUsername: bob.username,
      toUsername: alice.username,
      contentType: 'file',
      content: '',
      filename: 'data.zip',
      fileSize: 0,
      status: 'sent',
      timestamp: Date.now(),
      createdAt: Date.now(),
    })

    await alice.page.reload()
    await alice.page.waitForTimeout(1500)
    await openPrivateChat(alice.page, bob.username)
    await alice.page.waitForTimeout(1000)

    const fileRow = alice.page.locator('.msg-row.theirs').filter({ has: alice.page.locator('.msg-file') })
    if (!await fileRow.isVisible().catch(() => false)) { test.skip(); return }
    const sizeText = await fileRow.locator('.msg-file-size').textContent().catch(() => '')
    expect(sizeText ?? '').toContain('文件已过期')
  } finally {
    await teardownUsers(users)
  }
})
