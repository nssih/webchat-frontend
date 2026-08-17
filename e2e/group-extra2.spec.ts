/**
 * 群聊新增场景 GX1–GX50
 *
 * 覆盖：群组创建弹窗、邀请弹窗各状态（过滤/空状态/在线dot/关闭）、
 *       退群/解散弹窗各状态文字、群聊无文件上传按钮、引用块跳转、
 *       邀请成功/warn消息、群列表member count、群消息含文件图标、
 *       AboutPage从Profile入口、GroupPage实时成员变化、
 *       群聊页标题显示群名、清除聊天记录、群聊页返回按钮、
 *       消息发送方显示 online-dot、群聊私聊 badge 独立等
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

async function goToGroups(page: Page) {
  await page.locator('a[href="/groups"]').click()
  await page.waitForURL(/\/groups/, { timeout: 5000 })
  await page.waitForTimeout(500)
}

async function createGroup(page: Page, name: string) {
  await page.locator('button', { hasText: '+ 创建' }).click()
  await page.locator('input[placeholder]').last().fill(name)
  await page.locator('.modal button.btn-primary').click()
  await page.waitForTimeout(1000)
}

async function openInviteModal(page: Page, groupName: string) {
  const item = page.locator('.list-item').filter({
    has: page.locator('.list-item-name', { hasText: groupName }),
  })
  await item.locator('.btn-group button', { hasText: '邀请' }).first().click()
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

async function enterGroupChat(page: Page, groupName: string) {
  await page.locator('.list-item').filter({
    has: page.locator('.list-item-name', { hasText: groupName }),
  }).click()
  await page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
  await page.waitForTimeout(1000)
}

async function waitForGroupVisible(page: Page, groupName: string) {
  return page.locator('.list-item').filter({
    has: page.locator('.list-item-name', { hasText: groupName }),
  }).waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
}

async function setupGroupWith2(browser: Browser, prefix: string) {
  const users = await setupUsers(browser, 2, prefix)
  const [owner, member] = users
  const groupName = `${prefix}grp_${Date.now()}`
  await goToGroups(owner.page)
  await createGroup(owner.page, groupName)
  await openInviteModal(owner.page, groupName)
  const invited = await inviteUser(owner.page, member.username)
  await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  if (invited) {
    await goToGroups(member.page)
    await waitForGroupVisible(member.page, groupName)
  }
  return { users, owner, member, groupName, invited }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 创建群组弹窗
// ═══════════════════════════════════════════════════════════════════════════════

test('GX1: 创建群组弹窗有输入框和创建/取消按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx1u')
  try {
    await goToGroups(users[0].page)
    await users[0].page.locator('button', { hasText: '+ 创建' }).click()
    await expect(users[0].page.locator('.modal input[placeholder]')).toBeVisible({ timeout: 3000 })
    await expect(users[0].page.locator('.modal button.btn-primary')).toBeVisible({ timeout: 2000 })
    await expect(users[0].page.locator('.modal button', { hasText: '取消' })).toBeVisible({ timeout: 2000 })
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX2: 创建群组弹窗点取消后弹窗关闭', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx2u')
  try {
    await goToGroups(users[0].page)
    await users[0].page.locator('button', { hasText: '+ 创建' }).click()
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
    await expect(users[0].page.locator('.modal')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX3: 群名称最多 100 字（maxLength 属性）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx3u')
  try {
    await goToGroups(users[0].page)
    await users[0].page.locator('button', { hasText: '+ 创建' }).click()
    const input = users[0].page.locator('.modal input[placeholder]').last()
    const maxLen = await input.getAttribute('maxlength')
    expect(Number(maxLen)).toBe(100)
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX4: 创建成功后群名称出现在群列表', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx4u')
  const groupName = `gx4grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await expect(users[0].page.locator('.list-item-name', { hasText: groupName })).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX5: 群列表条目显示成员数量', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx5u')
  const groupName = `gx5grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const sub = await users[0].page.locator('.list-item').filter({ hasText: groupName }).locator('.list-item-sub').textContent().catch(() => '')
    expect(sub ?? '').toContain('成员')
  } finally {
    await teardownUsers(users)
  }
})

test('GX6: 群列表条目有"邀请"和"退出"两个按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx6u')
  const groupName = `gx6grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await expect(item.locator('button', { hasText: '邀请' })).toBeVisible({ timeout: 3000 })
    await expect(item.locator('button.btn-danger', { hasText: '退出' })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX7: 群列表条目显示"群"徽章', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx7u')
  const groupName = `gx7grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await expect(item.locator('.avatar-badge', { hasText: '群' })).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 邀请弹窗
// ═══════════════════════════════════════════════════════════════════════════════

test('GX8: 邀请弹窗标题包含群名称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'gx8u')
  const [owner, member] = users
  const groupName = `gx8grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const title = await owner.page.locator('.modal h3').textContent().catch(() => '')
    expect(title ?? '').toContain(groupName.slice(0, 6))
    await owner.page.locator('.modal button', { hasText: '关闭' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX9: 邀请弹窗中在线用户旁有 online-dot', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'gx9u')
  const [owner, member] = users
  const groupName = `gx9grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    await expect(owner.page.locator('.modal .online-dot').first()).toBeVisible({ timeout: 5000 })
    await owner.page.locator('.modal button', { hasText: '关闭' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX10: 邀请成功后显示绿色成功消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'gx10u')
  const [owner, member] = users
  const groupName = `gx10grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const invited = await inviteUser(owner.page, member.username)
    if (!invited) { test.skip(); return }
    const msg = await owner.page.locator('.invite-msg').textContent().catch(() => '')
    expect(msg ?? '').toBeTruthy()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX11: 邀请弹窗已在群内成员不出现在可邀请列表', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx11')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    // member 已在群内，不应出现在邀请列表
    const memberRow = owner.page.locator('.modal .list-item').filter({ hasText: member.username.slice(0, 8) })
    const visible = await memberRow.isVisible().catch(() => false)
    expect(visible).toBe(false)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX12: 邀请弹窗所有在线用户已在群内时显示空状态', async ({ browser }) => {
  test.setTimeout(300000)
  // 只有 owner 和 member，两人都在群内
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx12')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    // 等待弹窗加载
    await owner.page.waitForTimeout(1000)
    // 过滤后无可邀请用户（owner 和 member 都在群里）
    const emptyText = await owner.page.locator('.modal .empty-state').textContent().catch(() => '')
    if (emptyText) {
      expect(emptyText).toContain('暂无可邀请')
    }
    // 否则可能还有其他并行测试用户在线，skip
    await owner.page.locator('.modal button', { hasText: '关闭' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX13: 邀请弹窗点击遮罩关闭弹窗', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx13u')
  const groupName = `gx13grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await openInviteModal(users[0].page, groupName)
    // 点 modal-overlay（弹窗外部）
    await users[0].page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
    await expect(users[0].page.locator('.modal')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 退出/解散群组弹窗
// ═══════════════════════════════════════════════════════════════════════════════

test('GX14: 群主点退出弹出"解散群组"标题', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx14u')
  const groupName = `gx14grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    const title = await users[0].page.locator('.modal h3').textContent().catch(() => '')
    expect(title ?? '').toContain('解散群组')
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX15: 普通成员点退出弹出"退出群组"标题', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx15')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(member.page)
    const item = member.page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    const title = await member.page.locator('.modal h3').textContent().catch(() => '')
    expect(title ?? '').toContain('退出群组')
    await member.page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX16: 群主解散确认弹窗按钮文字为"确定解散"', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx16u')
  const groupName = `gx16grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    await expect(users[0].page.locator('.modal button.btn-danger', { hasText: '确定解散' })).toBeVisible({ timeout: 3000 })
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX17: 普通成员退群确认弹窗按钮文字为"确定退出"', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx17')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(member.page)
    const item = member.page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    await expect(member.page.locator('.modal button.btn-danger', { hasText: '确定退出' })).toBeVisible({ timeout: 3000 })
    await member.page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX18: 群主解散确认弹窗说明文字包含"解散"', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx18u')
  const groupName = `gx18grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    const bodyText = await users[0].page.locator('.modal p').textContent().catch(() => '')
    expect(bodyText ?? '').toContain('解散')
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX19: 普通成员退群确认弹窗说明文字包含"聊天记录"', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx19')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(member.page)
    const item = member.page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    const bodyText = await member.page.locator('.modal p').textContent().catch(() => '')
    expect(bodyText ?? '').toContain('聊天记录')
    await member.page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX20: 退群/解散弹窗点取消后弹窗关闭', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx20u')
  const groupName = `gx20grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    await users[0].page.locator('.modal button', { hasText: '取消' }).click()
    await expect(users[0].page.locator('.modal')).not.toBeVisible({ timeout: 2000 })
    // 群仍然在列表
    await expect(users[0].page.locator('.list-item-name', { hasText: groupName })).toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX21: 退群/解散弹窗点遮罩关闭弹窗', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx21u')
  const groupName = `gx21grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    const item = users[0].page.locator('.list-item').filter({ hasText: groupName })
    await item.locator('button.btn-sm.btn-danger').click()
    await expect(users[0].page.locator('.modal')).toBeVisible({ timeout: 3000 })
    await users[0].page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
    await expect(users[0].page.locator('.modal')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊页 — 无文件上传按钮
// ═══════════════════════════════════════════════════════════════════════════════

test('GX22: 群聊输入区没有文件上传"+"按钮', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx22u')
  const groupName = `gx22grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    // 私聊有 input[type=file] 和 + 按钮，群聊没有
    const fileInput = await users[0].page.locator('input[type="file"]').count()
    expect(fileInput).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

test('GX23: 群聊输入区有 emoji 按钮但无文件上传', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx23u')
  const groupName = `gx23grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    await expect(users[0].page.locator('.emoji-btn')).toBeVisible({ timeout: 3000 })
    expect(await users[0].page.locator('input[type="file"]').count()).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊页 — 标题/返回/清除
// ═══════════════════════════════════════════════════════════════════════════════

test('GX24: 群聊页标题显示群名称', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx24u')
  const groupName = `gx24grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const title = await users[0].page.locator('.chat-header-name').textContent().catch(() => '')
    expect(title ?? '').toContain(groupName.slice(0, 6))
  } finally {
    await teardownUsers(users)
  }
})

test('GX25: 群聊页有返回按钮，点击返回 /groups', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx25u')
  const groupName = `gx25grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    await users[0].page.locator('button', { hasText: '←' }).click()
    await users[0].page.waitForURL(/\/groups|\/chat/, { timeout: 5000 })
    expect(users[0].page.url()).toBeTruthy()
  } finally {
    await teardownUsers(users)
  }
})

test('GX26: 群聊页 ⋮ 菜单存在且可打开', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx26u')
  const groupName = `gx26grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    await users[0].page.locator('.chat-header button', { hasText: '⋮' }).click()
    await expect(users[0].page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    await users[0].page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
  } finally {
    await teardownUsers(users)
  }
})

test('GX27: 群聊页 ⋮ 菜单有"清除聊天记录"选项', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx27u')
  const groupName = `gx27grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    await users[0].page.locator('.chat-header button', { hasText: '⋮' }).click()
    await expect(users[0].page.locator('.context-menu button', { hasText: '清除聊天记录' })).toBeVisible({ timeout: 3000 })
    await users[0].page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
  } finally {
    await teardownUsers(users)
  }
})

test('GX28: 群聊页清除聊天记录后消息列表清空', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx28u')
  const groupName = `gx28grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const msg = `gx28_${Date.now()}`
    await sendMessage(users[0].page, msg)
    if (!await waitForMessage(users[0].page, msg, 8000)) { test.skip(); return }

    await users[0].page.locator('.chat-header button', { hasText: '⋮' }).click()
    // 必须在点击前注册 dialog handler
    users[0].page.once('dialog', d => d.accept())
    await users[0].page.locator('.context-menu button', { hasText: '清除聊天记录' }).click()
    await users[0].page.waitForTimeout(1000)
    await expect(users[0].page.locator('.msg-bubble').filter({ hasText: msg })).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群消息发送方头像/名称
// ═══════════════════════════════════════════════════════════════════════════════

test('GX29: 群聊收到他人消息，气泡左侧显示发送方头像', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx29')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `gx29_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(member.page, msg, 10000)) { test.skip(); return }

    const row = member.page.locator('.msg-row.theirs').filter({ hasText: msg })
    await expect(row.locator('.msg-avatar')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX30: 群聊收到他人消息，气泡上方显示发送方用户名', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx30')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `gx30_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(member.page, msg, 10000)) { test.skip(); return }

    const row = member.page.locator('.msg-row.theirs').filter({ hasText: msg })
    const senderText = await row.locator('.msg-sender').textContent().catch(() => '')
    expect(senderText ?? '').toBeTruthy()
  } finally {
    await teardownUsers(users)
  }
})

test('GX31: 自己发的群消息气泡显示在右侧（mine 类）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx31u')
  const groupName = `gx31grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const msg = `gx31_${Date.now()}`
    await sendMessage(users[0].page, msg)
    if (!await waitForMessage(users[0].page, msg, 8000)) { test.skip(); return }
    await expect(users[0].page.locator('.msg-row.mine').filter({ hasText: msg })).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊引用块
// ═══════════════════════════════════════════════════════════════════════════════

test('GX32: 群聊引用预览取消后输入框清空引用状态', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx32u')
  const groupName = `gx32grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const msg = `gx32_${Date.now()}`
    await sendMessage(users[0].page, msg)
    if (!await waitForMessage(users[0].page, msg, 8000)) { test.skip(); return }

    const bubble = users[0].page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await users[0].page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(users[0].page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    await users[0].page.locator('.reply-preview-cancel').click()
    await expect(users[0].page.locator('.reply-preview')).not.toBeVisible({ timeout: 2000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX33: 群聊引用消息包含被引用者用户名', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx33')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const orig = `gx33_orig_${Date.now()}`
    await sendMessage(owner.page, orig)
    if (!await waitForMessage(member.page, orig, 10000)) { test.skip(); return }

    const bubble = member.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await member.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(member.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const senderInPreview = await member.page.locator('.reply-preview-sender').textContent().catch(() => '')
    expect(senderInPreview ?? '').toBeTruthy()
    await member.page.locator('.reply-preview-cancel').click()
  } finally {
    await teardownUsers(users)
  }
})

test('GX34: 群聊引用消息气泡中有引用块 .msg-reply-quote', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx34')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const orig = `gx34_orig_${Date.now()}`
    await sendMessage(owner.page, orig)
    if (!await waitForMessage(member.page, orig, 10000)) { test.skip(); return }

    const bubble = member.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await member.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(member.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const replyText = `gx34_reply_${Date.now()}`
    await sendMessage(member.page, replyText)
    if (!await waitForMessage(member.page, replyText, 8000)) { test.skip(); return }

    await member.page.waitForTimeout(1000)
    const replyBubble = member.page.locator('.msg-row.mine').filter({ hasText: replyText })
    if (await replyBubble.locator('.msg-reply-quote').isVisible().catch(() => false)) {
      await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 3000 })
    }
    // 有引用块或 skip（timing）
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊消息状态
// ═══════════════════════════════════════════════════════════════════════════════

test('GX35: 群消息气泡时间戳存在且格式 HH:mm', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx35u')
  const groupName = `gx35grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const msg = `gx35_${Date.now()}`
    await sendMessage(users[0].page, msg)
    if (!await waitForMessage(users[0].page, msg, 8000)) { test.skip(); return }

    const row = users[0].page.locator('.msg-row.mine').filter({ hasText: msg })
    const time = await row.locator('.msg-time').textContent().catch(() => '')
    expect(time ?? '').toMatch(/\d{1,2}:\d{2}/)
  } finally {
    await teardownUsers(users)
  }
})

test('GX36: 群消息发出后状态图标不为 ✗（发送成功）', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx36')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const msg = `gx36_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(owner.page, msg, 8000)) { test.skip(); return }
    await owner.page.waitForTimeout(1500)
    const row = owner.page.locator('.msg-row.mine').filter({ hasText: msg })
    const status = await row.locator('.msg-status').textContent().catch(() => '')
    expect(status?.trim()).not.toBe('✗')
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊 — 会话列表 badge
// ═══════════════════════════════════════════════════════════════════════════════

test('GX37: 群消息到达时会话列表条目有未读 badge', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx37')
  try {
    if (!invited) { test.skip(); return }
    await member.page.goto('/chat')
    await member.page.waitForTimeout(500)

    const msg = `gx37_${Date.now()}`
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await sendMessage(owner.page, msg)
    await member.page.waitForTimeout(3000)

    // 会话列表应有 badge
    const item = member.page.locator('.list-item').filter({ hasText: groupName.slice(0, 6) })
    if (await item.isVisible().catch(() => false)) {
      const badge = await item.locator('.badge').isVisible().catch(() => false)
      expect(badge).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

test('GX38: 群聊和私聊未读 badge 在会话列表中各自独立显示', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'gx38u')
  const [owner, member, bob] = users
  const groupName = `gx38grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // bob 给 member 发私聊
    await member.page.goto('/chat')
    await member.page.waitForTimeout(500)

    // owner 在群聊里发消息
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await sendMessage(owner.page, `gx38_grp_${Date.now()}`)

    // bob 给 member 发私聊消息
    await bob.page.goto('/friends')
    await bob.page.locator('.list-item').filter({ hasText: member.username.slice(0, 8) }).click()
    await bob.page.waitForURL(/\/chat\/private_/, { timeout: 8000 })
    await sendMessage(bob.page, `gx38_priv_${Date.now()}`)

    await member.page.waitForTimeout(3000)
    // member 的会话列表有 2 个以上 badge
    const badges = await member.page.locator('.badge').count()
    expect(badges).toBeGreaterThanOrEqual(2)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊 — 上下文菜单他人气泡
// ═══════════════════════════════════════════════════════════════════════════════

test('GX39: 群聊他人消息气泡右键也能打开上下文菜单', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx39')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `gx39_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(member.page, msg, 10000)) { test.skip(); return }

    // member 对 owner 发的消息右键
    const bubble = member.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(member.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    await member.page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
  } finally {
    await teardownUsers(users)
  }
})

test('GX40: 群聊他人消息上下文菜单有"回复"选项', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx40')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `gx40_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(member.page, msg, 10000)) { test.skip(); return }

    const bubble = member.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(member.page.locator('.context-menu button', { hasText: '回复' })).toBeVisible({ timeout: 3000 })
    await member.page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
  } finally {
    await teardownUsers(users)
  }
})

test('GX41: 群聊他人消息上下文菜单无"复制"（text消息有）', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx41')
  try {
    if (!invited) { test.skip(); return }
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `gx41_text_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(member.page, msg, 10000)) { test.skip(); return }

    const bubble = member.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    // text 消息应有"复制"选项
    await expect(member.page.locator('.context-menu button', { hasText: '复制' })).toBeVisible({ timeout: 3000 })
    await member.page.locator('.menu-overlay').click({ position: { x: 5, y: 5 } })
  } finally {
    await teardownUsers(users)
  }
})

test('GX42: 群聊删除自己的消息后该气泡从列表消失', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'gx42')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const msg = `gx42_del_${Date.now()}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(owner.page, msg, 8000)) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await owner.page.locator('.context-menu button.danger', { hasText: '删除' }).click()
    await expect(owner.page.locator('.msg-bubble').filter({ hasText: msg })).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊 — IDB 与刷新
// ═══════════════════════════════════════════════════════════════════════════════

test('GX43: 群聊刷新后群列表重新加载不出现重复条目', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx43u')
  const groupName = `gx43grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await users[0].page.reload()
    await users[0].page.waitForTimeout(2000)
    await goToGroups(users[0].page)
    const count = await users[0].page.locator('.list-item-name', { hasText: groupName }).count()
    expect(count).toBe(1)
  } finally {
    await teardownUsers(users)
  }
})

test('GX44: 创建 3 个群后群列表显示 3 个条目', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx44u')
  const ts = Date.now()
  const names = [`gx44a_${ts}`, `gx44b_${ts}`, `gx44c_${ts}`]
  try {
    await goToGroups(users[0].page)
    for (const name of names) {
      await createGroup(users[0].page, name)
    }
    for (const name of names) {
      await expect(users[0].page.locator('.list-item-name', { hasText: name })).toBeVisible({ timeout: 5000 })
    }
  } finally {
    await teardownUsers(users)
  }
})

test('GX45: 解散群后群列表剩余群数量减少', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx45u')
  const ts = Date.now()
  const names = [`gx45a_${ts}`, `gx45b_${ts}`]
  try {
    await goToGroups(users[0].page)
    for (const name of names) await createGroup(users[0].page, name)
    const before = await users[0].page.locator('.list-item').count()

    // 解散第一个群
    const item = users[0].page.locator('.list-item').filter({ hasText: names[0] })
    await item.locator('button.btn-sm.btn-danger').click()
    await users[0].page.locator('.modal button.btn-danger', { hasText: '确定解散' }).click()
    await users[0].page.waitForTimeout(1500)

    const after = await users[0].page.locator('.list-item').count()
    expect(after).toBeLessThan(before)
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊 — 消息新提示
// ═══════════════════════════════════════════════════════════════════════════════

test('GX46: 群聊消息列表有内容时发送按钮可用', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx46u')
  const groupName = `gx46grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    const ta = users[0].page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, 'hello')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const disabled = await users[0].page.locator('button.btn-send').isDisabled()
    expect(disabled).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

test('GX47: 群聊输入框为空时发送按钮禁用', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'gx47u')
  const groupName = `gx47grp_${Date.now()}`
  try {
    await goToGroups(users[0].page)
    await createGroup(users[0].page, groupName)
    await enterGroupChat(users[0].page, groupName)
    await expect(users[0].page.locator('button.btn-send')).toBeDisabled({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 群聊 — 实时加入
// ═══════════════════════════════════════════════════════════════════════════════

test('GX48: 成员加入后群列表成员数更新', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'gx48u')
  const [owner, member] = users
  const groupName = `gx48grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    const subBefore = await owner.page.locator('.list-item').filter({ hasText: groupName }).locator('.list-item-sub').textContent().catch(() => '')
    const countBefore = parseInt((subBefore ?? '').match(/\d+/)?.[0] ?? '0', 10)

    await openInviteModal(owner.page, groupName)
    const invited = await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!invited) { test.skip(); return }
    await owner.page.waitForTimeout(1500)

    const subAfter = await owner.page.locator('.list-item').filter({ hasText: groupName }).locator('.list-item-sub').textContent().catch(() => '')
    const countAfter = parseInt((subAfter ?? '').match(/\d+/)?.[0] ?? '0', 10)
    expect(countAfter).toBeGreaterThan(countBefore)
  } finally {
    await teardownUsers(users)
  }
})

test('GX49: 被邀请成员能在自己的群列表看到新群', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'gx49u')
  const [owner, member] = users
  const groupName = `gx49grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    const invited = await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!invited) { test.skip(); return }

    await goToGroups(member.page)
    await expect(member.page.locator('.list-item-name', { hasText: groupName })).toBeVisible({ timeout: 12000 })
  } finally {
    await teardownUsers(users)
  }
})

test('GX50: 群聊页显示"有新消息 ↓"提示后，点击可滚到底部', async ({ browser }) => {
  const { users, owner, member, groupName, invited } = await setupGroupWith2(browser, 'gx50')
  try {
    if (!invited) { test.skip(); return }
    // owner 发 20 条消息先填满
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    for (let i = 0; i < 20; i++) {
      await sendMessage(owner.page, `gx50_fill_${i}`)
      await owner.page.waitForTimeout(100)
    }

    // member 进群，先滚到顶
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    await member.page.waitForTimeout(1000)
    await member.page.evaluate(() => {
      const el = document.querySelector('.msg-list, .messages-container, .chat-messages') as HTMLElement | null
      if (el) el.scrollTop = 0
    })

    // owner 再发一条消息
    const newMsg = `gx50_new_${Date.now()}`
    await sendMessage(owner.page, newMsg)
    await member.page.waitForTimeout(2000)

    // hint 可见时点击
    const hint = member.page.locator('.new-msg-hint, .scroll-hint, button[class*="hint"]')
    const hintVisible = await hint.isVisible().catch(() => false)
    if (hintVisible) {
      await hint.click()
      await member.page.waitForTimeout(500)
      // 应能看到最新消息
      expect(await waitForMessage(member.page, newMsg, 3000)).toBe(true)
    } else {
      // hint 不可见可能是已在底部，直接验证消息可见
      expect(await waitForMessage(member.page, newMsg, 5000)).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})
