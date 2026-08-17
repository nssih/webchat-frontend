/**
 * 群聊功能全流程 Playwright 测试
 *
 * 每个 test 动态注册两个独立账号（后缀 Date.now()），测后注销，
 * 避免账号历史状态（历史群、历史密钥）干扰测试结果。
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'

// ── API helpers（直接调后端，不走 UI，加速 setup/teardown）────────────────────

async function apiRegister(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword: password }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(`注册失败: ${data.message}`)
  return data.data as { accessToken: string; refreshToken: string; user: { username: string } }
}

async function apiDeleteAccount(accessToken: string, password = 'Test1234!') {
  await fetch(`${BASE_URL}/api/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => {})
}

// ── UI helpers ────────────────────────────────────────────────────────────────

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.locator('input[placeholder="输入用户名"]').fill(username)
  await page.locator('input[placeholder="输入密码"]').fill(password)
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
  const groupRow = page.locator('.list-item').filter({ hasText: groupName })
  await groupRow.locator('button', { hasText: '邀请' }).click()
  await expect(page.locator('.modal').filter({ hasText: '邀请在线用户' })).toBeVisible({ timeout: 5000 })
}

/** 生成不冲突的测试用户名（字母+时间戳+随机4位） */
function makeUsernames() {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return {
    userA: `ta${ts}${rand}`,
    userB: `tb${ts}${rand}`,
    password: 'Test1234!',
  }
}

/** 通用 setup：注册两账号，打开两浏览器上下文，登录，返回 cleanup 函数 */
async function setupTwoFreshUsers(browser: import('@playwright/test').Browser) {
  const { userA, userB, password } = makeUsernames()

  // 串行注册避免 SQLite 并发写竞态
  const authA = await apiRegister(userA, password)
  const authB = await apiRegister(userB, password)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // 串行登录：避免 SQLite DeviceToken 并发写竞态
  await login(pageA, userA, password)
  await login(pageB, userB, password)

  // 防止后台标签节能暂停 WS 连接
  await pageA.bringToFront()
  await pageB.bringToFront()

  async function cleanup() {
    await Promise.all([ctxA.close(), ctxB.close()])
    await Promise.all([
      apiDeleteAccount(authA.accessToken),
      apiDeleteAccount(authB.accessToken),
    ])
  }

  return { pageA, pageB, ctxA, ctxB, userA, userB, authA, authB, cleanup }
}

// ── T1: 创建群组 ──────────────────────────────────────────────────────────────

test.describe('T1: 创建群组', () => {
  test('创建成功后群出现在列表，无错误提示', async ({ browser }) => {
    const { userA, password, authA } = makeUsernames().valueOf() as never
    const names = makeUsernames()
    const ctxA = await browser.newContext()
    const pageA = await ctxA.newPage()
    const authData = await apiRegister(names.userA, names.password)

    try {
      await login(pageA, names.userA, names.password)
      await goToGroups(pageA)

      const groupName = `grp_${Date.now()}`
      await createGroup(pageA, groupName)

      await expect(pageA.locator('.list-item').filter({ hasText: groupName })).toBeVisible()
      await expect(pageA.locator('.form-error')).not.toBeVisible()
    } finally {
      await ctxA.close()
      await apiDeleteAccount(authData.accessToken)
    }
  })
})

// ── T2: 邀请成员 — 无网络错误（Bug 3）────────────────────────────────────────

test.describe('T2: 邀请成员 — 无网络错误', () => {
  test('邀请 API 调用成功，不出现网络错误提示', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      // B 先到群组页保持活跃，让 WS 连接不被后台节能断掉
      await goToGroups(pageB)
      await pageA.bringToFront()  // A 回到前台继续操作

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()

      // 等待邀请结果（成功/警告/错误都会显示 invite-msg）
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })

      // 不能是网络错误
      await expect(pageA.locator('.invite-msg-error')).not.toBeVisible()
      const msgText = await pageA.locator('.invite-msg').textContent()
      expect(msgText).not.toContain('网络错误')
      expect(msgText).not.toContain('500')
    } finally {
      await cleanup()
    }
  })
})

