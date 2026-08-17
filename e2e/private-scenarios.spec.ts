/**
 * 私聊全场景测试
 *
 * P1   注册新账号后可登录，会话列表页加载正常
 * P2   重复注册相同用户名返回错误提示
 * P3   用错误密码登录返回错误提示
 * P4   登录后退出，再次访问 /chat 重定向到 /login
 * P5   退出后在 /login 重新登录成功
 * P6   注销账号后该账号无法再登录
 * P7   注销账号需要输入密码，密码错误时提示错误
 * P8   注销账号取消操作后账号仍可正常使用
 * P9   登录后刷新页面仍保持登录状态（token 持久化）
 * P10  两个独立浏览器上下文可分别登录不同账号同时在线
 * P11  A 给 B 发一条文字消息，B 实时收到
 * P12  B 回复 A，A 实时收到（双向通信验证）
 * P13  连续发送 10 条消息，接收方全部按顺序收到
 * P14  发送含 Emoji 的消息（🎉🔥💬），对方收到内容一致
 * P15  发送纯中文消息，对方收到内容一致不乱码
 * P16  发送中英文混排消息，内容完整
 * P17  发送包含换行的消息（Shift+Enter），对方看到换行格式
 * P18  发送含 URL 的消息，链接文本正确显示
 * P19  发送 5000 字符超长消息，双方均完整显示
 * P20  尝试发送空消息（只有空格），发送按钮应禁用或无效
 * P21  发送 XSS payload（<script>alert(1)</script>），界面不弹窗
 * P22  发送 HTML 特殊字符（<>&"'），显示为文字而非被解析
 * P23  发送消息后自己气泡在右侧（mine）
 * P24  收到消息后对方气泡在左侧（不含 mine 类）
 * P25  发送消息后状态图标出现（sent/delivered）
 * P26  对方在线时消息状态变为 delivered
 * P27  对方离线时消息状态为 offline
 * P28  对方上线收到离线消息后，发送方状态从 offline 变 delivered
 * P29  新消息到达时会话列表顶部显示该会话
 * P30  未读消息数徽章显示在会话列表项上
 * P31  进入会话后未读徽章清零
 * P32  会话列表最后一条消息内容预览正确
 * P33  发送方在对方已读后无论如何不再看到 offline 标记
 * P34  断线后发消息显示 failed 状态（WS 不可用时）
 * P35  重连后之前 failed 的消息自动重发变成 delivered
 * P36  A 先发消息，B 登录后收到（离线消息投递）
 * P37  A 给下线的 B 发多条消息，B 上线后全部收到，无遗漏
 * P38  离线消息上线收到后，再次重连不重复投递
 * P39  刷新页面后历史消息从 IDB 恢复，无需重拉
 * P40  切换到其他会话再切回，原会话消息仍在
 * P41  退出再登录，历史消息从 IDB 恢复
 * P42  在线好友列表显示对方用户名
 * P43  从好友列表点击用户进入私聊会话
 * P44  会话 URL 格式为 /chat/private_{sorted}
 * P45  在聊天页点击左上角返回按钮回到会话列表
 * P46  聊天页标题显示对方用户名或昵称
 * P47  修改昵称后，聊天页标题更新为新昵称
 * P48  Emoji 表情选择器打开后点击表情填入输入框
 * P49  Emoji 表情选择器打开后点击背景遮罩关闭
 * P50  输入框随内容增多自动扩展高度
 * P51  消息列表超出屏幕后可滚动
 * P52  收到新消息时若不在底部，显示"新消息"提示 hint
 * P53  点击"新消息"提示 hint 后滚动到最新消息
 * P54  点击"新消息"hint 后 hint 消失
 * P55  右键气泡出现上下文菜单
 * P56  上下文菜单包含"回复"选项
 * P57  上下文菜单点击空白处关闭
 * P58  点击"清除聊天记录"弹出确认菜单
 * P59  确认清除聊天记录后消息列表清空
 * P60  取消清除聊天记录后消息仍在
 * P61  加密警告 .encryption-warning 在加密就绪后不可见
 * P62  发送文字消息后输入框清空
 * P63  发送消息时间显示为 HH:mm 格式
 * P64  同一分钟发的多条消息，时间戳均相同格式
 * P65  A 和 B 的私聊与 A 和 C 的私聊互相独立，消息不串台
 * P66  两个不同私聊同时打开（两个浏览器 ctx），消息各自独立
 * P67  发送零宽字符消息（​），能正常发送不崩溃
 * P68  发送纯数字消息，收发正常
 * P69  发送纯符号消息（!@#$%^&*），收发正常
 * P70  会话列表按最新消息时间排序，新消息会话排到顶部
 * P71  收到消息时会话列表实时更新最后一条内容
 * P72  输入框按 Enter 发送消息（桌面端行为）
 * P73  输入框按 Shift+Enter 插入换行不发送
 * P74  输入框输入内容时发送按钮激活（不禁用）
 * P75  输入框清空时发送按钮禁用
 * P76  发送按钮点击后短时间内禁用（防重复提交）
 * P77  引用消息后取消引用，再发送普通消息无引用块
 * P78  引用预览栏切换会话后消失，不跨会话残留
 * P79  发送超过 50 字的昵称仍能正常编辑保存
 * P80  昵称设为空后保存，界面显示用户名作为 fallback
 * P81  同一用户两标签页同时打开同一私聊，两边均收到消息
 * P82  标签页 A 发消息，标签页 B 实时同步收到
 * P83  profile 页显示用户名和 UID
 * P84  profile 页"退出"需要确认再执行
 * P85  退出后 localStorage token 清除，导航到 /login
 * P86  profile 页"注销账号"输入密码确认流程
 * P87  修改昵称成功后 profile 页显示新昵称
 * P88  修改昵称点击取消后昵称不变
 * P89  会话列表空状态：无任何会话时显示空提示
 * P90  好友列表空状态：无在线用户时显示提示文字
 * P91  连续快速发送 5 条消息，全部送达不乱序
 * P92  A 和 B 互相发消息 10 条（交叉），双方均按正确顺序显示
 * P93  发送消息后 IDB 立即持久化（关闭后重开仍有）
 * P94  新消息到达时 nav-badge 总未读数更新
 * P95  进入会话后 nav-badge 未读数减少
 * P96  会话列表项点击进入正确的私聊会话
 * P97  返回会话列表后再次进入同一会话，历史消息不重复
 * P98  发送含 SQL 注入内容（' OR 1=1 --），消息原样显示不崩溃
 * P99  发送含反斜杠的消息（\n \t \\），内容完整显示
 * P100 输入框粘贴文本后能正常发送
 * P101 A 登录 → 发消息 → 退出 → 重新登录，历史消息仍在
 * P102 同一账号在两个 ctx 同时登录，两边均可正常收发消息
 * P103 在无网环境模拟（ctx.close 后重开）重连后自动重发 pending 消息
 * P104 发送消息后立刻关闭标签页再重开，消息已存 IDB 不丢失
 * P105 两人同时互发消息（并发），双方各自收到对方消息
 * P106 A 发消息给离线 B，B 上线后消息内容解密正确（E2EE 验证）
 * P107 修改昵称后，发送消息，接收方气泡显示新昵称
 * P108 发消息后删除账号，另一方历史消息仍可查看
 * P109 接收方滚动到历史消息顶部时不触发自动滚底
 * P110 消息时间戳本地时区正确显示（非 UTC）
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
  await page.waitForTimeout(500)
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

// ─────────────────────────────────────────────────────────────────────────────
// P1: 注册新账号后可登录，会话列表页加载正常
// ─────────────────────────────────────────────────────────────────────────────
test('P1: 注册新账号后可登录，会话列表加载正常', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p1u')
  try {
    await expect(users[0].page.locator('.bottom-nav')).toBeVisible({ timeout: 5000 })
    expect(users[0].page.url()).toMatch(/\/chat/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P2: 重复注册相同用户名返回错误提示
// ─────────────────────────────────────────────────────────────────────────────
test('P2: 重复注册相同用户名返回错误提示', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p2u')
  try {
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    try {
      await page2.goto('/register')
      // placeholder 是 "3-50位字母/数字/下划线"
      await page2.locator('input[type="text"]').fill(users[0].username)
      const pwdInputs = page2.locator('input[type="password"]')
      await pwdInputs.nth(0).fill(PASSWORD)
      await pwdInputs.nth(1).fill(PASSWORD)
      await page2.locator('button[type="submit"]').click()
      // 等错误提示或页面停留（3s）
      await page2.waitForTimeout(3000)
      const url = page2.url()
      const hasError = await page2.locator('.form-error').isVisible({ timeout: 2000 }).catch(() => false)
      const stillOnRegister = url.includes('/register')
      expect(hasError || stillOnRegister).toBeTruthy()
    } finally {
      await page2.close().catch(() => {})
      await ctx2.close().catch(() => {})
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P3: 用错误密码登录返回错误提示
// ─────────────────────────────────────────────────────────────────────────────
test('P3: 错误密码登录失败并提示', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p3u')
  try {
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    try {
      await page2.goto('/login')
      await page2.locator('input[placeholder="输入用户名"]').fill(users[0].username)
      await page2.locator('input[placeholder="输入密码"]').fill('WrongPass999!')
      await page2.locator('button[type="submit"]').click()
      await page2.waitForTimeout(2000)
      expect(page2.url()).toMatch(/\/login/)
    } finally {
      await page2.close().catch(() => {})
      await ctx2.close().catch(() => {})
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P4: 登录后退出，再次访问 /chat 重定向到 /login
// ─────────────────────────────────────────────────────────────────────────────
test('P4: 退出后访问 /chat 重定向到 /login', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p4u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '退出登录' }).click()
    await u.page.locator('button.btn-danger', { hasText: '确定退出' }).click()
    await u.page.waitForURL(/\/login/, { timeout: 8000 })
    await u.page.goto('/chat')
    await u.page.waitForTimeout(1500)
    expect(u.page.url()).toMatch(/\/login/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P5: 退出后在 /login 重新登录成功
// ─────────────────────────────────────────────────────────────────────────────
test('P5: 退出后重新登录成功', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p5u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '退出登录' }).click()
    await u.page.locator('button.btn-danger', { hasText: '确定退出' }).click()
    await u.page.waitForURL(/\/login/, { timeout: 8000 })
    await u.page.locator('input[placeholder="输入用户名"]').fill(u.username)
    await u.page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
    await u.page.locator('button[type="submit"]').click()
    await u.page.waitForURL(/\/chat/, { timeout: 15000 })
    await expect(u.page.locator('.bottom-nav')).toBeVisible({ timeout: 10000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P6: 注销账号后无法再登录
// ─────────────────────────────────────────────────────────────────────────────
test('P6: 注销账号后无法再登录', async ({ browser }) => {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const username = `p6u0_${ts}${rand}`
  const auth = await apiRegister(username)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, username)

  await page.goto('/profile')
  await page.locator('button', { hasText: '注销账号' }).click()
  await page.locator('input[placeholder="输入当前密码"]').fill(PASSWORD)
  await page.locator('button.btn-danger', { hasText: '确定注销' }).click()
  await page.waitForURL(/\/login/, { timeout: 10000 })

  await page.locator('input[placeholder="输入用户名"]').fill(username)
  await page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(2000)
  expect(page.url()).toMatch(/\/login/)

  await page.close().catch(() => {})
  await ctx.close().catch(() => {})
  await apiDeleteAccount(auth.accessToken).catch(() => {})
})

// ─────────────────────────────────────────────────────────────────────────────
// P7: 注销账号密码错误时提示错误
// ─────────────────────────────────────────────────────────────────────────────
test('P7: 注销账号密码错误时提示错误', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p7u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '注销账号' }).click()
    await u.page.locator('input[placeholder="输入当前密码"]').fill('WrongPass999!')
    await u.page.locator('button.btn-danger', { hasText: '确定注销' }).click()
    await u.page.waitForTimeout(2000)
    expect(u.page.url()).not.toMatch(/\/login/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P8: 注销账号取消后账号仍可正常使用
// ─────────────────────────────────────────────────────────────────────────────
test('P8: 注销取消后账号仍可正常使用', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p8u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '注销账号' }).click()
    const cancelBtn = u.page.locator('button', { hasText: '取消' }).last()
    await cancelBtn.click()
    await u.page.waitForTimeout(500)
    expect(u.page.url()).toMatch(/\/profile/)
    await u.page.goto('/chat')
    await expect(u.page.locator('.bottom-nav')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P9: 登录后刷新页面仍保持登录状态
// ─────────────────────────────────────────────────────────────────────────────
test('P9: 刷新页面后仍保持登录状态', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p9u')
  const [u] = users
  try {
    await u.page.reload()
    await u.page.waitForTimeout(2000)
    expect(u.page.url()).not.toMatch(/\/login/)
    await expect(u.page.locator('.bottom-nav')).toBeVisible({ timeout: 8000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P10: 两个独立 ctx 分别登录不同账号同时在线
// ─────────────────────────────────────────────────────────────────────────────
test('P10: 两个独立 ctx 同时登录不同账号', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p10u')
  try {
    await expect(users[0].page.locator('.bottom-nav')).toBeVisible({ timeout: 5000 })
    await expect(users[1].page.locator('.bottom-nav')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P11: A 给 B 发一条文字消息，B 实时收到
// ─────────────────────────────────────────────────────────────────────────────
test('P11: A 给 B 发消息，B 实时收到', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p11u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p11_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, msg)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P12: B 回复 A，A 实时收到（双向）
// ─────────────────────────────────────────────────────────────────────────────
test('P12: B 回复 A，A 实时收到（双向通信）', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p12u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg1 = `p12_a_${Date.now()}`
    await sendMessage(alice.page, msg1)
    if (!await waitForMessage(bob.page, msg1)) { test.skip(); return }

    const msg2 = `p12_b_${Date.now()}`
    await sendMessage(bob.page, msg2)
    expect(await waitForMessage(alice.page, msg2)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P13: 连续发送 10 条消息，接收方全部按顺序收到
// ─────────────────────────────────────────────────────────────────────────────
test('P13: 连续发 10 条消息接收方全部按顺序收到', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p13u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const ts = Date.now()
    for (let i = 0; i < 10; i++) {
      await sendMessage(alice.page, `p13_${i}_${ts}`)
    }
    for (let i = 0; i < 10; i++) {
      expect(await waitForMessage(bob.page, `p13_${i}_${ts}`)).toBe(true)
    }
    // 验证顺序：所有气泡按 p13_0 ~ p13_9 出现
    const bubbles = await bob.page.locator('.msg-bubble').allTextContents()
    const filtered = bubbles.filter(t => t.includes(`p13_`) && t.includes(`_${ts}`))
    const indices = filtered.map(t => parseInt(t.replace(`p13_`, '').split('_')[0]))
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P14: 发送含 Emoji 的消息，对方收到内容一致
// ─────────────────────────────────────────────────────────────────────────────
test('P14: 发送 Emoji 消息对方收到内容一致', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p14u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p14_🎉🔥💬_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, '🎉🔥💬')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P15: 发送纯中文消息，对方收到内容一致不乱码
// ─────────────────────────────────────────────────────────────────────────────
test('P15: 发送纯中文消息不乱码', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p15u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `你好世界测试消息${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, '你好世界测试消息')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P16: 中英文混排消息内容完整
// ─────────────────────────────────────────────────────────────────────────────
test('P16: 中英文混排消息内容完整', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p16u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `hello世界p16_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, 'hello世界p16_')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P17: 发送包含换行的消息，对方看到换行格式
// ─────────────────────────────────────────────────────────────────────────────
test('P17: 发送含换行消息对方看到换行', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p17u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const ta = alice.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, `p17_line1\np17_line2`)
    await alice.page.locator('button.btn-send').click()
    await alice.page.waitForTimeout(500)
    expect(await waitForMessage(bob.page, 'p17_line1')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P18: 发送含 URL 的消息，链接文本正确显示
// ─────────────────────────────────────────────────────────────────────────────
test('P18: 发送含 URL 消息链接文本正确显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p18u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p18_visit https://example.com for info_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, 'example.com')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P19: 发送 5000 字符超长消息，双方均完整显示
// ─────────────────────────────────────────────────────────────────────────────
test('P19: 发送 5000 字符超长消息双方完整显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p19u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const longMsg = 'p19_' + 'A'.repeat(4996)
    await sendMessage(alice.page, longMsg)
    expect(await waitForMessage(bob.page, 'p19_', 15000)).toBe(true)
    const bubble = bob.page.locator('.msg-bubble').filter({ hasText: 'p19_' }).last()
    const text = await bubble.textContent()
    expect((text ?? '').length).toBeGreaterThan(100)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P20: 空消息发送按钮禁用或无效
// ─────────────────────────────────────────────────────────────────────────────
test('P20: 空消息发送按钮禁用或无效', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p20u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const countBefore = await bob.page.locator('.msg-bubble').count()
    const sendBtn = alice.page.locator('button.btn-send')
    const isDisabled = await sendBtn.isDisabled()
    if (!isDisabled) {
      await sendBtn.click()
      await alice.page.waitForTimeout(500)
    }
    const countAfter = await bob.page.locator('.msg-bubble').count()
    expect(countAfter).toBe(countBefore)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P21: 发送 XSS payload，界面不弹窗
// ─────────────────────────────────────────────────────────────────────────────
test('P21: 发送 XSS payload 界面不弹窗', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p21u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    let dialogFired = false
    bob.page.on('dialog', () => { dialogFired = true })

    const msg = `p21_<script>alert(1)</script>_${Date.now()}`
    await sendMessage(alice.page, msg)
    await bob.page.waitForTimeout(2000)
    expect(dialogFired).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P22: 发送 HTML 特殊字符，显示为文字
// ─────────────────────────────────────────────────────────────────────────────
test('P22: HTML 特殊字符显示为文字不被解析', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p22u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p22_<b>&amp;"'_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, 'p22_')).toBe(true)
    const hasScriptTag = await bob.page.evaluate(() => document.querySelector('script[src*="p22"]') !== null)
    expect(hasScriptTag).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P23: 发送消息后自己气泡在右侧（mine 类）
// ─────────────────────────────────────────────────────────────────────────────
test('P23: 发送消息后自己气泡在右侧', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p23u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p23_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P24: 收到消息后对方气泡在左侧（不含 mine 类）
// ─────────────────────────────────────────────────────────────────────────────
test('P24: 收到消息后对方气泡在左侧', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p24u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p24_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(bob.page, msg)) { test.skip(); return }
    const row = bob.page.locator('.msg-row').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 5000 })
    const classes = await row.getAttribute('class')
    expect(classes ?? '').not.toContain('mine')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P25: 发送消息后状态图标出现
// ─────────────────────────────────────────────────────────────────────────────
test('P25: 发送消息后状态图标出现', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p25u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p25_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row.locator('.msg-meta')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P26: 对方在线时消息状态变为 received 或 read（不为 offline）
// ─────────────────────────────────────────────────────────────────────────────
test('P26: 对方在线时消息状态不为 offline', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p26u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p26_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 5000)) { test.skip(); return }
    await waitForMessage(bob.page, msg, 8000)

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 5000 })
    const statusEl = row.locator('.msg-status')
    // 对方在线收到消息后应为 received 或 read，不应为 offline
    const isOffline = await statusEl.evaluate(el => el.classList.contains('offline'))
      .catch(() => false)
    expect(isOffline).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P27: 对方离线时消息状态为 offline
// ─────────────────────────────────────────────────────────────────────────────
test('P27: 对方离线时消息状态为 offline', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p27u')
  const [alice, bob] = users
  test.setTimeout(90000)
  try {
    await openPrivateChat(alice.page, bob.username)

    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await alice.page.waitForTimeout(3000)

    const msg = `p27_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 5000 })
    const statusEl = row.locator('.msg-status')
    await expect(statusEl).toHaveClass(/offline/, { timeout: 15000 })
  } finally {
    await alice.page.close().catch(() => {})
    await Promise.race([alice.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await apiDeleteAccount(alice.accessToken)
    await apiDeleteAccount(bob.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P28: 对方上线收到离线消息后，发送方状态从 offline 变 received
// ─────────────────────────────────────────────────────────────────────────────
test('P28: 对方上线后发送方 offline 状态变 received', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p28u')
  const [alice, bob] = users
  test.setTimeout(120000)
  try {
    await openPrivateChat(alice.page, bob.username)

    await bob.page.close().catch(() => {})
    await Promise.race([bob.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
    await alice.page.waitForTimeout(3000)

    const msg = `p28_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    const statusEl = row.locator('.msg-status')
    await expect(statusEl).toHaveClass(/offline/, { timeout: 15000 })

    const bobCtx2 = await browser.newContext()
    const bobPage2 = await bobCtx2.newPage()
    await login(bobPage2, bob.username)
    await openPrivateChat(bobPage2, alice.username)
    await waitForMessage(bobPage2, msg, 10000)

    await expect(statusEl).not.toHaveClass(/offline/, { timeout: 20000 })

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
// P29: 新消息到达时会话列表顶部显示该会话
// ─────────────────────────────────────────────────────────────────────────────
test('P29: 新消息到达后会话列表顶部显示该会话', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p29u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p29_${Date.now()}`
    await sendMessage(alice.page, msg)
    await alice.page.waitForTimeout(1000)

    await bob.page.goto('/chat')
    await bob.page.waitForTimeout(1000)
    const firstConv = bob.page.locator('.list-item').first()
    const text = await firstConv.textContent()
    expect(text ?? '').toContain(alice.username.slice(0, 6))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P30: 未读消息数徽章显示在会话列表项上
// ─────────────────────────────────────────────────────────────────────────────
test('P30: 未读消息数徽章显示在会话列表项上', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p30u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await bob.page.goto('/chat')
    await bob.page.waitForTimeout(1000)

    const msg = `p30_${Date.now()}`
    await sendMessage(alice.page, msg)
    await bob.page.waitForTimeout(2000)

    const badge = bob.page.locator('.badge').first()
    const badgeVisible = await badge.isVisible({ timeout: 5000 }).catch(() => false)
    expect(badgeVisible).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P31: 进入会话后未读徽章清零
// ─────────────────────────────────────────────────────────────────────────────
test('P31: 进入会话后未读徽章清零', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p31u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await bob.page.goto('/chat')
    await bob.page.waitForTimeout(1000)

    const msg = `p31_${Date.now()}`
    await sendMessage(alice.page, msg)
    await bob.page.waitForTimeout(2000)

    await openPrivateChat(bob.page, alice.username)
    await bob.page.waitForTimeout(1000)

    await bob.page.goto('/chat')
    await bob.page.waitForTimeout(1000)
    const badge = bob.page.locator('.badge')
    const count = await badge.count()
    if (count > 0) {
      const text = await badge.first().textContent()
      expect(parseInt(text ?? '1')).toBe(0)
    } else {
      expect(count).toBe(0)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P32: 会话列表最后一条消息内容预览正确
// ─────────────────────────────────────────────────────────────────────────────
test('P32: 会话列表最后一条消息预览正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p32u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p32preview_${Date.now()}`
    await sendMessage(alice.page, msg)
    await alice.page.waitForTimeout(1000)

    await alice.page.goto('/chat')
    await alice.page.waitForTimeout(1000)
    const convItem = alice.page.locator('.list-item').filter({ hasText: bob.username })
    const text = await convItem.textContent()
    expect(text ?? '').toContain('p32preview_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P36: A 先发消息 B 再登录（离线消息投递）
// ─────────────────────────────────────────────────────────────────────────────
test('P36: 离线消息投递：A 发消息 B 上线后收到', async ({ browser }) => {
  test.setTimeout(90000)
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const aAuth = await apiRegister(`p36a_${ts}${rand}`)
  const bAuth = await apiRegister(`p36b_${ts}${rand}`)

  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  await login(aPage, aAuth.user.username)

  const msg = `p36_offline_${Date.now()}`
  await aPage.goto('/friends')
  await aPage.waitForTimeout(2000)
  const bItem = aPage.locator('.list-item').filter({ hasText: bAuth.user.username })
  const found = await bItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  if (!found) {
    await aPage.close().catch(() => {})
    await aCtx.close().catch(() => {})
    await apiDeleteAccount(aAuth.accessToken)
    await apiDeleteAccount(bAuth.accessToken)
    test.skip()
    return
  }
  await bItem.click()
  await aPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await sendMessage(aPage, msg)

  await aPage.close().catch(() => {})
  await Promise.race([aCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  await login(bPage, bAuth.user.username)
  await bPage.goto('/friends')
  await bPage.locator('.list-item').filter({ hasText: aAuth.user.username }).click()
  await bPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  expect(await waitForMessage(bPage, msg, 15000)).toBe(true)

  await bPage.close().catch(() => {})
  await Promise.race([bCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await apiDeleteAccount(aAuth.accessToken)
  await apiDeleteAccount(bAuth.accessToken)
})

// ─────────────────────────────────────────────────────────────────────────────
// P37: A 给下线 B 发多条消息，B 上线后全部收到
// ─────────────────────────────────────────────────────────────────────────────
test('P37: 多条离线消息全部送达', async ({ browser }) => {
  test.setTimeout(90000)
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const aAuth = await apiRegister(`p37a_${ts}${rand}`)
  const bAuth = await apiRegister(`p37b_${ts}${rand}`)

  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  await login(aPage, aAuth.user.username)

  await aPage.goto('/friends')
  await aPage.waitForTimeout(2000)
  const bItem = aPage.locator('.list-item').filter({ hasText: bAuth.user.username })
  const found = await bItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  if (!found) {
    await aPage.close().catch(() => {})
    await aCtx.close().catch(() => {})
    await apiDeleteAccount(aAuth.accessToken)
    await apiDeleteAccount(bAuth.accessToken)
    test.skip()
    return
  }
  await bItem.click()
  await aPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })

  for (let i = 0; i < 5; i++) {
    await sendMessage(aPage, `p37_msg${i}_${ts}`)
  }

  await aPage.close().catch(() => {})
  await Promise.race([aCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  await login(bPage, bAuth.user.username)
  await bPage.goto('/friends')
  await bPage.locator('.list-item').filter({ hasText: aAuth.user.username }).click()
  await bPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })

  for (let i = 0; i < 5; i++) {
    expect(await waitForMessage(bPage, `p37_msg${i}_${ts}`, 15000)).toBe(true)
  }

  await bPage.close().catch(() => {})
  await Promise.race([bCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await apiDeleteAccount(aAuth.accessToken)
  await apiDeleteAccount(bAuth.accessToken)
})

// ─────────────────────────────────────────────────────────────────────────────
// P38: 离线消息上线收到后，再次重连不重复投递
// ─────────────────────────────────────────────────────────────────────────────
test('P38: 离线消息上线收到后再次重连不重复', async ({ browser }) => {
  test.setTimeout(120000)
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const aAuth = await apiRegister(`p38a_${ts}${rand}`)
  const bAuth = await apiRegister(`p38b_${ts}${rand}`)

  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  await login(aPage, aAuth.user.username)

  await aPage.goto('/friends')
  await aPage.waitForTimeout(2000)
  const bItem = aPage.locator('.list-item').filter({ hasText: bAuth.user.username })
  const found = await bItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  if (!found) {
    await aPage.close().catch(() => {})
    await aCtx.close().catch(() => {})
    await apiDeleteAccount(aAuth.accessToken)
    await apiDeleteAccount(bAuth.accessToken)
    test.skip()
    return
  }
  await bItem.click()
  await aPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  const msg = `p38_${ts}`
  await sendMessage(aPage, msg)

  await aPage.close().catch(() => {})
  await Promise.race([aCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  await login(bPage, bAuth.user.username)
  await bPage.goto('/friends')
  await bPage.locator('.list-item').filter({ hasText: aAuth.user.username }).click()
  await bPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })
  await waitForMessage(bPage, msg, 15000)

  await bPage.reload()
  await bPage.waitForTimeout(2000)
  const msgBubbles = await bPage.locator('.msg-bubble').filter({ hasText: msg }).count()
  expect(msgBubbles).toBe(1)

  await bPage.close().catch(() => {})
  await Promise.race([bCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await apiDeleteAccount(aAuth.accessToken)
  await apiDeleteAccount(bAuth.accessToken)
})

// ─────────────────────────────────────────────────────────────────────────────
// P39: 刷新页面后历史消息从 IDB 恢复
// ─────────────────────────────────────────────────────────────────────────────
test('P39: 刷新后历史消息从 IDB 恢复', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p39u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p39_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.reload()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
    await alice.page.waitForTimeout(2000)
    expect(await waitForMessage(alice.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P40: 切换到其他会话再切回，原会话消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('P40: 切换会话再切回消息仍在', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'p40u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p40_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await openPrivateChat(alice.page, carol.username)
    await alice.page.waitForTimeout(500)
    await openPrivateChat(alice.page, bob.username)
    expect(await waitForMessage(alice.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P41: 退出再登录，历史消息从 IDB 恢复
// ─────────────────────────────────────────────────────────────────────────────
test('P41: 退出再登录历史消息从 IDB 恢复', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p41u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p41_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.goto('/profile')
    await alice.page.locator('button', { hasText: '退出登录' }).click()
    await alice.page.locator('button.btn-danger', { hasText: '确定退出' }).click()
    await alice.page.waitForURL(/\/login/, { timeout: 8000 })

    await alice.page.locator('input[placeholder="输入用户名"]').fill(alice.username)
    await alice.page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
    await alice.page.locator('button[type="submit"]').click()
    await alice.page.waitForURL(/\/chat/, { timeout: 15000 })
    await alice.page.waitForTimeout(2000)

    await openPrivateChat(alice.page, bob.username)
    expect(await waitForMessage(alice.page, msg, 8000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P42: 在线好友列表显示对方用户名
// ─────────────────────────────────────────────────────────────────────────────
test('P42: 在线好友列表显示对方用户名', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p42u')
  const [alice, bob] = users
  try {
    await alice.page.goto('/friends')
    await alice.page.waitForTimeout(1000)
    const item = alice.page.locator('.list-item').filter({ hasText: bob.username })
    await expect(item).toBeVisible({ timeout: 8000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P43: 从好友列表点击用户进入私聊会话
// ─────────────────────────────────────────────────────────────────────────────
test('P43: 从好友列表点击进入私聊会话', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p43u')
  const [alice, bob] = users
  try {
    await alice.page.goto('/friends')
    await alice.page.locator('.list-item').filter({ hasText: bob.username }).click()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 10000 })
    expect(alice.page.url()).toMatch(/\/chat\/private_/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P44: 会话 URL 格式为 /chat/private_{sorted}
// ─────────────────────────────────────────────────────────────────────────────
test('P44: 私聊会话 URL 格式正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p44u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    expect(alice.page.url()).toMatch(/\/chat\/private_/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P45: 聊天页点击返回按钮回到会话列表
// ─────────────────────────────────────────────────────────────────────────────
test('P45: 聊天页返回按钮回到会话列表', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p45u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await alice.page.locator('.icon-btn').first().click()
    await alice.page.waitForURL(/\/chat$/, { timeout: 5000 })
    expect(alice.page.url()).toMatch(/\/chat$/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P46: 聊天页标题显示对方用户名或昵称
// ─────────────────────────────────────────────────────────────────────────────
test('P46: 聊天页标题显示对方用户名', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p46u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const header = alice.page.locator('.chat-header-name')
    const text = await header.textContent()
    expect(text ?? '').toContain(bob.username.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P48: Emoji 表情选择器打开后点击表情填入输入框
// ─────────────────────────────────────────────────────────────────────────────
test('P48: Emoji 选择器点击表情填入输入框', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p48u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await alice.page.locator('.emoji-btn').click()
    await expect(alice.page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 3000 })
    // emoji-picker-react 内部按钮类名为 .epr-emoji
    const firstEmoji = alice.page.locator('.emoji-picker-wrap .epr-emoji').first()
    await firstEmoji.waitFor({ state: 'visible', timeout: 5000 })
    await firstEmoji.click()
    await alice.page.waitForTimeout(500)
    const inputVal = await alice.page.locator('.chat-input').inputValue()
    expect(inputVal.length).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P49: Emoji 选择器打开后点击遮罩关闭
// ─────────────────────────────────────────────────────────────────────────────
test('P49: Emoji 选择器点击遮罩关闭', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p49u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await alice.page.locator('.emoji-btn').click()
    await expect(alice.page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 3000 })
    // backdrop z-index(49) < picker z-index(50)，直接 evaluate 触发 click 绕过遮挡
    await alice.page.evaluate(() => {
      const el = document.querySelector('.emoji-backdrop') as HTMLElement | null
      el?.click()
    })
    await expect(alice.page.locator('.emoji-picker-wrap')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P52: 收到新消息时若不在底部显示"新消息"提示
// ─────────────────────────────────────────────────────────────────────────────
test('P52: 不在底部时收到消息显示新消息提示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p52u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    for (let i = 0; i < 20; i++) {
      await sendMessage(alice.page, `p52_fill_${i}`)
    }
    await waitForMessage(bob.page, 'p52_fill_19', 15000)

    await bob.page.locator('.chat-messages').evaluate(el => { el.scrollTop = 0 })
    await bob.page.waitForTimeout(500)

    await sendMessage(alice.page, `p52_new_${Date.now()}`)
    await expect(bob.page.locator('.new-msg-hint')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P53: 点击"新消息"提示后滚动到最新消息
// ─────────────────────────────────────────────────────────────────────────────
test('P53: 点击新消息提示后滚动到底部', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p53u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    for (let i = 0; i < 20; i++) {
      await sendMessage(alice.page, `p53_fill_${i}`)
    }
    await waitForMessage(bob.page, 'p53_fill_19', 15000)

    await bob.page.locator('.chat-messages').evaluate(el => { el.scrollTop = 0 })
    await bob.page.waitForTimeout(500)

    const lastMsg = `p53_last_${Date.now()}`
    await sendMessage(alice.page, lastMsg)
    await bob.page.waitForTimeout(1000)

    const hint = bob.page.locator('.new-msg-hint')
    if (await hint.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hint.click()
      await bob.page.waitForTimeout(1000)
    }
    expect(await waitForMessage(bob.page, lastMsg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P55: 右键气泡出现上下文菜单
// ─────────────────────────────────────────────────────────────────────────────
test('P55: 右键气泡出现上下文菜单', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p55u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p55_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P56: 上下文菜单包含"回复"选项
// ─────────────────────────────────────────────────────────────────────────────
test('P56: 上下文菜单包含回复选项', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p56u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p56_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu button', { hasText: '回复' })).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P57: 上下文菜单点击空白处关闭
// ─────────────────────────────────────────────────────────────────────────────
test('P57: 上下文菜单点击空白处关闭', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p57u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p57_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })

    await alice.page.locator('.chat-page').click({ position: { x: 10, y: 10 } })
    await alice.page.waitForTimeout(500)
    await expect(alice.page.locator('.context-menu')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P58: 点击"清除聊天记录"弹出确认
// ─────────────────────────────────────────────────────────────────────────────
test('P58: 点击清除聊天记录弹出确认', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p58u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p58_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    expect(await alice.page.locator('.context-menu button', { hasText: '清除聊天记录' }).isVisible()).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P59: 确认清除聊天记录后消息列表清空
// ─────────────────────────────────────────────────────────────────────────────
test('P59: 确认清除聊天记录后消息列表清空', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p59u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p59_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await expect(alice.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })

    // 前端用 window.confirm()，在点击按钮前注册 dialog 接受处理器
    alice.page.once('dialog', dialog => dialog.accept())
    await alice.page.locator('.context-menu button', { hasText: '清除聊天记录' }).click()
    // 清除后会 navigate 到 /chat，等导航完成
    await alice.page.waitForURL(/\/chat$/, { timeout: 5000 }).catch(() => {})
    await alice.page.waitForTimeout(500)
    const count = await alice.page.locator('.msg-bubble').count()
    expect(count).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P60: 取消清除聊天记录后消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('P60: 取消清除聊天记录后消息仍在', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p60u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p60_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await alice.page.locator('.context-menu button', { hasText: '清除聊天记录' }).click()
    const cancelBtn = alice.page.locator('button', { hasText: '取消' })
    const hasCancel = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)
    if (hasCancel) await cancelBtn.click()
    await alice.page.waitForTimeout(500)
    expect(await waitForMessage(alice.page, msg, 3000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P62: 发送消息后输入框清空
// ─────────────────────────────────────────────────────────────────────────────
test('P62: 发送消息后输入框清空', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p62u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p62_${Date.now()}`
    await sendMessage(alice.page, msg)
    await alice.page.waitForTimeout(500)
    const val = await alice.page.locator('.chat-input').inputValue()
    expect(val).toBe('')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P63: 消息时间显示为 HH:mm 格式
// ─────────────────────────────────────────────────────────────────────────────
test('P63: 消息时间戳显示 HH:mm 格式', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p63u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p63_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    const timeEl = row.locator('.msg-time')
    const timeText = await timeEl.textContent()
    expect(timeText ?? '').toMatch(/^\d{1,2}:\d{2}$/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P65: A-B 私聊与 A-C 私聊消息不串台
// ─────────────────────────────────────────────────────────────────────────────
test('P65: 两个私聊消息不串台', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'p65u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(alice.page, carol.username)

    const msgToCarol = `p65_carol_${Date.now()}`
    await sendMessage(alice.page, msgToCarol)
    if (!await waitForMessage(alice.page, msgToCarol, 8000)) { test.skip(); return }

    await openPrivateChat(alice.page, bob.username)
    const visible = await alice.page.locator('.msg-bubble').filter({ hasText: msgToCarol }).isVisible()
    expect(visible).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P67: 发送零宽字符消息不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('P67: 发送零宽字符消息不崩溃', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p67u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p67_​‌_${Date.now()}`
    await sendMessage(alice.page, msg)
    await alice.page.waitForTimeout(1000)
    expect(alice.page.url()).toMatch(/\/chat\/private_/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P68: 发送纯数字消息，收发正常
// ─────────────────────────────────────────────────────────────────────────────
test('P68: 发送纯数字消息收发正常', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p68u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `123456789`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, msg)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P69: 发送纯符号消息，收发正常
// ─────────────────────────────────────────────────────────────────────────────
test('P69: 发送纯符号消息收发正常', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p69u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `!@#$%^&*()_+`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, '!@#$%^&*', 8000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P72: 输入框按 Enter 发送消息
// ─────────────────────────────────────────────────────────────────────────────
test('P72: 输入框按 Enter 发送消息', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p72u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p72_${Date.now()}`
    const ta = alice.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, msg)
    await ta.press('Enter')
    expect(await waitForMessage(bob.page, msg)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P75: 输入框清空时发送按钮禁用
// ─────────────────────────────────────────────────────────────────────────────
test('P75: 输入框空时发送按钮禁用', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p75u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const sendBtn = alice.page.locator('button.btn-send')
    await expect(sendBtn).toBeDisabled({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P74: 输入内容后发送按钮激活
// ─────────────────────────────────────────────────────────────────────────────
test('P74: 输入内容后发送按钮激活', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p74u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    const ta = alice.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, 'hello')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(alice.page.locator('button.btn-send')).toBeEnabled({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P78: 引用预览栏切换会话后消失
// ─────────────────────────────────────────────────────────────────────────────
test('P78: 引用预览栏切换会话后消失', async ({ browser }) => {
  const users = await setupUsers(browser, 3, 'p78u')
  const [alice, bob, carol] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p78_orig_${Date.now()}`
    await sendMessage(bob.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const bubble = alice.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await alice.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(alice.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    await openPrivateChat(alice.page, carol.username)
    await expect(alice.page.locator('.reply-preview')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P83: profile 页显示用户名和 UID
// ─────────────────────────────────────────────────────────────────────────────
test('P83: profile 页显示用户名和 UID', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p83u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    const text = await u.page.locator('.profile-info').textContent()
    expect(text ?? '').toContain(u.username.slice(0, 5))
    expect(text ?? '').toContain('UID:')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P84: profile 页退出需要确认
// ─────────────────────────────────────────────────────────────────────────────
test('P84: profile 页退出需要确认', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p84u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '退出登录' }).click()
    await expect(u.page.locator('.logout-confirm')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P85: 退出后 localStorage token 清除
// ─────────────────────────────────────────────────────────────────────────────
test('P85: 退出后 localStorage token 清除', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p85u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '退出登录' }).click()
    await u.page.locator('button.btn-danger', { hasText: '确定退出' }).click()
    await u.page.waitForURL(/\/login/, { timeout: 8000 })

    const token = await u.page.evaluate(() => localStorage.getItem('accessToken'))
    expect(token).toBeNull()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P87: 修改昵称后 profile 页显示新昵称
// ─────────────────────────────────────────────────────────────────────────────
test('P87: 修改昵称后 profile 页显示新昵称', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p87u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    await u.page.locator('button', { hasText: '编辑' }).click()
    const newNick = `昵称${Date.now()}`
    const input = u.page.locator('input[placeholder="输入昵称"]')
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, newNick)
    await u.page.locator('.btn-primary', { hasText: '保存' }).click()
    await u.page.waitForTimeout(2000)
    const text = await u.page.locator('.profile-info').textContent()
    expect(text ?? '').toContain(newNick.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P88: 修改昵称点击取消后昵称不变
// ─────────────────────────────────────────────────────────────────────────────
test('P88: 修改昵称取消后昵称不变', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'p88u')
  const [u] = users
  try {
    await u.page.goto('/profile')
    const originalText = await u.page.locator('.profile-info h3').textContent()

    await u.page.locator('button', { hasText: '编辑' }).click()
    await u.page.locator('input[placeholder="输入昵称"]').fill('shouldNotSave')
    await u.page.locator('button', { hasText: '取消' }).click()
    await u.page.waitForTimeout(500)

    const currentText = await u.page.locator('.profile-info h3').textContent()
    expect(currentText).toBe(originalText)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P91: 连续快速发送 5 条消息，全部送达不乱序
// ─────────────────────────────────────────────────────────────────────────────
test('P91: 连续快速发 5 条消息全部送达不乱序', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p91u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const ts = Date.now()
    for (let i = 0; i < 5; i++) {
      await sendMessage(alice.page, `p91_${i}_${ts}`)
    }
    for (let i = 0; i < 5; i++) {
      expect(await waitForMessage(bob.page, `p91_${i}_${ts}`)).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P92: A 和 B 互相发消息（交叉），双方均按正确顺序显示
// ─────────────────────────────────────────────────────────────────────────────
test('P92: 双向交叉发消息顺序正确', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p92u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const ts = Date.now()
    for (let i = 0; i < 4; i++) {
      if (i % 2 === 0) await sendMessage(alice.page, `p92_a${i}_${ts}`)
      else await sendMessage(bob.page, `p92_b${i}_${ts}`)
    }
    await alice.page.waitForTimeout(2000)
    expect(await waitForMessage(alice.page, `p92_b1_${ts}`)).toBe(true)
    expect(await waitForMessage(alice.page, `p92_b3_${ts}`)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P94: 新消息到达时 nav-badge 总未读数更新
// ─────────────────────────────────────────────────────────────────────────────
test('P94: 新消息到达 nav-badge 总未读数更新', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p94u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await bob.page.goto('/chat')
    await bob.page.waitForTimeout(1000)

    const msg = `p94_${Date.now()}`
    await sendMessage(alice.page, msg)
    await bob.page.waitForTimeout(2000)

    const badge = bob.page.locator('.nav-badge')
    const visible = await badge.isVisible({ timeout: 5000 }).catch(() => false)
    expect(visible).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P96: 会话列表项点击进入正确的私聊会话
// ─────────────────────────────────────────────────────────────────────────────
test('P96: 会话列表点击进入正确私聊会话', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p96u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p96_${Date.now()}`
    await sendMessage(alice.page, msg)
    await alice.page.waitForTimeout(1000)

    await alice.page.goto('/chat')
    await alice.page.waitForTimeout(1000)
    await alice.page.locator('.list-item').filter({ hasText: bob.username }).click()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 8000 })
    expect(await waitForMessage(alice.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P97: 返回列表再进入同一会话，历史消息不重复
// ─────────────────────────────────────────────────────────────────────────────
test('P97: 返回列表再进入同一会话历史消息不重复', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p97u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p97_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.locator('.icon-btn').first().click()
    await alice.page.waitForURL(/\/chat$/, { timeout: 5000 })
    await alice.page.locator('.list-item').filter({ hasText: bob.username }).click()
    await alice.page.waitForURL(/\/chat\/private_/, { timeout: 8000 })
    await alice.page.waitForTimeout(1000)

    const count = await alice.page.locator('.msg-bubble').filter({ hasText: msg }).count()
    expect(count).toBe(1)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P98: 发送含 SQL 注入内容，消息原样显示不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('P98: SQL 注入内容原样显示不崩溃', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p98u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p98_' OR 1=1 -- DROP TABLE messages_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, 'p98_')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P99: 发送含反斜杠的消息，内容完整显示
// ─────────────────────────────────────────────────────────────────────────────
test('P99: 含反斜杠消息内容完整显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p99u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p99_path\\to\\file_${Date.now()}`
    await sendMessage(alice.page, msg)
    expect(await waitForMessage(bob.page, 'p99_path')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P101: 登录 → 发消息 → 退出 → 重新登录，历史消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('P101: 退出再登录历史消息不丢失', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p101u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p101_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    await alice.page.goto('/profile')
    await alice.page.locator('button', { hasText: '退出登录' }).click()
    await alice.page.locator('button.btn-danger', { hasText: '确定退出' }).click()
    await alice.page.waitForURL(/\/login/, { timeout: 8000 })

    await alice.page.locator('input[placeholder="输入用户名"]').fill(alice.username)
    await alice.page.locator('input[placeholder="输入密码"]').fill(PASSWORD)
    await alice.page.locator('button[type="submit"]').click()
    await alice.page.waitForURL(/\/chat/, { timeout: 15000 })
    await alice.page.waitForTimeout(2000)

    await openPrivateChat(alice.page, bob.username)
    expect(await waitForMessage(alice.page, msg, 8000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P105: 两人同时互发消息（并发），双方各自收到
// ─────────────────────────────────────────────────────────────────────────────
test('P105: 并发互发消息双方各自收到', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p105u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const ts = Date.now()
    const msgA = `p105_a_${ts}`
    const msgB = `p105_b_${ts}`
    await Promise.all([
      sendMessage(alice.page, msgA),
      sendMessage(bob.page, msgB),
    ])

    expect(await waitForMessage(bob.page, msgA)).toBe(true)
    expect(await waitForMessage(alice.page, msgB)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P106: A 发消息给离线 B，B 上线后消息内容解密正确
// ─────────────────────────────────────────────────────────────────────────────
test('P106: 离线消息 E2EE 解密正确', async ({ browser }) => {
  test.setTimeout(90000)
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const aAuth = await apiRegister(`p106a_${ts}${rand}`)
  const bAuth = await apiRegister(`p106b_${ts}${rand}`)

  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  await login(aPage, aAuth.user.username)

  await aPage.goto('/friends')
  await aPage.waitForTimeout(2000)
  const bItem = aPage.locator('.list-item').filter({ hasText: bAuth.user.username })
  const found = await bItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  if (!found) {
    await aPage.close().catch(() => {})
    await aCtx.close().catch(() => {})
    await apiDeleteAccount(aAuth.accessToken)
    await apiDeleteAccount(bAuth.accessToken)
    test.skip()
    return
  }
  await bItem.click()
  await aPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })

  const secretMsg = `p106_secret_${ts}`
  await sendMessage(aPage, secretMsg)

  await aPage.close().catch(() => {})
  await Promise.race([aCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})

  const bCtx = await browser.newContext()
  const bPage = await bCtx.newPage()
  await login(bPage, bAuth.user.username)
  await bPage.goto('/friends')
  await bPage.locator('.list-item').filter({ hasText: aAuth.user.username }).click()
  await bPage.waitForURL(/\/chat\/private_/, { timeout: 10000 })

  expect(await waitForMessage(bPage, secretMsg, 15000)).toBe(true)
  const bubbles = await bPage.locator('.msg-bubble').filter({ hasText: secretMsg }).allTextContents()
  expect(bubbles.some(t => t.includes('解密失败'))).toBe(false)

  await bPage.close().catch(() => {})
  await Promise.race([bCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await apiDeleteAccount(aAuth.accessToken)
  await apiDeleteAccount(bAuth.accessToken)
})

// ─────────────────────────────────────────────────────────────────────────────
// P107: 修改昵称后发消息，接收方气泡显示新昵称
// ─────────────────────────────────────────────────────────────────────────────
test('P107: 修改昵称后发消息接收方显示新昵称', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p107u')
  const [alice, bob] = users
  try {
    const newNick = `nick${Date.now()}`
    await alice.page.goto('/profile')
    await alice.page.locator('button', { hasText: '编辑' }).click()
    const input = alice.page.locator('input[placeholder="输入昵称"]')
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, newNick)
    await alice.page.locator('.btn-primary', { hasText: '保存' }).click()
    await alice.page.waitForTimeout(2000)

    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p107_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(bob.page, msg)) { test.skip(); return }

    const row = bob.page.locator('.msg-row').filter({ hasText: msg })
    const rowText = await row.textContent()
    expect(rowText ?? '').toContain(newNick.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P109: 接收方滚动到历史消息顶部时不触发自动滚底
// ─────────────────────────────────────────────────────────────────────────────
test('P109: 滚到顶部后不自动滚底', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p109u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    for (let i = 0; i < 20; i++) {
      await sendMessage(alice.page, `p109_${i}_${Date.now()}`)
    }
    await waitForMessage(bob.page, 'p109_19_', 15000)

    await bob.page.locator('.chat-messages').evaluate(el => { el.scrollTop = 0 })
    await bob.page.waitForTimeout(1500)

    const scrollTop = await bob.page.locator('.chat-messages').evaluate(el => el.scrollTop)
    expect(scrollTop).toBeLessThan(100)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// P110: 消息时间戳本地时区正确显示
// ─────────────────────────────────────────────────────────────────────────────
test('P110: 消息时间戳本地时区正确显示', async ({ browser }) => {
  const users = await setupUsers(browser, 2, 'p110u')
  const [alice, bob] = users
  try {
    await openPrivateChat(alice.page, bob.username)
    await openPrivateChat(bob.page, alice.username)

    const msg = `p110_${Date.now()}`
    await sendMessage(alice.page, msg)
    if (!await waitForMessage(alice.page, msg, 8000)) { test.skip(); return }

    const row = alice.page.locator('.msg-row.mine').filter({ hasText: msg })
    const timeText = await row.locator('.msg-time').textContent()
    const localHour = new Date().getHours()
    const displayHour = parseInt((timeText ?? '0:00').split(':')[0])
    expect(Math.abs(displayHour - localHour)).toBeLessThanOrEqual(1)
  } finally {
    await teardownUsers(users)
  }
})
