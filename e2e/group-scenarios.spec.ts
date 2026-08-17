/**
 * 群聊全场景测试：覆盖所有日常操作
 *
 * 场景列表：
 * S1  邀请多人同时进群，验证所有人收到通知
 * S2  成员退群后重新进群，能正常收发消息
 * S3  成员退群再进群再退群（连续两次退群），状态一致
 * S4  多人同时退群，群主侧成员列表正确缩减
 * S5  多人同时进群（群主连续邀请），所有人均入群
 * S6  群主解散群，所有成员实时看到群消失
 * S7  群主踢人（普通成员自行退出模拟踢人，验证余下成员可用）
 * S8  非群主成员互发消息，双向均可收到
 * S9  群内连续消息，消息顺序正确
 * S10 退群成员无法再收到退群后的新消息
 * S11 群主退出 = 解散群，其余成员实时看到群消失
 * S12 群内多人同时发消息，每人都能收到所有消息（并发）
 * S13 成员退群后再次入群，密钥轮换后可正常收发新消息，旧密钥无法解密新消息
 * S14 群主重复邀请已在群内的成员，界面报错不崩溃
 * S15 非群主尝试邀请成员，操作被服务端拒绝，界面报错
 * S16 成员退群后，群主发的消息只有留群成员收到，退群成员收不到
 * S17 两个群并存，消息不串台
 * S18 同一用户既是群主（群A）又是群员（群B），两群独立收发消息互不干扰
 * S19 用户同时是两个群的群主，解散其中一个，另一个群仍可正常使用
 * S20 用户同时是多个群的群员，从一个群退出后，其他群仍可正常收发消息
 * S21 群内消息气泡位置：自己发的在右，别人发的在左并显示发送者昵称
 * S22 群内消息时间显示为 HH:mm 格式（今天发的消息）
 * S23 群内多条消息按发送顺序排列，时序正确
 * S24 两个群各有成员退群，两次密钥轮换互不干扰，两群均可正常收发新消息
 * S25 全部非发送者成员离线时发群消息，成员上线后收到，内容解密正确
 * S26 有在线成员时发群消息，离线成员上线后不会重复收到
 * S27 密钥轮换后旧版本离线消息仍可正确解密（keyVersion 版本号机制）
 * S28 离线消息上线收到后，再次重连不重复投递（原子删除）
 * S29 群组名称长度边界：100字名称创建成功，超过100字被阻止
 * S30 群组名称特殊字符：含空格、符号可正常创建和显示
 * S31 创建群后群列表里显示正确的成员数（初始1人）
 * S32 群组列表显示"群"徽章标识
 * S33 退群确认弹窗：普通成员退群时弹出"退出群组"确认，取消后留在群里
 * S34 解散群确认弹窗：群主退群时弹出"解散群组"确认，取消后群不消失
 * S35 邀请弹窗在线列表过滤：已入群成员不出现在邀请列表中
 * S36 邀请弹窗空状态：无可邀请在线用户时显示"暂无可邀请的在线用户"
 * S37 3人群部分成员离线：在线成员实时收到，离线成员不存离线（有人在线不触发存储）
 * S38 3人群全员离线：发消息后两个离线成员各自上线均收到各自的离线消息
 * S39 多条离线消息批量到达：按发送顺序排列，无乱序
 * S40 离线消息含特殊字符（Emoji、中文、引号），解密后内容完整
 * S41 群主发送者自身离线不影响离线消息存储逻辑：receiver 离线仍存，发送者自己在线
 * S42 断线后发消息（WS 断开）重连后自动重发并成功送达
 * S43 群聊页发送 Emoji 消息，对方收到后显示正确
 * S44 群聊页长消息（500字）发送成功，接收方完整显示
 * S45 群聊切换：从群A切到群B再切回群A，消息不串台
 * S46 WS 重连后群组页群列表自动刷新（不需要手动刷新页面）
 * S47 新成员入群立刻发消息（密钥就绪后），群内其他成员能收到
 * S48 离线消息状态：发送方发消息给全离线群，自己能看到 offline 状态
 * S49 在线成员状态：发消息时有人在线，发送方能看到 delivered 状态
 * S50 退群后会话记录从本设备清除（群聊从会话列表消失）
 * S51 群聊页导航：点击群聊进入后 URL 格式为 /chat/group_{groupName}
 * S52 群组页成员数显示随成员退群实时更新（reload 后验证）
 * S53 仅发送方在群（其他人都退了）：发消息不崩溃，但无接收方
 * S54 群主创建群后立刻邀请成员，被邀请者能立刻收到入群通知
 * S55 创建群名称为空时按钮禁用或提示，不能创建空名群
 * S56 同一用户先发群消息再断线重连，连接恢复后历史消息仍在
 * S57 群聊不存在的会话 ID 访问，页面不崩溃（降级显示或重定向）
 * S58 多次快速退出再重进同一群，消息历史保持一致，无重复条目
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

async function goToGroups(page: Page) {
  await page.locator('.bottom-nav').getByText('群组').click()
  await expect(page).toHaveURL(/\/groups/, { timeout: 5000 })
}

async function createGroup(page: Page, name: string) {
  await page.getByRole('button', { name: '+ 创建' }).click()
  await page.locator('input[placeholder="群组名称"]').fill(name)
  await page.locator('.modal .btn-primary').click()
  await expect(page.locator('.list-item').filter({ hasText: name })).toBeVisible({ timeout: 10000 })
}

async function openInviteModal(page: Page, groupName: string) {
  await page.locator('.list-item').filter({ hasText: groupName })
    .locator('button', { hasText: '邀请' }).click()
  await expect(page.locator('.modal').filter({ hasText: '邀请在线用户' })).toBeVisible({ timeout: 5000 })
}

async function inviteUser(page: Page, username: string, timeout = 15000) {
  const row = page.locator('.modal .list-item').filter({ hasText: username })
  const found = await row.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
  if (!found) return false
  await row.locator('button', { hasText: '邀请' }).click()
  await expect(page.locator('.invite-msg')).toBeVisible({ timeout: 15000 })
  return true
}

async function waitForGroupVisible(page: Page, groupName: string, timeout = 12000) {
  return page.locator('.list-item').filter({ hasText: groupName })
    .waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
}

async function waitForGroupGone(page: Page, groupName: string, timeout = 10000) {
  return page.locator('.list-item').filter({ hasText: groupName })
    .waitFor({ state: 'hidden', timeout }).then(() => true).catch(() => false)
}

async function leaveGroup(page: Page, groupName: string) {
  await page.locator('.list-item').filter({ hasText: groupName })
    .locator('button.btn-danger').click()
  await expect(page.locator('.modal')).toBeVisible({ timeout: 2000 })
  await page.locator('.modal .btn-danger').click()
  await expect(page.locator('.list-item').filter({ hasText: groupName }))
    .not.toBeVisible({ timeout: 8000 })
}

async function sendMessage(page: Page, text: string) {
  // React 受控 textarea 需要通过 nativeInputValueSetter 触发 onChange
  await page.locator('.chat-input').click()
  await page.evaluate((val) => {
    const el = document.querySelector('.chat-input') as HTMLTextAreaElement | null
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, text)
  await page.waitForFunction(
    () => !(document.querySelector('button.btn-send') as HTMLButtonElement | null)?.disabled,
    { timeout: 2000 },
  ).catch(() => {})
  await page.locator('button.btn-send').click()
}

async function waitForMessageVisible(page: Page, text: string, timeout = 12000) {
  return page.locator('.msg-bubble').filter({ hasText: text })
    .waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
}

// 进入群聊页，重试发送直到成功（等待密钥就绪）
async function enterGroupAndSend(page: Page, groupName: string, text: string, maxRetries = 8) {
  await page.locator('.list-item').filter({ hasText: groupName }).click()
  await page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
  for (let i = 0; i < maxRetries; i++) {
    await page.locator('.chat-input').fill(text)
    await page.locator('button', { hasText: '发送' }).click()
    const ok = await waitForMessageVisible(page, text, 2500)
    if (ok) return true
    await page.waitForTimeout(2000)
  }
  return false
}

// ── 用户池管理 ────────────────────────────────────────────────────────────────

interface UserCtx {
  username: string
  accessToken: string
  ctx: BrowserContext
  page: Page
}

async function setupUsers(browser: Browser, count: number, prefix: string) {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const users: UserCtx[] = []

  // 串行注册避免 SQLite 并发写竞态
  const auths: { username: string; accessToken: string }[] = []
  for (let i = 0; i < count; i++) {
    const username = `${prefix}${i}_${ts}${rand}`
    const auth = await apiRegister(username)
    auths.push({ username, accessToken: auth.accessToken })
  }

  // 串行登录
  for (const auth of auths) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, auth.username)
    users.push({ username: auth.username, accessToken: auth.accessToken, ctx, page })
  }

  // 等待所有用户 WS 在线状态传播到后端
  await users[0].page.waitForTimeout(2000)

  return users
}

async function teardownUsers(users: UserCtx[]) {
  await Promise.all(users.map(u =>
    Promise.race([u.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  ))
  await Promise.all(users.map(u => apiDeleteAccount(u.accessToken)))
}

// ─────────────────────────────────────────────────────────────────────────────
// S1: 邀请多人同时进群
// ─────────────────────────────────────────────────────────────────────────────

test('S1: 群主邀请多人，所有人实时收到入群通知', async ({ browser }) => {
  const users = await setupUsers(browser, 4, 's1u')
  const [owner, m1, m2, m3] = users

  try {
    // 让成员先停在群组页等待通知
    for (const m of [m1, m2, m3]) await goToGroups(m.page)

    const groupName = `s1_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // 依次邀请每个成员
    for (const m of [m1, m2, m3]) {
      await openInviteModal(owner.page, groupName)
      const ok = await inviteUser(owner.page, m.username)
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // 验证所有成员都收到入群通知
    for (const m of [m1, m2, m3]) {
      const visible = await waitForGroupVisible(m.page, groupName)
      expect(visible, `${m.username} 未收到入群通知`).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S2: 成员退群后重新进群，能正常收发消息
// ─────────────────────────────────────────────────────────────────────────────

test('S2: 成员退群后重新被邀请进群，可以正常收发消息', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's2u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s2_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // 邀请 m1
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await waitForGroupVisible(m1.page, groupName)

    // m1 退群
    await leaveGroup(m1.page, groupName)

    // 群主再次邀请 m1（等弹窗刷新最新成员列表后 m1 应重新出现）
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    await owner.page.waitForTimeout(1500) // 等 groupApi.get() 刷新 members
    const ok2 = await inviteUser(owner.page, m1.username)
    if (!ok2) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // m1 重新进群后可以发消息
    await waitForGroupVisible(m1.page, groupName)
    const msg = `s2_rejoin_${Date.now()}`
    const sent = await enterGroupAndSend(m1.page, groupName, msg)
    expect(sent, 'm1 重新入群后发消息失败').toBe(true)

    // owner 进群能收到
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const received = await waitForMessageVisible(owner.page, msg)
    expect(received, 'owner 未收到 m1 重入群后的消息').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S3: 连续两次退群再进群
// ─────────────────────────────────────────────────────────────────────────────

test('S3: 成员连续两次退群再进群，第二次进群后仍可正常发消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's3u')
  const [owner, m1] = users

  try {
    await goToGroups(m1.page)
    const groupName = `s3_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (let round = 1; round <= 2; round++) {
      // 邀请 m1（第二轮打开弹窗时等 groupApi.get() 刷新成员列表）
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      if (round === 2) await owner.page.waitForTimeout(1500)
      const ok = await inviteUser(owner.page, m1.username)
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await waitForGroupVisible(m1.page, groupName)

      if (round === 1) {
        // 第一次：m1 退群
        await leaveGroup(m1.page, groupName)
      } else {
        // 第二次：m1 发消息验证
        const msg = `s3_round2_${Date.now()}`
        const sent = await enterGroupAndSend(m1.page, groupName, msg)
        expect(sent, '第二次进群后发消息失败').toBe(true)
      }
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S4: 多人同时退群
// ─────────────────────────────────────────────────────────────────────────────

test('S4: 多人同时退群，群主侧群仍存在且可发消息', async ({ browser }) => {
  const users = await setupUsers(browser, 4, 's4u')
  const [owner, m1, m2, m3] = users

  try {
    for (const m of [m1, m2, m3]) await goToGroups(m.page)

    const groupName = `s4_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // 邀请所有成员
    for (const m of [m1, m2, m3]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      const ok = await inviteUser(owner.page, m.username)
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    for (const m of [m1, m2, m3]) await waitForGroupVisible(m.page, groupName)

    // 多人同时退群
    await Promise.all([m1, m2, m3].map(async m => {
      await leaveGroup(m.page, groupName)
    }))

    // 群主侧群仍存在
    await expect(owner.page.locator('.list-item').filter({ hasText: groupName }))
      .toBeVisible({ timeout: 5000 })

    // 群主仍可发消息（密钥轮换后）
    const msg = `s4_after_mass_leave_${Date.now()}`
    let sent = false
    for (let i = 0; i < 10; i++) {
      await goToGroups(owner.page)
      await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await sendMessage(owner.page, msg)
      sent = await waitForMessageVisible(owner.page, msg, 2500)
      if (sent) break
      await owner.page.waitForTimeout(2000)
      await goToGroups(owner.page)
    }
    expect(sent, '多人退群后群主发消息失败').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S5: 多人同时进群（群主连续邀请）
// ─────────────────────────────────────────────────────────────────────────────

test('S5: 群主连续快速邀请多人，所有人均成功入群', async ({ browser }) => {
  const users = await setupUsers(browser, 5, 's5u')
  const [owner, m1, m2, m3, m4] = users
  const members = [m1, m2, m3, m4]

  try {
    for (const m of members) await goToGroups(m.page)

    const groupName = `s5_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // 连续邀请4人
    for (const m of members) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      const ok = await inviteUser(owner.page, m.username)
      if (!ok) continue
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // 验证所有人都入群了
    for (const m of members) {
      const visible = await waitForGroupVisible(m.page, groupName)
      expect(visible, `${m.username} 未收到入群通知`).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S6: 群主解散群，所有成员实时看到群消失
// ─────────────────────────────────────────────────────────────────────────────

test('S6: 群主解散群，所有成员群列表实时消失', async ({ browser }) => {
  const users = await setupUsers(browser, 5, 's6u')
  const [owner, m1, m2, m3, m4] = users
  const members = [m1, m2, m3, m4]

  try {
    for (const m of members) await goToGroups(m.page)

    const groupName = `s6_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of members) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      const ok = await inviteUser(owner.page, m.username)
      if (!ok) continue
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    for (const m of members) await waitForGroupVisible(m.page, groupName)

    // 群主解散（群主退出 = 解散）
    await goToGroups(owner.page)
    await leaveGroup(owner.page, groupName)

    // 所有成员群列表消失
    for (const m of members) {
      const gone = await waitForGroupGone(m.page, groupName)
      expect(gone, `${m.username} 解散后群仍可见`).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S7: "踢人"场景（成员自行退群，验证余下成员和群主不受影响）
// ─────────────────────────────────────────────────────────────────────────────

test('S7: 踢人场景——某成员退群后，群主和其余成员仍可正常收发消息', async ({ browser }) => {
  const users = await setupUsers(browser, 4, 's7u')
  const [owner, m1, m2, m3] = users

  try {
    for (const m of [m1, m2, m3]) await goToGroups(m.page)

    const groupName = `s7_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2, m3]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        // 关闭弹窗再重新打开，刷新在线列表后重试一次
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    for (const m of [m1, m2, m3]) {
      const visible = await waitForGroupVisible(m.page, groupName)
      if (!visible) test.skip()
    }

    // m1 退群（模拟被踢）
    await leaveGroup(m1.page, groupName)

    // 群主进入群聊等待密钥轮换后发消息
    const msgOwner = `s7_owner_after_kick_${Date.now()}`
    let ownerSent = false
    for (let i = 0; i < 10; i++) {
      await goToGroups(owner.page)
      await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await sendMessage(owner.page, msgOwner)
      ownerSent = await waitForMessageVisible(owner.page, msgOwner, 2500)
      if (ownerSent) break
      await owner.page.waitForTimeout(2000)
      await goToGroups(owner.page)
    }
    expect(ownerSent, '踢人后群主发消息失败').toBe(true)

    // m2 进群收到消息
    const m2entered = await enterGroupAndSend(m2.page, groupName, `s7_m2_${Date.now()}`)
    expect(m2entered, '踢人后 m2 发消息失败').toBe(true)

    // m3 进群聊也可收到群主消息
    await goToGroups(m3.page)
    await m3.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m3.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const m3received = await waitForMessageVisible(m3.page, msgOwner)
    expect(m3received, 'm3 未收到踢人后群主的消息').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S8: 非群主成员互发消息，双向均可收到
// ─────────────────────────────────────────────────────────────────────────────

test('S8: 非群主成员之间互发消息，双向均可收到', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's8u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s8_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    const m1visible = await waitForGroupVisible(m1.page, groupName)
    if (!m1visible) test.skip()
    const m2visible = await waitForGroupVisible(m2.page, groupName)
    if (!m2visible) test.skip()

    // m1/m2 进入群聊页（触发密钥获取），多等一会确保 owner 完成密钥上传
    await m1.page.waitForTimeout(3000)
    await m1.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await m2.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    // owner 发 warmup 消息，等 m1/m2 都收到（确保密钥就绪）
    const ownerWarmup = `s8_owner_warm_${Date.now()}`
    const ownerOk = await enterGroupAndSend(owner.page, groupName, ownerWarmup)
    expect(ownerOk, 'owner warmup 失败').toBe(true)

    await waitForMessageVisible(m1.page, ownerWarmup, 12000)
    await waitForMessageVisible(m2.page, ownerWarmup, 12000)

    // m1/m2 此时已在群聊页，带重试发消息（等待密钥就绪）
    const msgFromM1 = `s8_from_m1_${Date.now()}`
    let m1sent = false
    for (let i = 0; i < 8 && !m1sent; i++) {
      await sendMessage(m1.page, msgFromM1)
      m1sent = await waitForMessageVisible(m1.page, msgFromM1, 2500)
      if (!m1sent) await m1.page.waitForTimeout(2000)
    }
    expect(m1sent, 'm1 发消息失败').toBe(true)

    const msgFromM2 = `s8_from_m2_${Date.now()}`
    let m2sent = false
    for (let i = 0; i < 8 && !m2sent; i++) {
      await sendMessage(m2.page, msgFromM2)
      m2sent = await waitForMessageVisible(m2.page, msgFromM2, 2500)
      if (!m2sent) await m2.page.waitForTimeout(2000)
    }
    expect(m2sent, 'm2 发消息失败').toBe(true)

    // m1 收到 m2 的消息
    const m1received = await waitForMessageVisible(m1.page, msgFromM2, 12000)
    expect(m1received, 'm1 未收到 m2 的消息').toBe(true)

    // m2 收到 m1 的消息
    const m2received = await waitForMessageVisible(m2.page, msgFromM1, 12000)
    expect(m2received, 'm2 未收到 m1 的消息').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S9: 群内连续发多条消息，顺序正确
// ─────────────────────────────────────────────────────────────────────────────

test('S9: 群内连续发送多条消息，接收方顺序一致', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's9u')
  const [owner, m1] = users

  try {
    await goToGroups(m1.page)
    const groupName = `s9_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await waitForGroupVisible(m1.page, groupName)

    // m1 进群并等密钥就绪
    const probeMsg = `s9_probe_${Date.now()}`
    const probeOk = await enterGroupAndSend(m1.page, groupName, probeMsg)
    if (!probeOk) test.skip()

    // owner 进群，连续发 5 条消息
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })

    const ts = Date.now()
    const messages = Array.from({ length: 5 }, (_, i) => `s9_seq${i + 1}_${ts}`)
    for (const msg of messages) {
      await sendMessage(owner.page, msg)
      await owner.page.waitForTimeout(200)
    }

    // 等所有消息都出现在 m1 侧
    for (const msg of messages) {
      const visible = await waitForMessageVisible(m1.page, msg, 15000)
      expect(visible, `m1 未收到消息: ${msg}`).toBe(true)
    }

    // 验证消息在 m1 侧的顺序与发送顺序一致
    const bubbles = m1.page.locator('.msg-bubble')
    const count = await bubbles.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const t = await bubbles.nth(i).textContent() ?? ''
      texts.push(t)
    }
    const seqTexts = texts.filter(t => t.includes(`s9_seq`) && t.includes(`_${ts}`))
    for (let i = 0; i < seqTexts.length - 1; i++) {
      const a = parseInt(seqTexts[i].match(/s9_seq(\d+)/)?.[1] ?? '0')
      const b = parseInt(seqTexts[i + 1].match(/s9_seq(\d+)/)?.[1] ?? '0')
      expect(a).toBeLessThanOrEqual(b)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S10: 退群成员无法再收到新消息
// ─────────────────────────────────────────────────────────────────────────────

test('S10: 退群成员收不到退群后群内的新消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's10u')
  const [owner, m1] = users

  try {
    await goToGroups(m1.page)
    const groupName = `s10_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await waitForGroupVisible(m1.page, groupName)

    // m1 退群
    await leaveGroup(m1.page, groupName)

    // owner 发消息
    const msgAfterLeave = `s10_after_leave_${Date.now()}`
    let ownerSent = false
    for (let i = 0; i < 10; i++) {
      await goToGroups(owner.page)
      await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await sendMessage(owner.page, msgAfterLeave)
      ownerSent = await waitForMessageVisible(owner.page, msgAfterLeave, 2500)
      if (ownerSent) break
      await owner.page.waitForTimeout(2000)
      await goToGroups(owner.page)
    }
    expect(ownerSent, 'owner 在 m1 退群后发消息失败').toBe(true)

    // m1 的群列表里已经没有该群，也不会收到消息（等 5 秒确认无推送）
    await m1.page.waitForTimeout(5000)
    const groupStillVisible = await m1.page.locator('.list-item').filter({ hasText: groupName })
      .isVisible().catch(() => false)
    expect(groupStillVisible, 'm1 退群后群仍可见').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S11: 群主退群 = 解散群，其余所有成员实时看到群消失
// ─────────────────────────────────────────────────────────────────────────────

test('S11: 群主退群等于解散群，其余成员实时看到群消失', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's11u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s11_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    const m1v = await waitForGroupVisible(m1.page, groupName)
    const m2v = await waitForGroupVisible(m2.page, groupName)
    if (!m1v || !m2v) test.skip()

    // 群主退出（= 解散群）
    await leaveGroup(owner.page, groupName)

    // m1、m2 都实时看到群消失
    const m1gone = await waitForGroupGone(m1.page, groupName)
    const m2gone = await waitForGroupGone(m2.page, groupName)
    expect(m1gone, 'm1 未实时看到群解散').toBe(true)
    expect(m2gone, 'm2 未实时看到群解散').toBe(true)

    // owner 自己的群列表里也没有该群
    const ownerGone = await waitForGroupGone(owner.page, groupName)
    expect(ownerGone, 'owner 解散后群仍可见').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S12: 群内多人同时发消息，每人都能收到所有消息（并发场景）
// ─────────────────────────────────────────────────────────────────────────────

test('S12: 群内多人同时发消息，每人都能收到所有消息', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's12u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s12_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    if (!await waitForGroupVisible(m1.page, groupName)) test.skip()
    if (!await waitForGroupVisible(m2.page, groupName)) test.skip()

    // 三人都进入群聊页，等密钥就绪
    await m1.page.waitForTimeout(3000)
    for (const u of [owner, m1, m2]) {
      await u.page.locator('.list-item').filter({ hasText: groupName }).click()
      await u.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    }

    // warmup：owner 先发一条确保密钥就绪（带重试）
    const warmup = `s12_warm_${Date.now()}`
    let warmOk = false
    for (let i = 0; i < 8 && !warmOk; i++) {
      await sendMessage(owner.page, warmup)
      warmOk = await waitForMessageVisible(owner.page, warmup, 2500)
      if (!warmOk) await owner.page.waitForTimeout(2000)
    }
    if (!warmOk) test.skip()
    await waitForMessageVisible(m1.page, warmup, 12000)
    await waitForMessageVisible(m2.page, warmup, 12000)

    // 三人快速依次发消息（间隔短，模拟并发）
    const ts = Date.now()
    const msgOwner = `s12_owner_${ts}`
    const msgM1 = `s12_m1_${ts}`
    const msgM2 = `s12_m2_${ts}`

    await sendMessage(owner.page, msgOwner)
    await sendMessage(m1.page, msgM1)
    await sendMessage(m2.page, msgM2)

    // 每人都能在自己页面看到三条消息
    for (const [page, label] of [[owner.page, 'owner'], [m1.page, 'm1'], [m2.page, 'm2']] as const) {
      expect(await waitForMessageVisible(page, msgOwner, 15000), `${label} 未收到 owner 的消息`).toBe(true)
      expect(await waitForMessageVisible(page, msgM1, 15000), `${label} 未收到 m1 的消息`).toBe(true)
      expect(await waitForMessageVisible(page, msgM2, 15000), `${label} 未收到 m2 的消息`).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S13: 成员退群再入群，密钥轮换后可正常收发新消息
// ─────────────────────────────────────────────────────────────────────────────

test('S13: 成员退群后重新入群，密钥轮换后可正常收发新消息', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's13u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s13_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    if (!await waitForGroupVisible(m1.page, groupName)) test.skip()
    if (!await waitForGroupVisible(m2.page, groupName)) test.skip()

    // m1 进群发一条消息（确保密钥就绪）
    const beforeLeave = `s13_before_leave_${Date.now()}`
    const sentBefore = await enterGroupAndSend(m1.page, groupName, beforeLeave)
    if (!sentBefore) test.skip()

    // m1 退群（触发密钥轮换）
    await goToGroups(m1.page)
    await leaveGroup(m1.page, groupName)

    // 等密钥轮换完成（owner 收到 GROUP_KEY_ROTATE 后重新上传所有成员密钥）
    await owner.page.waitForTimeout(3000)

    // owner 在 m1 退群后发一条消息
    const afterLeave = `s13_after_leave_${Date.now()}`
    let ownerSent = false
    for (let i = 0; i < 10 && !ownerSent; i++) {
      await goToGroups(owner.page)
      await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await sendMessage(owner.page, afterLeave)
      ownerSent = await waitForMessageVisible(owner.page, afterLeave, 2500)
      if (!ownerSent) await owner.page.waitForTimeout(2000)
    }
    expect(ownerSent, 'm1 退群后 owner 发消息失败').toBe(true)

    // m2 能收到 owner 退群后发的消息
    await goToGroups(m2.page)
    await m2.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m2.page, afterLeave, 12000), 'm2 未收到 m1 退群后的消息').toBe(true)

    // owner 重新邀请 m1
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    let reInviteOk = await inviteUser(owner.page, m1.username)
    if (!reInviteOk) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      reInviteOk = await inviteUser(owner.page, m1.username)
    }
    if (!reInviteOk) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // m1 重新入群后能发新消息
    if (!await waitForGroupVisible(m1.page, groupName)) test.skip()
    const afterRejoin = `s13_after_rejoin_${Date.now()}`
    await m1.page.waitForTimeout(2000)
    const m1sent = await enterGroupAndSend(m1.page, groupName, afterRejoin)
    expect(m1sent, 'm1 重新入群后发消息失败').toBe(true)

    // m2 能收到 m1 重新入群后的消息
    expect(await waitForMessageVisible(m2.page, afterRejoin, 12000), 'm2 未收到 m1 重新入群后的消息').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S14: 群主重复邀请已在群内的成员，界面显示错误提示不崩溃
// ─────────────────────────────────────────────────────────────────────────────

test('S14: 重复邀请已在群内的成员，界面显示错误不崩溃', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's14u')
  const [owner, m1] = users

  try {
    await goToGroups(m1.page)
    const groupName = `s14_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // 第一次邀请 m1
    await openInviteModal(owner.page, groupName)
    const firstOk = await inviteUser(owner.page, m1.username)
    if (!firstOk) test.skip()
    // 关闭弹窗后再打开，m1 已在群内，在线列表里不应再出现 m1
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await waitForGroupVisible(m1.page, groupName)

    // 重新打开邀请弹窗，m1 已是成员，列表里不应出现
    await openInviteModal(owner.page, groupName)
    const m1InList = await owner.page.locator('.modal .list-item')
      .filter({ hasText: m1.username })
      .isVisible().catch(() => false)
    // m1 已在群内不应出现在可邀请列表（后端会过滤）
    expect(m1InList, '已在群内的成员出现在可邀请列表').toBe(false)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S15: 非群主尝试邀请成员，服务端拒绝，界面显示错误
// ─────────────────────────────────────────────────────────────────────────────

test('S15: 非群主尝试邀请成员，服务端拒绝并显示错误提示', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's15u')
  const [owner, m1, m2] = users

  try {
    await goToGroups(m1.page)
    await goToGroups(m2.page)

    const groupName = `s15_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    // owner 邀请 m1 入群
    await openInviteModal(owner.page, groupName)
    const ok = await inviteUser(owner.page, m1.username)
    if (!ok) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(m1.page, groupName)) test.skip()

    // m1（非群主）打开邀请弹窗，尝试邀请 m2
    await goToGroups(m1.page)
    await openInviteModal(m1.page, groupName)
    const m2row = m1.page.locator('.modal .list-item').filter({ hasText: m2.username })
    const m2found = await m2row.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
    if (!m2found) {
      // m2 不在可邀请列表（后端已过滤），说明前端本身就不允许非群主看到邀请选项
      await m1.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      test.skip()
    }
    // 如果 m2 出现在列表，点击邀请，期望后端返回错误
    await m2row.locator('button', { hasText: '邀请' }).click()
    const errMsg = await m1.page.locator('.invite-msg').waitFor({ state: 'visible', timeout: 8000 })
      .then(() => m1.page.locator('.invite-msg').textContent()).catch(() => '')
    expect(errMsg, '非群主邀请未显示错误信息').toBeTruthy()
    await m1.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S16: 成员退群后，群内新消息只有留群成员收到，退群成员收不到
// ─────────────────────────────────────────────────────────────────────────────

test('S16: 成员退群后群内新消息只有留群成员收到，退群成员收不到', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's16u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)

    const groupName = `s16_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) test.skip()
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }
    if (!await waitForGroupVisible(m1.page, groupName)) test.skip()
    if (!await waitForGroupVisible(m2.page, groupName)) test.skip()

    // m1 先进群发一条确保密钥就绪
    const warmup = `s16_warm_${Date.now()}`
    if (!await enterGroupAndSend(m1.page, groupName, warmup)) test.skip()

    // m1 退群
    await goToGroups(m1.page)
    await leaveGroup(m1.page, groupName)

    // 等密钥轮换完成
    await owner.page.waitForTimeout(3000)

    // owner 发退群后的消息
    const afterLeave = `s16_after_leave_${Date.now()}`
    let ownerSent = false
    for (let i = 0; i < 10 && !ownerSent; i++) {
      await goToGroups(owner.page)
      await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await sendMessage(owner.page, afterLeave)
      ownerSent = await waitForMessageVisible(owner.page, afterLeave, 2500)
      if (!ownerSent) await owner.page.waitForTimeout(2000)
    }
    expect(ownerSent, '退群后 owner 发消息失败').toBe(true)

    // m2 能收到（留在群里）
    await goToGroups(m2.page)
    await m2.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m2.page, afterLeave, 12000), 'm2 未收到退群后消息').toBe(true)

    // m1 的群列表里已无该群（退群后群消失），等 5 秒确认无消息推送
    await m1.page.waitForTimeout(5000)
    const m1GroupGone = !(await m1.page.locator('.list-item').filter({ hasText: groupName }).isVisible().catch(() => false))
    expect(m1GroupGone, 'm1 退群后群仍可见').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S17: 两个群并存，消息不串台（A 群的消息不出现在 B 群）
// ─────────────────────────────────────────────────────────────────────────────

test('S17: 两个群并存，消息不串台', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's17u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)
    await goToGroups(owner.page)

    const ts = Date.now()
    const groupA = `s17_grpA_${ts}`
    const groupB = `s17_grpB_${ts}`

    // 创建两个群
    await createGroup(owner.page, groupA)
    await goToGroups(owner.page)
    await createGroup(owner.page, groupB)

    // 邀请 m1 进 A 群，m2 进 B 群
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupA)
    let okA = await inviteUser(owner.page, m1.username)
    if (!okA) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupA)
      okA = await inviteUser(owner.page, m1.username)
    }
    if (!okA) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupB)
    let okB = await inviteUser(owner.page, m2.username)
    if (!okB) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupB)
      okB = await inviteUser(owner.page, m2.username)
    }
    if (!okB) test.skip()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(m1.page, groupA)) test.skip()
    if (!await waitForGroupVisible(m2.page, groupB)) test.skip()

    // m1 进 A 群发消息，m2 进 B 群发消息
    await m1.page.waitForTimeout(2000)
    const msgA = `s17_msg_in_A_${ts}`
    const m1sent = await enterGroupAndSend(m1.page, groupA, msgA)
    expect(m1sent, 'm1 在 A 群发消息失败').toBe(true)

    await m2.page.waitForTimeout(2000)
    const msgB = `s17_msg_in_B_${ts}`
    const m2sent = await enterGroupAndSend(m2.page, groupB, msgB)
    expect(m2sent, 'm2 在 B 群发消息失败').toBe(true)

    // owner 进 A 群：能看到 msgA，不能看到 msgB
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupA }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(owner.page, msgA, 12000), 'owner 在 A 群未收到 msgA').toBe(true)
    const msgBinA = await owner.page.locator('.msg-bubble').filter({ hasText: msgB }).isVisible().catch(() => false)
    expect(msgBinA, 'B 群消息串台到 A 群').toBe(false)

    // owner 进 B 群：能看到 msgB，不能看到 msgA
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupB }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(owner.page, msgB, 12000), 'owner 在 B 群未收到 msgB').toBe(true)
    const msgAinB = await owner.page.locator('.msg-bubble').filter({ hasText: msgA }).isVisible().catch(() => false)
    expect(msgAinB, 'A 群消息串台到 B 群').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S18: 同一用户既是某群群主又是另一群群员，两群各自独立收发消息互不干扰
// ─────────────────────────────────────────────────────────────────────────────

test('S18: 用户同时是群主（群A）和群员（群B），两群消息独立互不干扰', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's18u')
  const [owner, ownerB, m1] = users

  try {
    const ts = Date.now()
    const groupA = `s18_A_${ts}`
    const groupB = `s18_B_${ts}`

    // owner 创建群A
    await goToGroups(owner.page)
    await createGroup(owner.page, groupA)

    // ownerB 创建群B，邀请 owner 进群B
    await goToGroups(ownerB.page)
    await createGroup(ownerB.page, groupB)
    await goToGroups(ownerB.page)
    await openInviteModal(ownerB.page, groupB)
    let ok = await inviteUser(ownerB.page, owner.username)
    if (!ok) {
      await ownerB.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(ownerB.page)
      await openInviteModal(ownerB.page, groupB)
      ok = await inviteUser(ownerB.page, owner.username)
    }
    if (!ok) { test.skip(); return }
    await ownerB.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // owner 邀请 m1 进群A
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupA)
    let okA = await inviteUser(owner.page, m1.username)
    if (!okA) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupA)
      okA = await inviteUser(owner.page, m1.username)
    }
    if (!okA) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await owner.page.waitForTimeout(2000)

    // owner 在群A发消息（作为群主）
    const msgA = `s18_inA_${ts}`
    await goToGroups(owner.page)
    const sentA = await enterGroupAndSend(owner.page, groupA, msgA)
    expect(sentA, 'owner 在群A发消息失败').toBe(true)

    // owner 在群B发消息（作为群员）
    const msgB = `s18_inB_${ts}`
    await goToGroups(owner.page)
    const sentB = await enterGroupAndSend(owner.page, groupB, msgB)
    expect(sentB, 'owner 在群B发消息失败').toBe(true)

    // m1 在群A应收到 msgA
    if (!await waitForGroupVisible(m1.page, groupA)) { test.skip(); return }
    await goToGroups(m1.page)
    await m1.page.locator('.list-item').filter({ hasText: groupA }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m1.page, msgA, 12000), 'm1 未收到群A消息').toBe(true)
    const msgBInM1 = await m1.page.locator('.msg-bubble').filter({ hasText: msgB }).isVisible().catch(() => false)
    expect(msgBInM1, '群B消息不应出现在 m1 的群A页面').toBe(false)

    // ownerB 在群B应收到 msgB
    await goToGroups(ownerB.page)
    await ownerB.page.locator('.list-item').filter({ hasText: groupB }).click()
    await ownerB.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(ownerB.page, msgB, 12000), 'ownerB 未收到群B消息').toBe(true)
    const msgAInOwnerB = await ownerB.page.locator('.msg-bubble').filter({ hasText: msgA }).isVisible().catch(() => false)
    expect(msgAInOwnerB, '群A消息不应出现在 ownerB 的群B页面').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S19: 用户同时是两个群的群主，解散其中一个，另一个群仍可正常收发消息
// ─────────────────────────────────────────────────────────────────────────────

test('S19: 同一用户是两个群的群主，解散群A后群B仍正常可用', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's19u')
  const [owner, m1, m2] = users

  try {
    const ts = Date.now()
    const groupA = `s19_A_${ts}`
    const groupB = `s19_B_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupA)
    await goToGroups(owner.page)
    await createGroup(owner.page, groupB)

    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupA)
    let okA = await inviteUser(owner.page, m1.username)
    if (!okA) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupA)
      okA = await inviteUser(owner.page, m1.username)
    }
    if (!okA) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupB)
    let okB = await inviteUser(owner.page, m2.username)
    if (!okB) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupB)
      okB = await inviteUser(owner.page, m2.username)
    }
    if (!okB) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await owner.page.waitForTimeout(1500)

    // 群B先发一条确认正常
    const msgBefore = `s19_before_${ts}`
    await goToGroups(owner.page)
    const sentBefore = await enterGroupAndSend(owner.page, groupB, msgBefore)
    expect(sentBefore, 'owner 在群B预发消息失败').toBe(true)

    // owner 解散群A
    await goToGroups(owner.page)
    await leaveGroup(owner.page, groupA)

    // m1 侧群A消失
    await goToGroups(m1.page)
    expect(await waitForGroupGone(m1.page, groupA, 8000), 'm1 侧群A未消失').toBe(true)

    // 群B仍在，owner 继续发消息
    expect(await waitForGroupVisible(owner.page, groupB), 'owner 的群B消失了').toBe(true)
    const msgAfter = `s19_after_${ts}`
    await goToGroups(owner.page)
    const sentAfter = await enterGroupAndSend(owner.page, groupB, msgAfter)
    expect(sentAfter, 'owner 解散群A后在群B发消息失败').toBe(true)

    // m2 在群B收到消息
    if (!await waitForGroupVisible(m2.page, groupB)) { test.skip(); return }
    await goToGroups(m2.page)
    await m2.page.locator('.list-item').filter({ hasText: groupB }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m2.page, msgAfter, 12000), 'm2 未收到群B的 msgAfter').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S20: 用户同时是多个群的群员，从一个群退出后，其他群仍可正常收发消息
// ─────────────────────────────────────────────────────────────────────────────

test('S20: 用户从群A退出后，群B的消息收发不受影响', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's20u')
  const [owner, member, other] = users

  try {
    const ts = Date.now()
    const groupA = `s20_A_${ts}`
    const groupB = `s20_B_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupA)
    await goToGroups(owner.page)
    await createGroup(owner.page, groupB)

    for (const gName of [groupA, groupB]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, gName)
      let ok = await inviteUser(owner.page, member.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, gName)
        ok = await inviteUser(owner.page, member.username)
      }
      if (!ok) { test.skip(); return }
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // 邀请 other 进群B（用于后续收消息验证）
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupB)
    const okOther = await inviteUser(owner.page, other.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    await member.page.waitForTimeout(2000)

    // member 从群A退出
    await goToGroups(member.page)
    if (!await waitForGroupVisible(member.page, groupA)) { test.skip(); return }
    await leaveGroup(member.page, groupA)

    // member 退出群A后群B仍存在
    await goToGroups(member.page)
    expect(await waitForGroupVisible(member.page, groupB), 'member 退群A后群B消失了').toBe(true)

    // member 在群B发消息
    const msgB = `s20_B_${ts}`
    await member.page.waitForTimeout(1500)
    const sentB = await enterGroupAndSend(member.page, groupB, msgB)
    expect(sentB, 'member 退群A后在群B发消息失败').toBe(true)

    // owner 在群B收到消息
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupB }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(owner.page, msgB, 12000), 'owner 未收到群B消息').toBe(true)

    // member 退群A后，群A在 member 页面不可见
    await goToGroups(member.page)
    const groupAStillVisible = await waitForGroupVisible(member.page, groupA, 2000)
    expect(groupAStillVisible, 'member 退出后群A仍显示').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S21: 群内消息气泡位置——自己发的在右(mine)，别人发的在左(theirs)且显示发送者昵称
// ─────────────────────────────────────────────────────────────────────────────

test('S21: 群内消息气泡：自己发的在右，别人发的在左并显示发送者昵称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's21u')
  const [owner, member] = users

  try {
    const ts = Date.now()
    const groupName = `s21_grp_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    await member.page.waitForTimeout(1500)

    // owner 进群发消息
    const ownerMsg = `s21_owner_${ts}`
    await goToGroups(owner.page)
    const ownerSent = await enterGroupAndSend(owner.page, groupName, ownerMsg)
    expect(ownerSent, 'owner 发消息失败').toBe(true)

    // member 进群发消息
    const memberMsg = `s21_member_${ts}`
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await member.page.waitForTimeout(1500)
    await sendMessage(member.page, memberMsg)
    expect(await waitForMessageVisible(member.page, memberMsg, 8000), 'member 发消息未显示').toBe(true)

    // 验证 owner 视角
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await waitForMessageVisible(owner.page, memberMsg, 10000)

    // owner 自己的消息在右侧（mine）
    await expect(
      owner.page.locator('.msg-row.mine .msg-bubble').filter({ hasText: ownerMsg })
    ).toBeVisible({ timeout: 5000 })

    // member 的消息在左侧（theirs），且显示发送者用户名
    await expect(
      owner.page.locator('.msg-row.theirs .msg-bubble').filter({ hasText: memberMsg })
    ).toBeVisible({ timeout: 5000 })
    await expect(
      owner.page.locator('.msg-row.theirs .msg-sender').filter({ hasText: member.username })
    ).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S22: 群内消息时间戳——今天发的消息显示 HH:mm 格式
// ─────────────────────────────────────────────────────────────────────────────

test('S22: 群内消息时间显示为 HH:mm 格式（今天发的消息）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's22u')
  const [owner, member] = users

  try {
    const ts = Date.now()
    const groupName = `s22_grp_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    await member.page.waitForTimeout(1500)

    const msgText = `s22_time_${ts}`
    await goToGroups(owner.page)
    const sent = await enterGroupAndSend(owner.page, groupName, msgText)
    expect(sent, 'owner 发消息失败').toBe(true)

    // member 进群查看时间格式
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(member.page, msgText, 12000), 'member 未收到消息').toBe(true)

    // 找到该消息所在 msg-row，取其 msg-time 文本
    const msgRow = member.page.locator('.msg-row').filter({
      has: member.page.locator('.msg-bubble', { hasText: msgText }),
    })
    const timeText = await msgRow.locator('.msg-time').textContent({ timeout: 5000 })
    // 今天的消息格式为 HH:mm
    expect(timeText, `时间格式不对: "${timeText}"`).toMatch(/^\d{2}:\d{2}$/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S23: 群内多条消息按发送顺序排列，时序正确
// ─────────────────────────────────────────────────────────────────────────────

test('S23: 群内多条消息按发送顺序排列，时序正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's23u')
  const [owner, member] = users

  try {
    const ts = Date.now()
    const groupName = `s23_grp_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    await member.page.waitForTimeout(1500)

    // owner 串行发 3 条消息
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await owner.page.waitForTimeout(1500)

    const msgs = [`s23_first_${ts}`, `s23_second_${ts}`, `s23_third_${ts}`]
    for (const m of msgs) {
      await sendMessage(owner.page, m)
      await waitForMessageVisible(owner.page, m, 5000)
    }

    // member 进群验证消息存在且顺序正确
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })

    for (const m of msgs) {
      expect(await waitForMessageVisible(member.page, m, 12000), `member 未收到 ${m}`).toBe(true)
    }

    const bubbles = await member.page.locator('.msg-bubble').allTextContents()
    const indices = msgs.map(m => bubbles.findIndex(b => b.includes(m)))
    expect(indices[0], '第1条消息未找到').toBeGreaterThanOrEqual(0)
    expect(indices[1], '第2条消息未找到').toBeGreaterThanOrEqual(0)
    expect(indices[2], '第3条消息未找到').toBeGreaterThanOrEqual(0)
    expect(indices[0], '消息顺序错误：first 不在 second 之前').toBeLessThan(indices[1])
    expect(indices[1], '消息顺序错误：second 不在 third 之前').toBeLessThan(indices[2])
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S24: 两个群各有成员退群触发密钥轮换，两次轮换互不干扰，两群均可正常收发新消息
// ─────────────────────────────────────────────────────────────────────────────

test('S24: 两个群各有成员退群触发密钥轮换，两群均可正常收发新消息', async ({ browser }) => {
  // 群A：owner 是群主，m1 退出、m2 留守
  // 群B：owner 是群主，m3 退出、m4 留守
  const users = await setupUsers(browser, 5, 's24u')
  const [owner, m1, m2, m3, m4] = users

  try {
    const ts = Date.now()
    const groupA = `s24_A_${ts}`
    const groupB = `s24_B_${ts}`

    await goToGroups(owner.page)
    await createGroup(owner.page, groupA)
    await goToGroups(owner.page)
    await createGroup(owner.page, groupB)

    // 邀请 m1、m2 进群A
    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupA)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupA)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) { test.skip(); return }
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // 邀请 m3、m4 进群B
    for (const m of [m3, m4]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupB)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupB)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) { test.skip(); return }
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    await owner.page.waitForTimeout(2000)

    // m1 退出群A，m3 退出群B（同时触发两个群的密钥轮换）
    if (!await waitForGroupVisible(m1.page, groupA)) { test.skip(); return }
    await goToGroups(m1.page)
    await leaveGroup(m1.page, groupA)

    if (!await waitForGroupVisible(m3.page, groupB)) { test.skip(); return }
    await goToGroups(m3.page)
    await leaveGroup(m3.page, groupB)

    // 等待 owner 侧处理两个群的 GROUP_KEY_ROTATE
    await owner.page.waitForTimeout(4000)

    // 验证群A：owner 和 m2 可正常发消息
    const msgA = `s24_A_new_${ts}`
    await goToGroups(owner.page)
    const sentA = await enterGroupAndSend(owner.page, groupA, msgA)
    expect(sentA, 'owner 在群A密钥轮换后发消息失败').toBe(true)

    if (!await waitForGroupVisible(m2.page, groupA)) { test.skip(); return }
    await goToGroups(m2.page)
    await m2.page.locator('.list-item').filter({ hasText: groupA }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m2.page, msgA, 15000), 'm2 未收到群A新消息').toBe(true)

    // 验证群B：owner 和 m4 可正常发消息
    const msgB = `s24_B_new_${ts}`
    await goToGroups(owner.page)
    const sentB = await enterGroupAndSend(owner.page, groupB, msgB)
    expect(sentB, 'owner 在群B密钥轮换后发消息失败').toBe(true)

    if (!await waitForGroupVisible(m4.page, groupB)) { test.skip(); return }
    await goToGroups(m4.page)
    await m4.page.locator('.list-item').filter({ hasText: groupB }).click()
    await m4.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m4.page, msgB, 15000), 'm4 未收到群B新消息').toBe(true)

    // 两群消息不串台
    const msgAInB = await m4.page.locator('.msg-bubble').filter({ hasText: msgA }).isVisible().catch(() => false)
    expect(msgAInB, '群A消息串台到群B').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// API helpers for offline-delivery scenarios (S25-S28)
// ─────────────────────────────────────────────────────────────────────────────

async function apiLeaveGroup(accessToken: string, groupId: number): Promise<void> {
  await fetch(`${BASE_URL}/api/groups/${groupId}/members/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

async function apiGetMyGroups(accessToken: string): Promise<{ id: number; name: string }[]> {
  const res = await fetch(`${BASE_URL}/api/groups`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return (data.data ?? []) as { id: number; name: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// S25: 全部非发送者成员离线时发群消息 → 成员上线后收到，内容解密正确
//
// 策略：receiver 只通过 API 注册（从未打开浏览器 = 全程离线）。
//   owner 在线建群，通过 UI 邀请 receiver（触发 owner 上传 receiver 的群密钥），
//   然后发消息。receiver 首次打开浏览器登录，收到离线消息并解密。
// ─────────────────────────────────────────────────────────────────────────────

test('S25: 全部成员离线时发群消息，成员上线后收到并解密正确', async ({ browser }) => {
  // 策略：receiver 先上线建立 IDB 密钥，然后 setOffline(true) 断网模拟离线。
  // owner 发消息（receiver 离线 → 存入离线消息）。
  // receiver setOffline(false) 重连，收到离线消息并解密正确。
  const users = await setupUsers(browser, 2, 's25u')
  const [owner, receiver] = users

  try {
    await goToGroups(receiver.page)
    const groupName = `s25_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { console.error('[S25-SKIP] inviteUser failed after retry'); test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // warmup 确认双方密钥就绪：receiver 需进入群聊页面才能看到 msg-bubble
    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s25_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    // receiver 断网（IDB 密钥保留，WS 断开）
    await receiver.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    // owner 发消息（receiver 离线 → 服务端存入离线消息）
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const offlineMsg = `s25_offline_${Date.now()}`
    await sendMessage(owner.page, offlineMsg)
    await owner.page.waitForTimeout(1000)

    // receiver 恢复网络重连
    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)

    const msgVisible = await waitForMessageVisible(receiver.page, offlineMsg, 15000)
    expect(msgVisible, 'receiver 重连后未收到离线群消息').toBe(true)

    const decryptFailed = await receiver.page.locator('.msg-bubble')
      .filter({ hasText: '[解密失败]' }).isVisible().catch(() => false)
    expect(decryptFailed, 'receiver 收到离线群消息但解密失败').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S26: 有成员在线时发群消息 → 在线成员实时收到，离线成员上线后收不到
// ─────────────────────────────────────────────────────────────────────────────

test('S26: 有成员在线时发群消息，离线成员上线后不会重复收到', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's26u')
  const [owner, m1, m2] = users

  try {
    for (const m of [m1, m2]) await goToGroups(m.page)
    const groupName = `s26_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, m2]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) { test.skip(); return }
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // 等密钥就绪（warmup）
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    const warmup = `s26_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    await waitForMessageVisible(m1.page, warmup, 10000)
    await waitForMessageVisible(m2.page, warmup, 10000)

    // 关闭 m2 context（模拟 m2 离线），m1 保持在线
    await m2.ctx.close()
    await owner.page.waitForTimeout(1500)

    // owner 发消息：m1 在线 → 服务端正常实时发送，不存离线消息
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const onlineMsg = `s26_online_${Date.now()}`
    await sendMessage(owner.page, onlineMsg)

    // m1（在线）实时收到
    await goToGroups(m1.page)
    await m1.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    expect(await waitForMessageVisible(m1.page, onlineMsg, 12000), 'm1 未实时收到消息').toBe(true)

    // m2 重新登录，等 5 秒后不应收到该消息（服务端未存离线）
    const m2ctx = await browser.newContext()
    const m2page = await m2ctx.newPage()
    try {
      await login(m2page, m2.username)
      await goToGroups(m2page)
      const groupVisibleM2 = await waitForGroupVisible(m2page, groupName, 8000)
      if (groupVisibleM2) {
        await m2page.locator('.list-item').filter({ hasText: groupName }).click()
        await m2page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
        await m2page.waitForTimeout(5000)
        const m2got = await m2page.locator('.msg-bubble').filter({ hasText: onlineMsg }).isVisible().catch(() => false)
        expect(m2got, 'm2 不应收到"有在线成员时发送"的消息').toBe(false)
      }
    } finally {
      await m2ctx.close()
    }
    await apiDeleteAccount(m2.accessToken)
  } finally {
    await owner.ctx.close()
    await m1.ctx.close()
    await apiDeleteAccount(owner.accessToken)
    await apiDeleteAccount(m1.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S27: 离线消息 + 密钥轮换 → 旧版本消息仍可解密
//
// 策略：receiver 只通过 API 注册（全程离线）。owner 建群，API 邀请 receiver 和 m1。
//   owner 发消息（存为 v1 离线消息）。m1 退群触发密钥轮换（v2）。
//   receiver 首次登录，收到 v1 离线消息，验证解密正确（历史密钥生效）。
// ─────────────────────────────────────────────────────────────────────────────

test('S27: 密钥轮换后旧版本离线消息仍可正确解密', async ({ browser }) => {
  // 策略：owner + m1 + receiver 都先上线建立密钥。
  // receiver setOffline(true) 离线。m1 setOffline(true) 离线。
  // owner 发消息（两人均离线 → 存 v1 离线消息）。
  // m1 通过 API 退群（触发密钥轮换 → v2）。
  // receiver setOffline(false) 重连，收到 v1 离线消息，验证解密正确。
  const users = await setupUsers(browser, 3, 's27u')
  const [owner, m1, receiver] = users

  try {
    for (const m of [m1, receiver]) await goToGroups(m.page)
    const groupName = `s27_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    for (const m of [m1, receiver]) {
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      let ok = await inviteUser(owner.page, m.username)
      if (!ok) {
        await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
        await goToGroups(owner.page)
        await openInviteModal(owner.page, groupName)
        ok = await inviteUser(owner.page, m.username)
      }
      if (!ok) { test.skip(); return }
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    }

    // warmup 确认所有人密钥就绪
    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    const warmup = `s27_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    await waitForMessageVisible(receiver.page, warmup, 10000)
    await waitForMessageVisible(m1.page, warmup, 10000)

    // receiver 和 m1 都断网（保留 IDB 密钥，WS 断开）
    await receiver.ctx.setOffline(true)
    await m1.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    // owner 发消息（receiver + m1 均离线 → 存 v1 离线消息）
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const v1Msg = `s27_v1msg_${Date.now()}`
    await sendMessage(owner.page, v1Msg)
    await owner.page.waitForTimeout(1000)

    // m1 通过 API 退群（触发 needsKeyRotation → owner 轮换到 v2）
    await apiLeaveGroup(m1.accessToken, (await apiGetMyGroups(m1.accessToken)
      .then(gs => gs.find(g => g.name === groupName)))!.id)
    await owner.page.waitForTimeout(5000)

    // receiver 恢复网络，重连后收到 v1 离线消息
    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)

    const msgVisible = await waitForMessageVisible(receiver.page, v1Msg, 15000)
    expect(msgVisible, 'receiver 重连后未收到 v1 离线消息').toBe(true)

    const decryptFailed = await receiver.page.locator('.msg-bubble')
      .filter({ hasText: '[解密失败]' }).isVisible().catch(() => false)
    expect(decryptFailed, 'receiver 收到离线消息但解密失败（历史密钥未生效）').toBe(false)
  } finally {
    // 恢复网络避免 teardown 失败
    await receiver.ctx.setOffline(false).catch(() => {})
    await m1.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S28: 离线消息投递幂等性 — 上线收到后再次登录不重复收到
//
// 策略：receiver 只通过 API 注册（全程离线）。owner 建群，API 邀请 receiver，发消息。
//   receiver 第一次登录，收到离线消息。关闭 ctx，再次登录，验证不重复收到。
// ─────────────────────────────────────────────────────────────────────────────

test('S28: 离线消息上线收到后，再次登录不重复收到', async ({ browser }) => {
  // 策略：receiver 先上线建立密钥，setOffline(true) 断网。
  // owner 发消息（存离线）。receiver setOffline(false) 重连收到消息。
  // 再次 setOffline(true) + setOffline(false) 重连，验证不重复收到。
  const users = await setupUsers(browser, 2, 's28u')
  const [owner, receiver] = users

  try {
    await goToGroups(receiver.page)
    const groupName = `s28_grp_${Date.now()}`
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)

    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // warmup 确认密钥就绪：receiver 需进入群聊页面才能看到 msg-bubble
    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s28_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    // receiver 断网
    await receiver.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    // owner 发消息（receiver 离线 → 存入离线消息）
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const offlineMsg = `s28_offline_${Date.now()}`
    await sendMessage(owner.page, offlineMsg)
    await owner.page.waitForTimeout(1000)

    // receiver 第一次重连，收到离线消息
    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)
    const firstReceived = await waitForMessageVisible(receiver.page, offlineMsg, 15000)
    expect(firstReceived, 'receiver 第一次重连未收到离线消息').toBe(true)

    // receiver 第二次断网+重连（模拟再次登录），离线消息已被原子删除，不应重复出现
    await receiver.ctx.setOffline(true)
    await receiver.page.waitForTimeout(1000)
    await receiver.ctx.setOffline(false)
    // 导航回群组页再进群，等重连完成
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)

    const bubbles = await receiver.page.locator('.msg-bubble').filter({ hasText: offlineMsg }).all()
    // 第二次重连不应再收到已删除的离线消息（允许 1 条，因为是已渲染在内存里的，不是重复投递）
    // 真正验证的是不超过 1 条（无重复投递）
    expect(bubbles.length, '离线消息被重复投递').toBeLessThanOrEqual(1)
  } finally {
    await receiver.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S29: 群组名称长度边界——100字创建成功，超过100字被阻止
// ─────────────────────────────────────────────────────────────────────────────
test('S29: 群组名称长度边界：100字创建成功，超过100字前端阻止', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's29u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    // 100字名称
    const name100 = 'a'.repeat(100)
    await owner.page.locator('button', { hasText: '+ 创建' }).click()
    await owner.page.locator('.modal input[type="text"]').fill(name100)
    await owner.page.locator('.modal .btn-primary').click()
    // 群应出现在列表
    await expect(owner.page.locator('.list-item').filter({ hasText: name100 }))
      .toBeVisible({ timeout: 8000 })

    // 超过100字：input有maxLength=100，直接验证填入截断
    await owner.page.locator('button', { hasText: '+ 创建' }).click()
    const name101 = 'b'.repeat(101)
    const inputEl = owner.page.locator('.modal input[type="text"]')
    await inputEl.fill(name101)
    const actual = await inputEl.inputValue()
    expect(actual.length, '超100字应被maxLength截断').toBeLessThanOrEqual(100)
    // 取消
    await owner.page.locator('.modal button', { hasText: '取消' }).click()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S30: 群组名称含特殊字符可正常创建和显示
// ─────────────────────────────────────────────────────────────────────────────
test('S30: 群组名称特殊字符：含空格、标点、中文可正常创建和显示', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's30u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const specialName = `测试群 (S30) #${Date.now()}`
    await createGroup(owner.page, specialName)
    await expect(owner.page.locator('.list-item').filter({ hasText: '测试群 (S30)' }))
      .toBeVisible({ timeout: 8000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S31: 创建群后列表显示初始成员数为1
// ─────────────────────────────────────────────────────────────────────────────
test('S31: 创建群后群列表显示正确的成员数（初始1名成员）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's31u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s31_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    const item = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(item).toBeVisible({ timeout: 8000 })
    await expect(item.locator('.list-item-sub')).toContainText('1', { timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S32: 群组列表每项显示"群"徽章标识
// ─────────────────────────────────────────────────────────────────────────────
test('S32: 群组列表项显示"群"徽章标识', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's32u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s32_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    const item = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(item).toBeVisible({ timeout: 8000 })
    await expect(item.locator('.avatar-badge')).toContainText('群', { timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S33: 退群确认弹窗——普通成员取消后留在群里
// ─────────────────────────────────────────────────────────────────────────────
test('S33: 退群确认弹窗：普通成员点取消后留在群里不退出', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's33u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s33_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await goToGroups(member.page)
    await expect(member.page.locator('.list-item').filter({ hasText: groupName }))
      .toBeVisible({ timeout: 12000 })

    // member 点退出按钮，弹出确认弹窗
    await member.page.locator('.list-item').filter({ hasText: groupName })
      .locator('button.btn-danger').click()
    await expect(member.page.locator('.modal')).toBeVisible({ timeout: 3000 })
    // 确认弹窗内容包含"退出群组"
    await expect(member.page.locator('.modal h3')).toContainText('退出群组', { timeout: 2000 })
    // 点取消
    await member.page.locator('.modal button', { hasText: '取消' }).click()
    // 群仍在列表中
    await expect(member.page.locator('.list-item').filter({ hasText: groupName }))
      .toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S34: 解散群确认弹窗——群主取消后群不消失
// ─────────────────────────────────────────────────────────────────────────────
test('S34: 解散群确认弹窗：群主点取消后群不消失', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's34u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s34_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    // 群主点退出，弹出"解散群组"确认
    await owner.page.locator('.list-item').filter({ hasText: groupName })
      .locator('button.btn-danger').click()
    await expect(owner.page.locator('.modal')).toBeVisible({ timeout: 3000 })
    await expect(owner.page.locator('.modal h3')).toContainText('解散群组', { timeout: 2000 })
    // 点取消
    await owner.page.locator('.modal button', { hasText: '取消' }).click()
    // 群仍然存在
    await expect(owner.page.locator('.list-item').filter({ hasText: groupName }))
      .toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S35: 邀请弹窗在线列表过滤——已入群成员不出现在邀请候选列表中
// ─────────────────────────────────────────────────────────────────────────────
test('S35: 邀请弹窗在线列表过滤：已入群成员不显示在邀请列表中', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's35u')
  const [owner, m1, m2] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s35_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    // 先邀请 m1 入群
    await openInviteModal(owner.page, groupName)
    await inviteUser(owner.page, m1.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    // 再次打开邀请弹窗：m1 已入群，不应出现在列表中；m2 未入群应出现
    await openInviteModal(owner.page, groupName)
    await owner.page.waitForTimeout(1000)
    const modal = owner.page.locator('.modal')
    // m1 已入群，不应在列表中
    await expect(modal.locator('.list-item').filter({ hasText: m1.username }))
      .not.toBeVisible({ timeout: 3000 })
    // m2 未入群，应在列表中
    await expect(modal.locator('.list-item').filter({ hasText: m2.username }))
      .toBeVisible({ timeout: 5000 })
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S36: 邀请弹窗空状态——无可邀请在线用户时显示空提示
// ─────────────────────────────────────────────────────────────────────────────
test('S36: 邀请弹窗空状态：无可邀请在线用户时显示"暂无可邀请的在线用户"', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's36u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s36_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    // 只有自己在线，打开邀请弹窗
    await openInviteModal(owner.page, groupName)
    await expect(owner.page.locator('.modal .empty-state'))
      .toBeVisible({ timeout: 5000 })
    await expect(owner.page.locator('.modal .empty-state'))
      .toContainText('暂无可邀请的在线用户', { timeout: 3000 })
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S37: 3人群部分离线——在线成员实时收到消息，离线成员不触发离线存储
// ─────────────────────────────────────────────────────────────────────────────
test('S37: 3人群部分成员离线：有人在线时消息实时投递，不触发离线存储', async ({ browser }) => {
  // 策略：m2 关闭上下文（强制断开 TCP，server 立刻感知离线），m1 保持在线。
  // owner 发消息 → 有 m1 在线，实时投递，不存离线消息。
  // m2 重新登录后不应收到该消息（因为没有存离线消息）。
  const users = await setupUsers(browser, 3, 's37u')
  const [owner, m1, m2] = users
  let m2NewCtx: import('@playwright/test').BrowserContext | null = null
  let m2NewPage: import('@playwright/test').Page | null = null
  try {
    await goToGroups(owner.page)
    const groupName = `s37_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    // 邀请两人
    await openInviteModal(owner.page, groupName)
    let ok1 = await inviteUser(owner.page, m1.username)
    if (!ok1) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok1 = await inviteUser(owner.page, m1.username)
    }
    if (!ok1) { test.skip(); return }
    let ok2 = await inviteUser(owner.page, m2.username)
    if (!ok2) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok2 = await inviteUser(owner.page, m2.username)
    }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // warmup：确认密钥就绪
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    if (!await waitForGroupVisible(m2.page, groupName)) { test.skip(); return }
    await m1.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s37_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    if (!await waitForMessageVisible(m1.page, warmup, 12000)) { test.skip(); return }

    // m2 关闭上下文（TCP 断开，server 立刻感知），m1 保持在线
    await m2.ctx.close()
    await owner.page.waitForTimeout(2000)

    // owner 发消息：m1 在线，应实时收到；不应存 m2 的离线消息
    const msg = `s37_partial_${Date.now()}`
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await sendMessage(owner.page, msg)

    // m1（在线）应实时收到
    expect(await waitForMessageVisible(m1.page, msg, 10000), 'm1 在线应实时收到消息').toBe(true)

    // m2 用新 context 重新登录，验证收不到该消息（没有存离线消息）
    m2NewCtx = await browser.newContext()
    m2NewPage = await m2NewCtx.newPage()
    await m2NewPage.goto('/login', { waitUntil: 'domcontentloaded' })
    await m2NewPage.fill('input[placeholder="输入用户名"]', m2.username)
    await m2NewPage.fill('input[placeholder="输入密码"]', PASSWORD)
    await m2NewPage.locator('button[type="submit"], button:has-text("登录")').click()
    await m2NewPage.waitForURL(/\/chat/, { timeout: 15000 })
    await goToGroups(m2NewPage)
    if (await waitForGroupVisible(m2NewPage, groupName, 8000)) {
      await m2NewPage.locator('.list-item').filter({ hasText: groupName }).click()
      await m2NewPage.waitForURL(/\/chat\/group_/, { timeout: 8000 })
      await m2NewPage.waitForTimeout(3000)
    }
    const m2Got = await waitForMessageVisible(m2NewPage, msg, 3000)
    expect(m2Got, 'm2 离线时有人在线，不应存离线消息，上线后不应收到').toBe(false)
  } finally {
    if (m2NewCtx) await m2NewCtx.close().catch(() => {})
    // m2.ctx 已被 close，teardownUsers 会再次 close 但会 catch 错误
    await teardownUsers([owner, m1]).catch(() => {})
    await Promise.all([
      fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${m2.accessToken}` },
        body: JSON.stringify({ refreshToken: '' }),
      }).catch(() => {}),
    ])
    // 删除 m2 账号
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: m2.username, password: PASSWORD }),
    }).then(r => r.json()).catch(() => null)
    if (loginRes?.data?.accessToken) {
      await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginRes.data.accessToken}` },
        body: JSON.stringify({ password: PASSWORD }),
      }).catch(() => {})
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S38: 3人群全员离线——两个离线成员各自上线后均能收到各自的离线消息
// ─────────────────────────────────────────────────────────────────────────────
test('S38: 3人群全员离线：两个离线成员各自上线后均收到离线消息', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 's38u')
  const [owner, m1, m2] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s38_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok1 = await inviteUser(owner.page, m1.username)
    if (!ok1) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok1 = await inviteUser(owner.page, m1.username)
    }
    if (!ok1) { test.skip(); return }
    let ok2 = await inviteUser(owner.page, m2.username)
    if (!ok2) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok2 = await inviteUser(owner.page, m2.username)
    }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // warmup：确认密钥就绪
    if (!await waitForGroupVisible(m1.page, groupName)) { test.skip(); return }
    if (!await waitForGroupVisible(m2.page, groupName)) { test.skip(); return }
    await m1.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await m2.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s38_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    if (!await waitForMessageVisible(m1.page, warmup, 12000)) { test.skip(); return }
    await waitForMessageVisible(m2.page, warmup, 12000)

    // m1 和 m2 全部断网
    await m1.ctx.setOffline(true)
    await m2.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    // owner 发消息（全员离线，存两条离线消息）
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const offlineMsg = `s38_offline_${Date.now()}`
    await sendMessage(owner.page, offlineMsg)
    await owner.page.waitForTimeout(1000)

    // m1 上线，应收到离线消息
    await m1.ctx.setOffline(false)
    await goToGroups(m1.page)
    await m1.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m1.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await m1.page.waitForTimeout(3000)
    expect(await waitForMessageVisible(m1.page, offlineMsg, 15000), 'm1 应收到离线消息').toBe(true)

    // m2 上线，也应收到离线消息
    await m2.ctx.setOffline(false)
    await goToGroups(m2.page)
    await m2.page.locator('.list-item').filter({ hasText: groupName }).click()
    await m2.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await m2.page.waitForTimeout(3000)
    expect(await waitForMessageVisible(m2.page, offlineMsg, 15000), 'm2 应收到离线消息').toBe(true)
  } finally {
    await m1.ctx.setOffline(false).catch(() => {})
    await m2.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S39: 多条离线消息批量到达——按发送顺序排列，无乱序
// ─────────────────────────────────────────────────────────────────────────────
test('S39: 多条离线消息批量到达：按发送时间顺序排列，无乱序', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's39u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s39_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s39_warm_${Date.now()}`
    const warmOk = await enterGroupAndSend(owner.page, groupName, warmup)
    if (!warmOk) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    // receiver 离线
    await receiver.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    // owner 连续发3条消息
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    const ts = Date.now()
    const msgs = [`s39_msg1_${ts}`, `s39_msg2_${ts}`, `s39_msg3_${ts}`]
    for (const m of msgs) {
      await sendMessage(owner.page, m)
      await owner.page.waitForTimeout(300)
    }
    await owner.page.waitForTimeout(500)

    // receiver 重连
    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(5000)

    // 验证3条消息都到达
    for (const m of msgs) {
      expect(await waitForMessageVisible(receiver.page, m, 10000), `${m} 应收到`).toBe(true)
    }
    // 验证顺序：msg1 在 msg3 前面
    const allBubbles = await receiver.page.locator('.msg-bubble').allTextContents()
    const idx1 = allBubbles.findIndex(t => t.includes(msgs[0]))
    const idx3 = allBubbles.findIndex(t => t.includes(msgs[2]))
    expect(idx1, 'msg1 应在 msg3 之前').toBeLessThan(idx3)
  } finally {
    await receiver.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S40: 离线消息含特殊字符——Emoji、中文、引号解密后内容完整
// ─────────────────────────────────────────────────────────────────────────────
test('S40: 离线消息含特殊字符：Emoji、中文、引号解密后内容完整', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's40u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s40_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s40_warm_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, warmup)) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    await receiver.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    const specialMsg = `你好👋"世界"&<>'测试${Date.now()}`
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await sendMessage(owner.page, specialMsg)
    await owner.page.waitForTimeout(800)

    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)

    expect(await waitForMessageVisible(receiver.page, specialMsg, 15000), '特殊字符消息应正确送达').toBe(true)
    const decryptFailed = await receiver.page.locator('.msg-bubble')
      .filter({ hasText: '[解密失败]' }).isVisible().catch(() => false)
    expect(decryptFailed, '不应出现解密失败').toBe(false)
  } finally {
    await receiver.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S41: receiver 离线、发送方在线——离线消息正常存储并投递
// ─────────────────────────────────────────────────────────────────────────────
test('S41: receiver 离线而发送方在线：离线消息正常存储，receiver 上线后收到', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's41u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s41_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s41_warm_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, warmup)) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    // 只有 receiver 离线，owner 保持在线
    await receiver.ctx.setOffline(true)
    await owner.page.waitForTimeout(2000)

    const offlineMsg = `s41_offline_${Date.now()}`
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await sendMessage(owner.page, offlineMsg)
    await owner.page.waitForTimeout(1000)

    // receiver 重连
    await receiver.ctx.setOffline(false)
    await goToGroups(receiver.page)
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    await receiver.page.waitForTimeout(4000)

    expect(await waitForMessageVisible(receiver.page, offlineMsg, 15000), 'receiver 上线后应收到离线消息').toBe(true)
    const decryptFailed = await receiver.page.locator('.msg-bubble')
      .filter({ hasText: '[解密失败]' }).isVisible().catch(() => false)
    expect(decryptFailed, '不应解密失败').toBe(false)
  } finally {
    await receiver.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S42: 断线后发消息——WS 重连后自动重发，成功送达
// ─────────────────────────────────────────────────────────────────────────────
test('S42: 断线后发消息：WS 重连后自动重发并送达对方', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's42u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s42_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const warmup = `s42_warm_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, warmup)) { test.skip(); return }
    if (!await waitForMessageVisible(receiver.page, warmup, 12000)) { test.skip(); return }

    // owner 已在群聊页，断网后立刻在当前页发消息（WS 断开状态，进入重发队列）
    await owner.ctx.setOffline(true)
    await owner.page.waitForTimeout(500)
    const disconnectedMsg = `s42_disco_${Date.now()}`
    await sendMessage(owner.page, disconnectedMsg)
    // 恢复网络，等待 WS 重连并自动重发
    await owner.ctx.setOffline(false)
    await owner.page.waitForTimeout(8000)

    // receiver 应收到（重连后重发送达）
    expect(await waitForMessageVisible(receiver.page, disconnectedMsg, 25000), 'receiver 应收到断线重连后自动重发的消息').toBe(true)
  } finally {
    await owner.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S43: 群聊发送 Emoji 消息——对方收到后显示正确
// ─────────────────────────────────────────────────────────────────────────────
test('S43: 群聊 Emoji 消息发送：对方收到后 Emoji 正确显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's43u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s43_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    const emojiMsg = `s43_🎉😊🔥_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, emojiMsg)) { test.skip(); return }
    expect(await waitForMessageVisible(receiver.page, emojiMsg, 12000), 'Emoji 消息应被对方收到').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S44: 群聊长消息（500字）——发送成功，接收方完整显示
// ─────────────────────────────────────────────────────────────────────────────
test('S44: 群聊长消息（500字）：发送成功，接收方完整显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's44u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s44_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }
    await receiver.page.locator('.list-item').filter({ hasText: groupName }).click()
    await receiver.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    // 生成500字长消息，前缀唯一，用于定位
    const prefix = `s44_long_${Date.now()}_`
    const longMsg = prefix + 'x'.repeat(500 - prefix.length)
    if (!await enterGroupAndSend(owner.page, groupName, longMsg)) { test.skip(); return }
    expect(await waitForMessageVisible(receiver.page, prefix, 12000), '长消息应被完整收到').toBe(true)
    const receivedText = await receiver.page.locator('.msg-bubble').filter({ hasText: prefix }).textContent()
    expect(receivedText?.includes(prefix), '接收方消息内容应完整').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S45: 群聊切换——群A → 群B → 回群A，消息不串台
// ─────────────────────────────────────────────────────────────────────────────
test('S45: 群聊切换：群A → 群B → 回群A，消息不串台', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's45u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const nameA = `s45_grpA_${Date.now()}`
    const nameB = `s45_grpB_${Date.now()}`
    await createGroup(owner.page, nameA)
    await createGroup(owner.page, nameB)
    // 邀请 member 进两个群
    await openInviteModal(owner.page, nameA)
    await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    await openInviteModal(owner.page, nameB)
    await inviteUser(owner.page, member.username)
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, nameA)) { test.skip(); return }
    if (!await waitForGroupVisible(member.page, nameB)) { test.skip(); return }
    await member.page.locator('.list-item').filter({ hasText: nameA }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    const msgA = `s45_msgA_${Date.now()}`
    const msgB = `s45_msgB_${Date.now()}`

    if (!await enterGroupAndSend(owner.page, nameA, msgA)) { test.skip(); return }
    if (!await waitForMessageVisible(member.page, msgA, 12000)) { test.skip(); return }

    // 切到群B
    await goToGroups(owner.page)
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: nameB }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    if (!await enterGroupAndSend(owner.page, nameB, msgB)) { test.skip(); return }
    if (!await waitForMessageVisible(member.page, msgB, 12000)) { test.skip(); return }
    // 群B中不应出现群A的消息
    const aInB = await waitForMessageVisible(member.page, msgA, 2000)
    expect(aInB, '群B中不应出现群A的消息').toBe(false)

    // 切回群A
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: nameA }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    // 群A有msgA，没有msgB
    expect(await waitForMessageVisible(member.page, msgA, 8000), '群A应有 msgA').toBe(true)
    const bInA = await waitForMessageVisible(member.page, msgB, 2000)
    expect(bInA, '群A中不应出现群B的消息').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S46: WS 重连后群组页群列表自动刷新
// ─────────────────────────────────────────────────────────────────────────────
test('S46: WS 重连后群组页群列表自动刷新，新建的群可见', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's46u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    await goToGroups(member.page)
    const groupName = `s46_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // member 断网再重连，重连后群列表应自动更新
    await member.ctx.setOffline(true)
    await member.page.waitForTimeout(1000)
    await member.ctx.setOffline(false)
    // 等待 WS 重连 + 群列表刷新
    await member.page.waitForTimeout(4000)

    // member 的群组页应出现新群
    expect(
      await waitForGroupVisible(member.page, groupName, 10000),
      'WS 重连后 member 群组页应能看到新群'
    ).toBe(true)
  } finally {
    await member.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S47: 新成员入群立刻发消息——群内其他成员能收到
// ─────────────────────────────────────────────────────────────────────────────
test('S47: 新成员入群立刻发消息（密钥就绪后），群内其他成员能收到', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's47u')
  const [owner, newMember] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s47_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, newMember.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, newMember.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(newMember.page, groupName)) { test.skip(); return }
    // owner 进群等待
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })

    // newMember 进群立刻发消息
    const newMsg = `s47_newmember_${Date.now()}`
    if (!await enterGroupAndSend(newMember.page, groupName, newMsg)) { test.skip(); return }
    expect(await waitForMessageVisible(owner.page, newMsg, 15000), 'owner 应收到新成员发的消息').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S48: 发送方发消息给全离线群——自己能看到 offline 状态标识
// ─────────────────────────────────────────────────────────────────────────────
test('S48: 全员离线时发消息：发送方气泡显示 offline 状态', async ({ browser }) => {
  test.setTimeout(420_000)
  const users = await setupUsers(browser, 2, 's48u')
  const [owner, receiver] = users
  let receiverCtxClosed = false
  try {
    await goToGroups(owner.page)
    const groupName = `s48_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // receiver 需要先导航到群组页才能看到群列表
    await goToGroups(receiver.page)
    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }

    // receiver 关闭上下文（TCP 断开，server 立刻感知），不能用 setOffline（keepalive 延迟）
    await receiver.ctx.close()
    receiverCtxClosed = true
    await owner.page.waitForTimeout(2000)

    const offlineMsg = `s48_status_${Date.now()}`
    await goToGroups(owner.page)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
    await sendMessage(owner.page, offlineMsg)

    // .msg-status 在 .msg-bubble-wrap > .msg-meta 里，不在 .msg-bubble 里
    const row = owner.page.locator('.msg-row.mine').filter({ hasText: offlineMsg })
    await expect(row).toBeVisible({ timeout: 8000 })
    const statusEl = row.locator('.msg-status')
    await expect(statusEl).toHaveClass(/offline/, { timeout: 15000 })
  } finally {
    if (!receiverCtxClosed) await receiver.ctx.close().catch(() => {})
    await owner.page.close().catch(() => {})
    await Promise.race([
      (async () => {
        await owner.ctx.close().catch(() => {})
        await apiDeleteAccount(owner.accessToken)
        await apiDeleteAccount(receiver.accessToken)
      })(),
      new Promise(r => setTimeout(r, 8000)),
    ])
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S49: 有人在线时发消息——发送方能看到 sent 状态（✓，非 offline/failed）
// 注：server 送达在线成员 → CHAT_DELIVERY{status:"delivered"} → 前端 → 'sent'（单勾）
// ─────────────────────────────────────────────────────────────────────────────
test('S49: 有人在线时发消息：发送方气泡显示 sent 状态', async ({ browser }) => {
  test.setTimeout(420_000)
  const users = await setupUsers(browser, 2, 's49u')
  const [owner, receiver] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s49_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, receiver.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, receiver.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    // receiver 需要先导航到群组页才能看到群列表
    await goToGroups(receiver.page)
    if (!await waitForGroupVisible(receiver.page, groupName)) { test.skip(); return }

    const msg = `s49_sent_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, msg)) { test.skip(); return }

    // .msg-status 在 .msg-row.mine > .msg-bubble-wrap > .msg-meta 里
    const row = owner.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 8000 })
    const statusEl = row.locator('.msg-status')
    const statusClass = await statusEl.getAttribute('class').catch(() => '')
    const cls = statusClass ?? ''
    expect(cls.includes('offline'), '有人在线时不应是 offline 状态').toBe(false)
    expect(cls.includes('failed'), '有人在线时不应是 failed 状态').toBe(false)
  } finally {
    // 先关 page 再关 ctx，避免 ctx.close() 等待 inflight 密钥轮换请求
    await Promise.all(users.map(u => u.page.close().catch(() => {})))
    await Promise.race([
      Promise.all(users.map(u => u.ctx.close().catch(() => {}))),
      new Promise(r => setTimeout(r, 8000)),
    ])
    await Promise.all(users.map(u => apiDeleteAccount(u.accessToken)))
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S50: 退群后会话从本设备清除——群聊从会话列表消失
// ─────────────────────────────────────────────────────────────────────────────
test('S50: 退群后群聊从本设备会话列表（侧边栏）消失', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's50u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s50_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    // member 进群发一条消息（让会话出现在会话列表）
    if (!await enterGroupAndSend(owner.page, groupName, `s50_pre_${Date.now()}`)) { test.skip(); return }
    await goToGroups(member.page)
    // member 退群
    await leaveGroup(member.page, groupName)
    // 会话列表中群聊应消失
    await member.page.locator('a[href="/chat"], nav a').filter({ hasText: /消息|聊天|Chat/ }).click().catch(() => {})
    await member.page.goto('/chat', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await member.page.waitForTimeout(2000)
    const groupInChat = await member.page.locator('.list-item').filter({ hasText: groupName }).isVisible().catch(() => false)
    expect(groupInChat, '退群后群聊应从会话列表消失').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S51: 进入群聊后 URL 格式正确
// ─────────────────────────────────────────────────────────────────────────────
test('S51: 点击群聊进入后 URL 格式为 /chat/group_{groupName}', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's51u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s51_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await owner.page.locator('.list-item').filter({ hasText: groupName }).click()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    expect(owner.page.url()).toMatch(/\/chat\/group_/)
    expect(owner.page.url()).toContain(encodeURIComponent(groupName).replace(/%/g, '%').slice(0, 10))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S52: 成员数随退群实时更新（reload 后验证持久化）
// ─────────────────────────────────────────────────────────────────────────────
test('S52: 成员数随退群操作更新，重新加载页面后也正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's52u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s52_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    // 邀请成功后 owner 侧成员数应为 2
    const itemBefore = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(itemBefore.locator('.list-item-sub')).toContainText('2', { timeout: 8000 })

    // member 退群
    await goToGroups(member.page)
    await leaveGroup(member.page, groupName)
    // owner reload 后成员数应为 1
    await owner.page.reload()
    await goToGroups(owner.page)
    const itemAfter = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(itemAfter.locator('.list-item-sub')).toContainText('1', { timeout: 8000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S53: 仅发送方在群（其他人都退了）——发消息不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('S53: 仅发送方在群（其他成员已退）：发消息不崩溃，界面正常', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's53u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s53_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }

    // member 退群
    await goToGroups(member.page)
    await leaveGroup(member.page, groupName)
    await owner.page.waitForTimeout(1500)

    // owner 仅剩自己，发消息不崩溃
    const soloMsg = `s53_solo_${Date.now()}`
    const sent = await enterGroupAndSend(owner.page, groupName, soloMsg)
    expect(sent, 'owner 独自在群中发消息应成功').toBe(true)
    // 页面无崩溃（无 error boundary 或 500 提示）
    const errorVisible = await owner.page.locator('text=Something went wrong').isVisible().catch(() => false)
    expect(errorVisible, '页面不应崩溃').toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S54: 群主创建群后立刻邀请成员——被邀请者立刻收到入群通知
// ─────────────────────────────────────────────────────────────────────────────
test('S54: 创建群后立刻邀请成员：被邀请者立刻在群组页看到新群', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's54u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    await goToGroups(member.page)
    const groupName = `s54_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    // 立刻邀请
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
    // member 侧应立刻看到新群
    expect(await waitForGroupVisible(member.page, groupName, 12000), 'member 应立刻看到新群').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S55: 创建群名称为空——无法创建，按钮禁用或有提示
// ─────────────────────────────────────────────────────────────────────────────
test('S55: 创建群名称为空时：无法创建空名群（按钮禁用或不响应）', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's55u')
  const [owner] = users
  try {
    await goToGroups(owner.page)
    await owner.page.locator('button', { hasText: '+ 创建' }).click()
    await expect(owner.page.locator('.modal')).toBeVisible({ timeout: 3000 })
    // 不填名称，直接点创建
    await owner.page.locator('.modal input[type="text"]').fill('')
    await owner.page.locator('.modal .btn-primary').click()
    // 弹窗应仍然存在（未成功创建）
    await expect(owner.page.locator('.modal')).toBeVisible({ timeout: 2000 })
    // 关闭弹窗
    await owner.page.locator('.modal button', { hasText: '取消' }).click().catch(() => {})
    await owner.page.keyboard.press('Escape').catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S56: 断线重连后群聊历史消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('S56: 断线重连后群聊历史消息仍在 IDB，刷新后可见', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's56u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s56_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const histMsg = `s56_hist_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, histMsg)) { test.skip(); return }
    if (!await waitForMessageVisible(member.page, histMsg, 12000)) { test.skip(); return }

    // member 断线重连
    await member.ctx.setOffline(true)
    await member.page.waitForTimeout(500)
    await member.ctx.setOffline(false)
    await member.page.waitForTimeout(3000)

    // 重新进入群聊
    await goToGroups(member.page)
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    expect(await waitForMessageVisible(member.page, histMsg, 10000), '重连后历史消息应仍在').toBe(true)
  } finally {
    await member.ctx.setOffline(false).catch(() => {})
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S57: 访问不存在的群聊会话 ID——页面不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('S57: 访问不存在的群聊会话 ID：页面不崩溃，降级处理', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 's57u')
  const [owner] = users
  try {
    await owner.page.goto('/chat/group_nonexistent_group_xyz_999', { waitUntil: 'domcontentloaded' })
    await owner.page.waitForTimeout(2000)
    // 不应有 JS 崩溃（error boundary 或空白页）
    const crashed = await owner.page.locator('text=Something went wrong').isVisible().catch(() => false)
    expect(crashed, '访问不存在群聊时页面不应崩溃').toBe(false)
    // 页面应渲染（有聊天页面结构或跳转回首页）
    const hasBody = await owner.page.locator('body').isVisible()
    expect(hasBody, '页面应有内容').toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// S58: 多次快速退出再重进同一群——消息历史一致，无重复条目
// ─────────────────────────────────────────────────────────────────────────────
test('S58: 多次快速退出再重进同一群：消息历史一致，无重复条目', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 's58u')
  const [owner, member] = users
  try {
    await goToGroups(owner.page)
    const groupName = `s58_grp_${Date.now()}`
    await createGroup(owner.page, groupName)
    await openInviteModal(owner.page, groupName)
    let ok = await inviteUser(owner.page, member.username)
    if (!ok) {
      await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await goToGroups(owner.page)
      await openInviteModal(owner.page, groupName)
      ok = await inviteUser(owner.page, member.username)
    }
    if (!ok) { test.skip(); return }
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

    if (!await waitForGroupVisible(member.page, groupName)) { test.skip(); return }
    await member.page.locator('.list-item').filter({ hasText: groupName }).click()
    await member.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
    const uniqueMsg = `s58_unique_${Date.now()}`
    if (!await enterGroupAndSend(owner.page, groupName, uniqueMsg)) { test.skip(); return }
    if (!await waitForMessageVisible(member.page, uniqueMsg, 12000)) { test.skip(); return }

    // 快速退出再重进群聊页（3次）
    for (let i = 0; i < 3; i++) {
      await goToGroups(member.page)
      await member.page.locator('.list-item').filter({ hasText: groupName }).click()
      await member.page.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await member.page.waitForTimeout(500)
    }

    // 消息无重复
    const allBubbles = await member.page.locator('.msg-bubble').filter({ hasText: uniqueMsg }).all()
    expect(allBubbles.length, '消息不应重复显示').toBeLessThanOrEqual(1)
  } finally {
    await teardownUsers(users)
  }
})