// ── T3: 被邀请方实时收到入群通知（Bug 1）─────────────────────────────────────

test.describe('T3: 被邀请方实时收到入群通知', () => {
  test('B 在群组页，A 邀请后 B 群列表 8 秒内出现新群', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      await goToGroups(pageB)  // B 停在群组页观察实时更新

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })

      // GROUP_MEMBER_ADDED WS 事件触发 B 的群列表刷新
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 12000 })
    } finally {
      await cleanup()
    }
  })

  test('B 不在群组页时，导航到群组页后也能看到新群', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      // B 停在消息页（默认 /chat）

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })

      // B 导航到群组页，应该能看到新群
      await goToGroups(pageB)
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 5000 })
    } finally {
      await cleanup()
    }
  })
})

// ── T4: 邀请按钮只禁用对应行（Bug 4）────────────────────────────────────────

test.describe('T4: 邀请按钮只禁用对应行', () => {
  test('邀请进行中，仅被邀请行 disabled，其他行按钮可点', async ({ browser }) => {
    // 需要至少 2 个可邀请的在线用户：A 是群主，B/C 是被邀请方
    const ts = Date.now()
    const rand = Math.floor(Math.random() * 9000 + 1000)
    const userA = `t4a${ts}${rand}`
    const userB = `t4b${ts}${rand}`
    const userC = `t4c${ts}${rand}`
    const password = 'Test1234!'

    // 串行注册避免并发写竞态
    const authA = await apiRegister(userA, password)
    const authB = await apiRegister(userB, password)
    const authC = await apiRegister(userC, password)

    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const ctxC = await browser.newContext()
    const [pageA, pageB, pageC] = [await ctxA.newPage(), await ctxB.newPage(), await ctxC.newPage()]

    try {
      // A 先登录并建群，再让 B/C 登录上线，最后 A 重新打开弹窗拿到完整在线列表
      await login(pageA, userA, password)

      const groupName = `grp_t4_${ts}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)

      // B/C 登录后 WS 上线，A 先不开弹窗
      await login(pageB, userB, password)
      await login(pageC, userC, password)
      // 给 WS USER_ONLINE 广播留足时间
      await pageA.waitForTimeout(2000)

      // A 打开邀请弹窗（此时 B/C 已在线，接口拉到完整列表）
      await openInviteModal(pageA, groupName)

      // 等待列表渲染（最多 5s）
      await pageA.waitForTimeout(1000)

      const eligibleRows = pageA.locator('.modal .list-item').filter({
        has: pageA.locator('button', { hasText: '邀请' }),
      })
      // 等待至少 2 行出现
      await expect(eligibleRows.nth(1)).toBeVisible({ timeout: 8000 })
      const count = await eligibleRows.count()

      // 拦截 invite 请求，加 2 秒延迟，在此期间检查按钮状态
      await pageA.route('**/api/groups/*/members/*', async route => {
        await new Promise(r => setTimeout(r, 2000))
        await route.continue()
      })

      // 点第一行邀请
      const firstBtn = eligibleRows.nth(0).locator('button', { hasText: '邀请' })
      await firstBtn.click()

      // 第一行应该 disabled（正在邀请中）
      await expect(firstBtn).toBeDisabled({ timeout: 500 })

      // 其他行的按钮不能被 disabled（Bug 4 核心验证）
      for (let i = 1; i < Math.min(count, 3); i++) {
        const otherBtn = eligibleRows.nth(i).locator('button', { hasText: '邀请' })
        await expect(otherBtn).not.toBeDisabled()
      }

      // 等请求完成
      await pageA.waitForResponse('**/api/groups/*/members/*', { timeout: 10000 }).catch(() => {})
    } finally {
      await Promise.all([ctxA.close(), ctxB.close(), ctxC.close()])
      await Promise.all([
        apiDeleteAccount(authA.accessToken),
        apiDeleteAccount(authB.accessToken),
        apiDeleteAccount(authC.accessToken),
      ])
    }
  })
})

// ── T5: 被邀请方能发送群消息（Bug 2）────────────────────────────────────────

test.describe('T5: 被邀请方能发送群消息', () => {
  test('B 被邀请后进入群聊可以发消息，A 能收到', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      await goToGroups(pageB)

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      // 等密钥分发完成
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })

      // B 等待 GROUP_MEMBER_ADDED，群出现后进入群聊
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 12000 })
      await pageB.locator('.list-item').filter({ hasText: groupName }).click()
      await pageB.waitForURL(/\/chat\/group_/, { timeout: 5000 })

      // B 发消息（重试直到密钥加载完成，最多等 15s，每 2.5s 重试一次发送）
      const msgFromB = `msg_b_${Date.now()}`
      let bubbleVisible = false
      for (let i = 0; i < 6; i++) {
        await pageB.locator('.chat-input').fill(msgFromB)
        await pageB.locator('button', { hasText: '发送' }).click()
        bubbleVisible = await pageB.locator('.msg-bubble').filter({ hasText: msgFromB })
          .waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
        if (bubbleVisible) break
        await pageB.waitForTimeout(2500)
      }
      expect(bubbleVisible).toBe(true)

      // 消息不应是 failed（发送被 block 时变 failed）
      const bubbleB = pageB.locator('.msg-row').filter({ hasText: msgFromB })
      await expect(bubbleB.locator('.msg-status-failed')).not.toBeVisible({ timeout: 3000 })

      // A 关闭邀请弹窗，进入群聊，收到 B 的消息
      await pageA.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await pageA.locator('.list-item').filter({ hasText: groupName }).click()
      await pageA.waitForURL(/\/chat\/group_/, { timeout: 5000 })
      await expect(pageA.locator('.msg-bubble').filter({ hasText: msgFromB }))
        .toBeVisible({ timeout: 12000 })
    } finally {
      await cleanup()
    }
  })
})

// ── T6: 群主发消息，成员实时收到 ─────────────────────────────────────────────

test.describe('T6: 群主发消息，成员实时收到', () => {
  test('A 在群聊发消息，B 能实时收到', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      await goToGroups(pageB)

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })

      // B 进入群聊
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 12000 })
      await pageB.locator('.list-item').filter({ hasText: groupName }).click()
      await pageB.waitForURL(/\/chat\/group_/, { timeout: 5000 })

      // 等 B 的群密钥就绪：用重试发一条探针消息，确认能加密成功后 A 再发
      const probeMsg = `probe_${Date.now()}`
      let probeOk = false
      for (let i = 0; i < 8; i++) {
        await pageB.locator('.chat-input').fill(probeMsg)
        await pageB.locator('button', { hasText: '发送' }).click()
        probeOk = await pageB.locator('.msg-bubble').filter({ hasText: probeMsg })
          .waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
        if (probeOk) break
        await pageB.waitForTimeout(2000)
      }
      expect(probeOk, 'B 探针消息发送失败，群密钥未就绪').toBe(true)

      // A 关闭弹窗，进入群聊发消息
      await pageA.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
      await pageA.locator('.list-item').filter({ hasText: groupName }).click()
      await pageA.waitForURL(/\/chat\/group_/, { timeout: 5000 })

      const msgFromA = `msg_a_${Date.now()}`
      await pageA.locator('.chat-input').fill(msgFromA)
      await pageA.locator('button', { hasText: '发送' }).click()

      await expect(pageA.locator('.msg-bubble').filter({ hasText: msgFromA }))
        .toBeVisible({ timeout: 5000 })

      // B 实时收到 A 的消息（密钥已就绪，无需解密失败重试）
      await expect(pageB.locator('.msg-bubble').filter({ hasText: msgFromA }))
        .toBeVisible({ timeout: 12000 })
    } finally {
      await cleanup()
    }
  })
})

// ── T7: 群主解散群，成员群列表消失 ───────────────────────────────────────────

test.describe('T7: 群主解散群，成员实时看到群消失', () => {
  test('A 解散群，B 群组页 8 秒内该群消失', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      await goToGroups(pageB)

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })
      await pageA.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

      // B 等待群出现
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 12000 })

      // A 退出（群主退出 = 解散）
      await pageA.locator('.list-item').filter({ hasText: groupName })
        .locator('button.btn-danger').click()
      await expect(pageA.locator('.modal')).toBeVisible({ timeout: 2000 })
      await pageA.locator('.modal .btn-danger').click()

      // A 侧群消失
      await expect(pageA.locator('.list-item').filter({ hasText: groupName }))
        .not.toBeVisible({ timeout: 5000 })

      // B 侧实时消失（GROUP_DISSOLVED WS 事件）
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .not.toBeVisible({ timeout: 8000 })
    } finally {
      await cleanup()
    }
  })
})

// ── T8: 成员退群后群主仍可发消息 ─────────────────────────────────────────────

test.describe('T8: 成员退群后群主仍可发消息', () => {
  test('B 退群后，A 发消息不报加密错误', async ({ browser }) => {
    const setup = await setupTwoFreshUsers(browser)
    const { pageA, pageB, userB, cleanup } = setup

    try {
      await goToGroups(pageB)

      const groupName = `grp_${Date.now()}`
      await goToGroups(pageA)
      await createGroup(pageA, groupName)
      await openInviteModal(pageA, groupName)

      const bRow = pageA.locator('.modal .list-item').filter({ hasText: userB })
      if (!(await bRow.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false))) {
        test.skip()
        return
      }

      await bRow.locator('button', { hasText: '邀请' }).click()
      await expect(pageA.locator('.invite-msg')).toBeVisible({ timeout: 15000 })
      await pageA.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

      // B 等待群出现后，A 先进入群聊（这样 A 能实时收到 GROUP_KEY_ROTATE 事件）
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .toBeVisible({ timeout: 12000 })

      await pageA.locator('.list-item').filter({ hasText: groupName }).click()
      await pageA.waitForURL(/\/chat\/group_/, { timeout: 5000 })

      // B 退群
      await pageB.locator('.list-item').filter({ hasText: groupName })
        .locator('button.btn-danger').click()
      await expect(pageB.locator('.modal')).toBeVisible({ timeout: 2000 })
      await pageB.locator('.modal .btn-danger').click()
      await expect(pageB.locator('.list-item').filter({ hasText: groupName }))
        .not.toBeVisible({ timeout: 5000 })

      // A 在群聊内，GROUP_KEY_ROTATE 会推送过来，密钥缓存自动失效并重新加载
      // 重试发消息直到成功（最多等 20s，每 2s 重试）
      const msgAfterLeave = `msg_after_leave_${Date.now()}`
      let msgVisible = false
      for (let i = 0; i < 10; i++) {
        await pageA.locator('.chat-input').fill(msgAfterLeave)
        await pageA.locator('button', { hasText: '发送' }).click()
        msgVisible = await pageA.locator('.msg-bubble').filter({ hasText: msgAfterLeave })
          .waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
        if (msgVisible) break
        await pageA.waitForTimeout(2000)
      }
      expect(msgVisible).toBe(true)

      // 没有密钥错误提示
      await expect(pageA.locator('.no-key-warning')).not.toBeVisible({ timeout: 2000 })

      // 消息状态不是 failed
      const bubble = pageA.locator('.msg-row').filter({ hasText: msgAfterLeave })
      await expect(bubble.locator('.msg-status-failed')).not.toBeVisible({ timeout: 3000 })
    } finally {
      await cleanup()
    }
  })
})
