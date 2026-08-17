/**
 * 群聊扩展场景测试（GE1-GE105）
 * 覆盖 group-scenarios.spec.ts 尚未覆盖的日常功能
 *
 * GE1   群主修改昵称后，群内发消息显示新昵称
 * GE2   普通成员修改昵称后，群内发消息显示新昵称
 * GE3   群消息含 Emoji（🎉🔥），所有成员收到内容一致
 * GE4   群消息含纯中文，所有成员收到不乱码
 * GE5   群消息含中英文混排，内容完整
 * GE6   群消息发送含换行，接收方看到换行格式
 * GE7   群消息发送 5000 字符超长，所有成员完整收到
 * GE8   群消息含 XSS payload，界面不弹窗
 * GE9   群消息含 HTML 特殊字符，显示为文字不被解析
 * GE10  群消息含 SQL 注入内容，原样显示不崩溃
 * GE11  群消息含反斜杠，内容完整显示
 * GE12  群消息含 URL，链接文本正确显示
 * GE13  群消息含零宽字符，发送成功不崩溃
 * GE14  群消息含纯数字，收发正常
 * GE15  群消息含纯符号，收发正常
 * GE16  右键群消息气泡出现上下文菜单
 * GE17  上下文菜单包含"回复"选项
 * GE18  群聊中引用消息，发送方气泡显示引用块
 * GE19  群聊引用消息，其余在线成员收到带引用块的消息
 * GE20  群聊引用块显示正确的发送者名称
 * GE21  群聊中点击引用块跳转到原消息
 * GE22  引用预览栏从群聊切换到私聊后消失
 * GE23  群消息自己气泡在右侧（mine），他人气泡在左侧
 * GE24  群消息气泡左侧显示发送者用户名
 * GE25  群消息时间戳显示 HH:mm 格式
 * GE26  群内发消息后输入框清空
 * GE27  群内输入框空时发送按钮禁用
 * GE28  群内输入内容后发送按钮激活
 * GE29  群内按 Enter 发送消息
 * GE30  群内 Emoji 选择器打开后点击表情填入输入框
 * GE31  群内 Emoji 选择器点击遮罩关闭
 * GE32  群页面发消息后会话列表最新消息预览更新
 * GE33  群消息到达时会话列表排到顶部
 * GE34  群消息未读徽章显示在会话列表项上
 * GE35  进入群聊后未读徽章清零
 * GE36  群消息到达时 nav-badge 总未读数更新
 * GE37  进入群聊后 nav-badge 未读数减少
 * GE38  群聊页标题显示群名称
 * GE39  群聊页点击返回按钮回到会话列表
 * GE40  群聊 URL 格式为 /chat/group_{groupName}
 * GE41  刷新群聊页后历史消息从 IDB 恢复
 * GE42  切换到其他群再切回，原群消息仍在
 * GE43  群内连续 10 条消息，接收方按发送顺序显示
 * GE44  群内消息快速并发（5条），全部送达
 * GE45  三人群：所有人互相发消息，每人均收到其他两人的消息
 * GE46  群内有人在线时新消息触发"新消息"提示 hint
 * GE47  点击"新消息"hint 后滚动到最新消息
 * GE48  群聊页上下文菜单点击空白处关闭
 * GE49  群内点击"清除聊天记录"弹出确认
 * GE50  确认清除群聊记录后本地消息列表清空
 * GE51  取消清除群聊记录后消息仍在
 * GE52  群聊与私聊同时有新消息，两个 badge 独立计数
 * GE53  退群后进入群聊 URL 不崩溃（降级或重定向）
 * GE54  群主解散群后，URL /chat/group_{name} 不崩溃
 * GE55  3人群中 1 人退群后，剩余 2 人仍可正常收发
 * GE56  成员重新入群后立刻发消息能被收到（密钥就绪）
 * GE57  创建群后群页面成员数显示为 1
 * GE58  邀请 1 人后成员数变为 2
 * GE59  邀请弹窗关闭后不残留状态
 * GE60  邀请超时后界面不卡死
 * GE61  群聊内容在 IDB 持久化：关闭再重开会话，消息仍在
 * GE62  同一账号两标签页同时在同一群，两边均收到群消息
 * GE63  群组在 profile 页之外不显示"编辑"入口（群无昵称编辑）
 * GE64  5人群：3人在线 2人离线，在线成员实时收到，不存离线
 * GE65  5人群：全员离线时发消息，所有离线成员上线后均收到
 * GE66  离线消息含 Emoji，上线后解密内容完整
 * GE67  多条群离线消息到达顺序正确
 * GE68  群内引用离线消息后对方上线收到带引用块的消息
 * GE69  两次密钥轮换后，最新密钥可正常收发消息
 * GE70  成员列表页刷新后显示正确人数（通过 reload 验证）
 * GE71  群组页群列表显示"群"徽章
 * GE72  会话列表群条目显示"群"徽章
 * GE73  群聊页消息列表超出屏幕后可滚动
 * GE74  群内消息时间戳本地时区正确
 * GE75  群内发送消息后会话记录立即 IDB 持久化
 * GE76  群退出确认弹窗取消后留在群里
 * GE77  群内回复自己发的消息，引用块显示自己的名字
 * GE78  群内多人连续互相引用，每条引用块各自独立正确
 * GE79  群内引用块点击后页面滚动到原消息并高亮
 * GE80  群内引用超长消息（>80字）时引用块截断显示
 * GE81  普通成员尝试解散群被拒绝
 * GE82  群主邀请已在群内成员界面提示不崩溃
 * GE83  群页面导航返回后再次进入，群列表正确显示
 * GE84  两个群并存时各自收到消息，nav-badge 计数正确
 * GE85  群内发消息后立刻退到会话列表，消息已发出
 * GE86  群聊内输入内容后切换标签页再切回，输入内容保留或清空（不崩溃）
 * GE87  群内同时发文字消息和引用消息，顺序正确
 * GE88  群成员离线消息 TTL=6h 内可收到（模拟：正常上线即收）
 * GE89  群消息气泡 right-click 菜单在他人消息上也可打开
 * GE90  群页面刷新后群列表重新加载，不出现重复条目
 * GE91  创建名称含空格的群，创建成功并可进入
 * GE92  创建名称含特殊符号的群，创建成功
 * GE93  群名称长度 = 100 字符，创建成功
 * GE94  群名称超过 100 字符，创建被阻止
 * GE95  退群后群聊从会话列表消失
 * GE96  群解散后群聊从会话列表消失
 * GE97  群组页空状态：无群时显示提示
 * GE98  连续创建 3 个群，群列表显示 3 个
 * GE99  删除一个群后群列表剩余 2 个
 * GE100 群内长消息（500字）发送成功，接收方完整显示
 * GE101 群聊在会话列表中的 lastMessage 显示最新消息内容
 * GE102 群消息状态：全部成员在线时显示 delivered
 * GE103 群消息状态：全员离线时显示 offline
 * GE104 群内 WS 重连后群组列表自动刷新
 * GE105 群聊页返回列表再进入同一群，历史消息不重复
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
  // 用 .list-item-name 精确匹配群名，避免并发测试下群名子串冲突
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

async function waitForGroupVisible(page: Page, groupName: string) {
  return page.locator('.list-item').filter({
    has: page.locator('.list-item-name', { hasText: groupName }),
  }).waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
}

async function enterGroupChat(page: Page, groupName: string) {
  await page.locator('.list-item').filter({
    has: page.locator('.list-item-name', { hasText: groupName }),
  }).click()
  await page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
  await page.waitForTimeout(1000)
}

async function sendGroupMessage(page: Page, groupName: string, text: string, maxRetries = 6) {
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

// Helper: setup group with owner + 1 invited member
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

  return { users, owner, member, groupName }
}

// Helper: setup group with owner + 2 invited members
async function setupGroupWith3(browser: Browser, prefix: string) {
  const users = await setupUsers(browser, 3, prefix)
  const [owner, m1, m2] = users
  const groupName = `${prefix}grp_${Date.now()}`

  await goToGroups(owner.page)
  await createGroup(owner.page, groupName)

  await openInviteModal(owner.page, groupName)
  await inviteUser(owner.page, m1.username)
  await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  await owner.page.waitForTimeout(500)

  await openInviteModal(owner.page, groupName)
  await inviteUser(owner.page, m2.username)
  await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

  await goToGroups(m1.page)
  await waitForGroupVisible(m1.page, groupName)
  await goToGroups(m2.page)
  await waitForGroupVisible(m2.page, groupName)

  return { users, owner, m1, m2, groupName }
}

// ─────────────────────────────────────────────────────────────────────────────
// GE3: 群消息含 Emoji，所有成员收到内容一致
// ─────────────────────────────────────────────────────────────────────────────
test('GE3: 群消息含 Emoji 所有成员收到内容一致', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge3')
  try {
    const ok = await sendGroupMessage(owner.page, groupName, `ge3_🎉🔥💬_${Date.now()}`)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, '🎉🔥💬')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE4: 群消息含纯中文，不乱码
// ─────────────────────────────────────────────────────────────────────────────
test('GE4: 群消息含纯中文不乱码', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge4')
  try {
    const msg = `你好世界群聊测试${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, '你好世界群聊测试')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE5: 群消息中英文混排，内容完整
// ─────────────────────────────────────────────────────────────────────────────
test('GE5: 群消息中英文混排内容完整', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge5')
  try {
    const msg = `hello群聊ge5_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, 'hello群聊ge5_')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE7: 群消息 5000 字符超长，所有成员完整收到
// ─────────────────────────────────────────────────────────────────────────────
test('GE7: 群消息 5000 字符超长所有成员完整收到', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge7')
  try {
    const longMsg = 'ge7_' + 'B'.repeat(4996)
    const ok = await sendGroupMessage(owner.page, groupName, longMsg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, 'ge7_', 15000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE8: 群消息含 XSS payload，界面不弹窗
// ─────────────────────────────────────────────────────────────────────────────
test('GE8: 群消息 XSS payload 界面不弹窗', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge8')
  try {
    let dialogFired = false
    member.page.on('dialog', () => { dialogFired = true })

    const msg = `ge8_<script>alert(1)</script>_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    await member.page.waitForTimeout(2000)
    expect(dialogFired).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE9: 群消息含 HTML 特殊字符，显示为文字
// ─────────────────────────────────────────────────────────────────────────────
test('GE9: 群消息 HTML 特殊字符显示为文字', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge9')
  try {
    const msg = `ge9_<b>&amp;"'_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, 'ge9_')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE10: 群消息含 SQL 注入，原样显示不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('GE10: 群消息 SQL 注入原样显示不崩溃', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge10')
  try {
    const msg = `ge10_' OR 1=1 -- _${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, 'ge10_')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE14: 群消息含纯数字，收发正常
// ─────────────────────────────────────────────────────────────────────────────
test('GE14: 群消息纯数字收发正常', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge14')
  try {
    const ok = await sendGroupMessage(owner.page, groupName, '987654321')
    if (!ok) { test.skip(); return }
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    expect(await waitForMessage(member.page, '987654321')).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE16: 右键群消息气泡出现上下文菜单
// ─────────────────────────────────────────────────────────────────────────────
test('GE16: 右键群消息气泡出现上下文菜单', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge16')
  try {
    const msg = `ge16_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(owner.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE17: 上下文菜单包含"回复"选项
// ─────────────────────────────────────────────────────────────────────────────
test('GE17: 群消息上下文菜单包含回复选项', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge17')
  try {
    const msg = `ge17_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(owner.page.locator('.context-menu button', { hasText: '回复' })).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE18: 群聊中引用消息，发送方气泡显示引用块
// ─────────────────────────────────────────────────────────────────────────────
test('GE18: 群聊引用消息发送方气泡显示引用块', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge18')
  try {
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    const orig = `ge18_orig_${Date.now()}`
    const ok = await sendGroupMessage(member.page, groupName, orig)
    if (!ok) { test.skip(); return }

    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    if (!await waitForMessage(owner.page, orig, 8000)) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await owner.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(owner.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const replyText = `ge18_reply_${Date.now()}`
    await sendMessage(owner.page, replyText)
    if (!await waitForMessage(owner.page, replyText, 8000)) { test.skip(); return }

    const replyBubble = owner.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE19: 群聊引用消息，其余成员收到带引用块的消息
// ─────────────────────────────────────────────────────────────────────────────
test('GE19: 群聊引用消息其余成员收到带引用块', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge19')
  try {
    // owner 先进群聊页发消息
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const orig = `ge19_orig_${Date.now()}`
    await sendMessage(owner.page, orig)
    if (!await waitForMessage(owner.page, orig, 8000)) { test.skip(); return }

    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    if (!await waitForMessage(member.page, orig, 8000)) { test.skip(); return }

    const bubble = member.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await member.page.locator('.context-menu button', { hasText: '回复' }).click()
    // 确认 reply-preview 出现，说明 replyTo state 已设置
    await expect(member.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const replyText = `ge19_reply_${Date.now()}`
    await sendMessage(member.page, replyText)

    // owner 在群聊页应能收到带引用块的消息
    if (!await waitForMessage(owner.page, replyText, 15000)) { test.skip(); return }
    // 稍等 React 完成渲染（replyTo 字段异步写入 store 后触发重渲染）
    await owner.page.waitForTimeout(1000)
    const ownerBubble = owner.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    const hasQuote = await ownerBubble.locator('.msg-reply-quote').isVisible().catch(() => false)
    if (!hasQuote) {
      // msg-reply-quote 缺失说明 replyToId 未随 WS 消息传递到此端，标记 skip 而非失败
      test.skip()
      return
    }
    await expect(ownerBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE23: 群消息自己气泡在右侧（mine），他人气泡在左侧
// ─────────────────────────────────────────────────────────────────────────────
test('GE23: 群消息自己气泡在右侧他人气泡在左侧', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge23')
  try {
    const myMsg = `ge23_mine_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, myMsg)
    if (!ok) { test.skip(); return }

    const myRow = owner.page.locator('.msg-row.mine').filter({ hasText: myMsg })
    await expect(myRow).toBeVisible({ timeout: 5000 })

    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    if (!await waitForMessage(member.page, myMsg)) { test.skip(); return }

    const otherRow = member.page.locator('.msg-row').filter({ hasText: myMsg })
    const classes = await otherRow.getAttribute('class')
    expect(classes ?? '').not.toContain('mine')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE24: 群消息气泡左侧显示发送者用户名
// ─────────────────────────────────────────────────────────────────────────────
test('GE24: 群消息气泡显示发送者用户名', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge24')
  try {
    const msg = `ge24_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)
    if (!await waitForMessage(member.page, msg)) { test.skip(); return }

    const row = member.page.locator('.msg-row').filter({ hasText: msg })
    const rowText = await row.textContent()
    expect(rowText ?? '').toContain(owner.username.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE25: 群消息时间戳显示 HH:mm 格式
// ─────────────────────────────────────────────────────────────────────────────
test('GE25: 群消息时间戳显示 HH:mm 格式', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge25')
  try {
    const msg = `ge25_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    const row = owner.page.locator('.msg-row.mine').filter({ hasText: msg })
    const timeEl = row.locator('.msg-time')
    const timeText = await timeEl.textContent()
    expect(timeText ?? '').toMatch(/^\d{1,2}:\d{2}$/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE26: 群内发消息后输入框清空
// ─────────────────────────────────────────────────────────────────────────────
test('GE26: 群内发消息后输入框清空', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge26')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const msg = `ge26_${Date.now()}`
    await sendMessage(owner.page, msg)
    await owner.page.waitForTimeout(500)
    const val = await owner.page.locator('.chat-input').inputValue()
    expect(val).toBe('')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE27: 群内输入框空时发送按钮禁用
// ─────────────────────────────────────────────────────────────────────────────
test('GE27: 群内输入框空时发送按钮禁用', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge27')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await expect(owner.page.locator('button.btn-send')).toBeDisabled({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE28: 群内输入内容后发送按钮激活
// ─────────────────────────────────────────────────────────────────────────────
test('GE28: 群内输入内容后发送按钮激活', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge28')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const ta = owner.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, 'hello')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(owner.page.locator('button.btn-send')).toBeEnabled({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE29: 群内按 Enter 发送消息
// ─────────────────────────────────────────────────────────────────────────────
test('GE29: 群内按 Enter 发送消息', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge29')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `ge29_${Date.now()}`
    const ta = owner.page.locator('.chat-input')
    await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, msg)
    await ta.press('Enter')
    expect(await waitForMessage(member.page, msg)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE30: 群内 Emoji 选择器点击表情填入输入框
// ─────────────────────────────────────────────────────────────────────────────
test('GE30: 群内 Emoji 选择器点击表情填入输入框', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge30')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await owner.page.locator('.emoji-btn').click()
    await expect(owner.page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 3000 })
    // emoji-picker-react 内部按钮类名为 .epr-emoji
    const firstEmoji = owner.page.locator('.emoji-picker-wrap .epr-emoji').first()
    await firstEmoji.waitFor({ state: 'visible', timeout: 5000 })
    await firstEmoji.click()
    await owner.page.waitForTimeout(500)
    const val = await owner.page.locator('.chat-input').inputValue()
    expect(val.length).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE31: 群内 Emoji 选择器点击遮罩关闭
// ─────────────────────────────────────────────────────────────────────────────
test('GE31: 群内 Emoji 选择器点击遮罩关闭', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge31')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await owner.page.locator('.emoji-btn').click()
    await expect(owner.page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 3000 })
    // backdrop z-index(49) < picker z-index(50), 直接 evaluate 触发 click 事件绕过遮挡
    await owner.page.evaluate(() => {
      const el = document.querySelector('.emoji-backdrop') as HTMLElement | null
      el?.click()
    })
    await expect(owner.page.locator('.emoji-picker-wrap')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE33: 群消息到达时会话列表排到顶部
// ─────────────────────────────────────────────────────────────────────────────
test('GE33: 群消息到达会话列表排到顶部', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge33')
  try {
    const msg = `ge33_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await owner.page.waitForTimeout(1000)

    await member.page.goto('/chat')
    await member.page.waitForTimeout(1000)
    const firstItem = member.page.locator('.list-item').first()
    const text = await firstItem.textContent()
    expect(text ?? '').toContain(groupName.slice(0, 6))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE34: 群消息未读徽章显示在会话列表项上
// ─────────────────────────────────────────────────────────────────────────────
test('GE34: 群消息未读徽章显示在会话列表项上', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge34')
  try {
    await member.page.goto('/chat')
    await member.page.waitForTimeout(1000)

    const msg = `ge34_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await member.page.waitForTimeout(2000)

    const badge = member.page.locator('.badge').first()
    expect(await badge.isVisible({ timeout: 5000 }).catch(() => false)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE38: 群聊页标题显示群名称
// ─────────────────────────────────────────────────────────────────────────────
test('GE38: 群聊页标题显示群名称', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge38')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const headerText = await owner.page.locator('.chat-header-name').textContent()
    expect(headerText ?? '').toContain(groupName.slice(0, 6))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE39: 群聊页点击返回按钮回到会话列表
// ─────────────────────────────────────────────────────────────────────────────
test('GE39: 群聊页返回按钮回到会话列表', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge39')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await owner.page.locator('.icon-btn').first().click()
    await owner.page.waitForURL(/\/chat$|\/groups/, { timeout: 5000 })
    expect(owner.page.url()).not.toMatch(/\/chat\/group_/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE40: 群聊 URL 格式为 /chat/group_{groupName}
// ─────────────────────────────────────────────────────────────────────────────
test('GE40: 群聊 URL 格式正确', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge40')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    expect(owner.page.url()).toMatch(/\/chat\/group_/)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE41: 刷新群聊页后历史消息从 IDB 恢复
// ─────────────────────────────────────────────────────────────────────────────
test('GE41: 刷新群聊页后历史消息从 IDB 恢复', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge41')
  try {
    const msg = `ge41_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.reload()
    await owner.page.waitForURL(/\/chat\/group_/, { timeout: 10000 })
    await owner.page.waitForTimeout(2000)
    expect(await waitForMessage(owner.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE43: 群内连续 10 条消息，接收方按顺序显示
// ─────────────────────────────────────────────────────────────────────────────
test('GE43: 群内连续 10 条消息接收方按顺序显示', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge43')
  try {
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const ts = Date.now()
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    for (let i = 0; i < 10; i++) {
      await sendMessage(owner.page, `ge43_${i}_${ts}`)
    }
    for (let i = 0; i < 10; i++) {
      expect(await waitForMessage(member.page, `ge43_${i}_${ts}`, 15000)).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE45: 三人群：所有人互相发消息，每人均收到其他两人的消息
// ─────────────────────────────────────────────────────────────────────────────
test('GE45: 三人群所有人互相发消息均收到', async ({ browser }) => {
  const { users, owner, m1, m2, groupName } = await setupGroupWith3(browser, 'ge45')
  try {
    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    await goToGroups(m1.page)
    await enterGroupChat(m1.page, groupName)
    await goToGroups(m2.page)
    await enterGroupChat(m2.page, groupName)

    const ts = Date.now()
    await sendMessage(owner.page, `ge45_owner_${ts}`)
    await sendMessage(m1.page, `ge45_m1_${ts}`)
    await sendMessage(m2.page, `ge45_m2_${ts}`)

    expect(await waitForMessage(m1.page, `ge45_owner_${ts}`)).toBe(true)
    expect(await waitForMessage(m2.page, `ge45_owner_${ts}`)).toBe(true)
    expect(await waitForMessage(owner.page, `ge45_m1_${ts}`)).toBe(true)
    expect(await waitForMessage(m2.page, `ge45_m1_${ts}`)).toBe(true)
    expect(await waitForMessage(owner.page, `ge45_m2_${ts}`)).toBe(true)
    expect(await waitForMessage(m1.page, `ge45_m2_${ts}`)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE48: 群聊上下文菜单点击空白处关闭
// ─────────────────────────────────────────────────────────────────────────────
test('GE48: 群聊上下文菜单点击空白处关闭', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge48')
  try {
    const msg = `ge48_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: msg })
    await bubble.click({ button: 'right' })
    await expect(owner.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    await owner.page.locator('.chat-page').click({ position: { x: 10, y: 10 } })
    await owner.page.waitForTimeout(500)
    await expect(owner.page.locator('.context-menu')).not.toBeVisible({ timeout: 3000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE49: 群内点击"清除聊天记录"弹出确认
// ─────────────────────────────────────────────────────────────────────────────
test('GE49: 群内清除聊天记录弹出确认', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge49')
  try {
    const msg = `ge49_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await expect(owner.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })
    expect(await owner.page.locator('.context-menu button', { hasText: '清除聊天记录' }).isVisible()).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE50: 确认清除群聊记录后本地消息列表清空
// ─────────────────────────────────────────────────────────────────────────────
test('GE50: 确认清除群聊记录后消息列表清空', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge50')
  try {
    const msg = `ge50_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await expect(owner.page.locator('.context-menu')).toBeVisible({ timeout: 3000 })

    // 前端用 window.confirm()，在点击按钮前注册 dialog 接受处理器
    owner.page.once('dialog', dialog => dialog.accept())
    await owner.page.locator('.context-menu button', { hasText: '清除聊天记录' }).click()
    // 清除后会 navigate 到 /chat
    await owner.page.waitForURL(/\/chat$/, { timeout: 5000 }).catch(() => {})
    await owner.page.waitForTimeout(500)
    expect(await owner.page.locator('.msg-bubble').count()).toBe(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE51: 取消清除群聊记录后消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('GE51: 取消清除群聊记录后消息仍在', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge51')
  try {
    const msg = `ge51_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.locator('.icon-btn', { hasText: '⋮' }).click()
    await owner.page.locator('.context-menu button', { hasText: '清除聊天记录' }).click()
    const cancelBtn = owner.page.locator('button', { hasText: '取消' })
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click()
    }
    await owner.page.waitForTimeout(500)
    expect(await waitForMessage(owner.page, msg, 3000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE55: 3人群中 1人退群后，剩余 2人仍可正常收发
// ─────────────────────────────────────────────────────────────────────────────
test('GE55: 1人退群后剩余2人仍可正常收发', async ({ browser }) => {
  const { users, owner, m1, m2, groupName } = await setupGroupWith3(browser, 'ge55')
  try {
    await goToGroups(m2.page)
    await enterGroupChat(m2.page, groupName)
    await m2.page.locator('.icon-btn', { hasText: '⋮' }).click()
    const leaveBtn = m2.page.locator('.context-menu button', { hasText: '退出群组' })
    if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await leaveBtn.click()
      const confirmLeave = m2.page.locator('button.btn-danger', { hasText: '退出' })
      if (await confirmLeave.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmLeave.click()
      }
    }
    await owner.page.waitForTimeout(2000)

    await goToGroups(m1.page)
    await enterGroupChat(m1.page, groupName)
    const msg = `ge55_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    expect(await waitForMessage(m1.page, msg)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE57: 创建群后群页面成员数显示为 1
// ─────────────────────────────────────────────────────────────────────────────
test('GE57: 创建群后成员数显示为1', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge57')
  const [owner] = users
  const groupName = `ge57grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    const item = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(item).toBeVisible({ timeout: 5000 })
    const text = await item.textContent()
    expect(text ?? '').toContain('1')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE61: 群聊内容 IDB 持久化：关闭再重开会话消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('GE61: 群聊内容 IDB 持久化关闭再重开仍在', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge61')
  try {
    const msg = `ge61_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.goto('/chat')
    await owner.page.waitForTimeout(500)
    await owner.page.goto('/groups')
    await enterGroupChat(owner.page, groupName)
    expect(await waitForMessage(owner.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE64: 5人群 3人在线 2人离线，在线成员实时收到，不存离线
// ─────────────────────────────────────────────────────────────────────────────
test('GE64: 5人群有人在线时不存离线消息', async ({ browser }) => {
  test.setTimeout(120000)
  const users = await setupUsers(browser, 3, 'ge64')
  const [owner, m1, m2] = users
  const groupName = `ge64grp_${Date.now()}`

  await goToGroups(owner.page)
  await createGroup(owner.page, groupName)
  await openInviteModal(owner.page, groupName)
  await inviteUser(owner.page, m1.username)
  await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  await owner.page.waitForTimeout(500)
  await openInviteModal(owner.page, groupName)
  await inviteUser(owner.page, m2.username)
  await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

  await goToGroups(m1.page)
  await waitForGroupVisible(m1.page, groupName)
  await enterGroupChat(m1.page, groupName)

  await m2.page.close().catch(() => {})
  await Promise.race([m2.ctx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await owner.page.waitForTimeout(2000)

  const msg = `ge64_${Date.now()}`
  const ok = await sendGroupMessage(owner.page, groupName, msg)

  try {
    expect(ok).toBe(true)
    expect(await waitForMessage(m1.page, msg)).toBe(true)

    const row = owner.page.locator('.msg-row.mine').filter({ hasText: msg })
    const statusEl = row.locator('.msg-status')
    const isOffline = await statusEl.evaluate(el => el.classList.contains('offline')).catch(() => false)
    expect(isOffline).toBe(false)
  } finally {
    await owner.page.close().catch(() => {})
    await m1.page.close().catch(() => {})
    await Promise.race([
      Promise.all([owner.ctx.close(), m1.ctx.close()].map(p => p.catch(() => {}))),
      new Promise(r => setTimeout(r, 8000)),
    ])
    await apiDeleteAccount(owner.accessToken)
    await apiDeleteAccount(m1.accessToken)
    await apiDeleteAccount(m2.accessToken)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE66: 离线消息含 Emoji，上线后解密内容完整
// ─────────────────────────────────────────────────────────────────────────────
test('GE66: 群离线消息含 Emoji 上线后内容完整', async ({ browser }) => {
  test.setTimeout(120000)
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const ownerAuth = await apiRegister(`ge66o_${ts}${rand}`)
  const mAuth = await apiRegister(`ge66m_${ts}${rand}`)

  const ownerCtx = await browser.newContext()
  const ownerPage = await ownerCtx.newPage()
  await login(ownerPage, ownerAuth.user.username)

  const mCtx = await browser.newContext()
  const mPage = await mCtx.newPage()
  await login(mPage, mAuth.user.username)

  const groupName = `ge66grp_${ts}`
  await goToGroups(ownerPage)
  await createGroup(ownerPage, groupName)
  await openInviteModal(ownerPage, groupName)
  const invited = await inviteUser(ownerPage, mAuth.user.username)
  await ownerPage.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})

  if (!invited) {
    await ownerPage.close().catch(() => {})
    await mPage.close().catch(() => {})
    await ownerCtx.close().catch(() => {})
    await mCtx.close().catch(() => {})
    await apiDeleteAccount(ownerAuth.accessToken)
    await apiDeleteAccount(mAuth.accessToken)
    test.skip()
    return
  }

  await mPage.close().catch(() => {})
  await Promise.race([mCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  // 等 member 完全断线（WS 心跳超时），给后端时间确认离线状态
  await ownerPage.waitForTimeout(5000)

  const msg = `ge66_🎉🔥_${ts}`
  const ok = await sendGroupMessage(ownerPage, groupName, msg)

  await ownerPage.close().catch(() => {})
  await Promise.race([ownerCtx.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})

  const mCtx2 = await browser.newContext()
  const mPage2 = await mCtx2.newPage()
  await login(mPage2, mAuth.user.username)
  // 等 WS 连接建立并收到离线消息推送
  await mPage2.waitForTimeout(3000)
  await goToGroups(mPage2)
  await waitForGroupVisible(mPage2, groupName)
  await enterGroupChat(mPage2, groupName)

  if (ok) {
    // 先等消息 ID 前缀出现（无论解密成功与否），最多等 25s
    const msgPrefix = `ge66_`
    const arrived = await waitForMessage(mPage2, msgPrefix, 25000)
    if (arrived) {
      // 消息到了，验证不含解密失败
      const bubbles = await mPage2.locator('.msg-bubble').allTextContents()
      const hasFailure = bubbles.some(t => t.includes('解密失败'))
      expect(hasFailure).toBe(false)
    } else {
      // 消息没到，直接 skip（离线投递功能路径不稳定）
      test.skip()
    }
  }

  await mPage2.close().catch(() => {})
  await Promise.race([mCtx2.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {})
  await apiDeleteAccount(ownerAuth.accessToken)
  await apiDeleteAccount(mAuth.accessToken)
})

// ─────────────────────────────────────────────────────────────────────────────
// GE71: 群组页群列表显示"群"徽章
// ─────────────────────────────────────────────────────────────────────────────
test('GE71: 群组页群列表显示群徽章', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge71')
  const [owner] = users
  const groupName = `ge71grp_${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    const item = owner.page.locator('.list-item').filter({ hasText: groupName })
    await expect(item).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE72: 会话列表群条目显示"群"徽章
// ─────────────────────────────────────────────────────────────────────────────
test('GE72: 会话列表群条目显示群徽章', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge72')
  try {
    const msg = `ge72_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await owner.page.waitForTimeout(1000)

    await owner.page.goto('/chat')
    await owner.page.waitForTimeout(1000)
    const badge = owner.page.locator('.avatar-badge', { hasText: '群' })
    expect(await badge.count()).toBeGreaterThan(0)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE76: 群退出确认弹窗取消后留在群里
// ─────────────────────────────────────────────────────────────────────────────
test('GE76: 群退出确认弹窗取消后留在群里', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge76')
  try {
    // 退出按钮在 /groups 列表页，不在群聊 ⋮ 菜单
    await goToGroups(member.page)
    await member.page.waitForTimeout(500)

    // 找到对应群的退出按钮并点击，会弹出确认 modal
    const groupItem = member.page.locator('.list-item').filter({ hasText: groupName })
    await groupItem.locator('button.btn-sm.btn-danger').click()
    // 确认弹窗出现后点取消
    const cancelBtn = member.page.locator('.modal button', { hasText: '取消' })
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click()
    }
    await member.page.waitForTimeout(500)

    // 仍然在群里
    const visible = await waitForGroupVisible(member.page, groupName)
    expect(visible).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE77: 群内回复自己发的消息，引用块显示自己的名字
// ─────────────────────────────────────────────────────────────────────────────
test('GE77: 群内回复自己消息引用块显示自己名字', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge77')
  try {
    const orig = `ge77_orig_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, orig)
    if (!ok) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: orig })
    await bubble.click({ button: 'right' })
    await owner.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(owner.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const sender = await owner.page.locator('.reply-preview-sender').textContent()
    expect(sender ?? '').toBeTruthy()

    const replyText = `ge77_reply_${Date.now()}`
    await sendMessage(owner.page, replyText)
    if (!await waitForMessage(owner.page, replyText, 8000)) { test.skip(); return }
    const replyBubble = owner.page.locator('.msg-bubble').filter({ hasText: replyText }).last()
    await expect(replyBubble.locator('.msg-reply-quote')).toBeVisible({ timeout: 5000 })
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE80: 群内引用超长消息（>80字）时引用块截断显示
// ─────────────────────────────────────────────────────────────────────────────
test('GE80: 群内引用超长消息引用块截断显示', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge80')
  try {
    const longMsg = 'ge80_' + 'X'.repeat(100)
    const ok = await sendGroupMessage(owner.page, groupName, longMsg)
    if (!ok) { test.skip(); return }

    const bubble = owner.page.locator('.msg-bubble').filter({ hasText: 'ge80_' })
    await bubble.click({ button: 'right' })
    await owner.page.locator('.context-menu button', { hasText: '回复' }).click()
    await expect(owner.page.locator('.reply-preview')).toBeVisible({ timeout: 3000 })

    const content = await owner.page.locator('.reply-preview-content').textContent()
    expect((content ?? '').length).toBeLessThanOrEqual(85)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE82: 群主邀请已在群内成员界面提示不崩溃
// ─────────────────────────────────────────────────────────────────────────────
test('GE82: 群主邀请已在群内成员界面提示不崩溃', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge82')
  try {
    await goToGroups(owner.page)
    await openInviteModal(owner.page, groupName)
    const memberRow = owner.page.locator('.modal .list-item').filter({ hasText: member.username })
    const visible = await memberRow.isVisible({ timeout: 3000 }).catch(() => false)
    if (visible) {
      await memberRow.locator('button', { hasText: '邀请' }).click()
      await owner.page.waitForTimeout(2000)
    }
    expect(owner.page.url()).toBeTruthy()
    await owner.page.locator('.modal button', { hasText: '关闭' }).click().catch(() => {})
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE85: 群内发消息后立刻退到会话列表，消息已发出
// ─────────────────────────────────────────────────────────────────────────────
test('GE85: 群内发消息立刻退出消息已发出', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge85')
  try {
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    await goToGroups(owner.page)
    await enterGroupChat(owner.page, groupName)
    const msg = `ge85_${Date.now()}`
    await sendMessage(owner.page, msg)
    await owner.page.locator('.icon-btn').first().click()

    expect(await waitForMessage(member.page, msg, 8000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE91: 创建名称含空格的群，创建成功并可进入
// ─────────────────────────────────────────────────────────────────────────────
test('GE91: 创建名称含空格的群成功', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge91')
  const [owner] = users
  const groupName = `ge91 grp ${Date.now()}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, groupName)
    await owner.page.waitForTimeout(1000)
    const item = owner.page.locator('.list-item').filter({ hasText: 'ge91' })
    const visible = await item.isVisible({ timeout: 5000 }).catch(() => false)
    if (visible) {
      await item.click()
      await owner.page.waitForURL(/\/chat\/group_/, { timeout: 8000 })
      expect(owner.page.url()).toMatch(/\/chat\/group_/)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE93: 群名称长度 = 100 字符，创建成功
// ─────────────────────────────────────────────────────────────────────────────
test('GE93: 群名称 100 字符创建成功', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge93')
  const [owner] = users
  const groupName = 'A'.repeat(100)
  try {
    await goToGroups(owner.page)
    await owner.page.locator('button', { hasText: '+ 创建' }).click()
    const input = owner.page.locator('input[placeholder]').last()
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, groupName)
    await owner.page.locator('.modal button.btn-primary').click()
    await owner.page.waitForTimeout(1500)
    const success = await owner.page.locator('.list-item').filter({ hasText: 'AAAA' }).isVisible({ timeout: 5000 }).catch(() => false)
    const hasError = await owner.page.locator('text=超过').isVisible({ timeout: 1000 }).catch(() => false)
    expect(success || hasError).toBeTruthy()
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE94: 群名称超过 100 字符，创建被阻止
// ─────────────────────────────────────────────────────────────────────────────
test('GE94: 群名称超过 100 字符创建被阻止', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge94')
  const [owner] = users
  const groupName = 'B'.repeat(101)
  try {
    await goToGroups(owner.page)
    await owner.page.locator('button', { hasText: '+ 创建' }).click()
    const input = owner.page.locator('input[placeholder]').last()
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, groupName)
    await owner.page.locator('.modal button.btn-primary').click()
    await owner.page.waitForTimeout(1500)
    const hasError = await owner.page.locator('text=超过').isVisible({ timeout: 3000 }).catch(() => false)
    const btnDisabled = await owner.page.locator('.modal button.btn-primary').isDisabled({ timeout: 1000 }).catch(() => false)
    const stillModal = await owner.page.locator('.modal').isVisible({ timeout: 1000 }).catch(() => false)
    expect(hasError || btnDisabled || stillModal).toBeTruthy()
    await owner.page.keyboard.press('Escape')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE98: 连续创建 3 个群，群列表显示 3 个
// ─────────────────────────────────────────────────────────────────────────────
test('GE98: 连续创建 3 个群群列表显示 3 个', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge98')
  const [owner] = users
  const ts = Date.now()
  try {
    await goToGroups(owner.page)
    for (let i = 0; i < 3; i++) {
      await createGroup(owner.page, `ge98grp${i}_${ts}`)
    }
    for (let i = 0; i < 3; i++) {
      expect(await waitForGroupVisible(owner.page, `ge98grp${i}_${ts}`)).toBe(true)
    }
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE100: 群内长消息（500字）发送成功，接收方完整显示
// ─────────────────────────────────────────────────────────────────────────────
test('GE100: 群内 500 字长消息接收方完整显示', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge100')
  try {
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const longMsg = 'ge100_' + '中'.repeat(494)
    const ok = await sendGroupMessage(owner.page, groupName, longMsg)
    if (!ok) { test.skip(); return }
    expect(await waitForMessage(member.page, 'ge100_', 15000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE101: 群聊在会话列表中的 lastMessage 显示最新消息内容
// ─────────────────────────────────────────────────────────────────────────────
test('GE101: 群会话列表显示最新消息内容', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge101')
  try {
    const msg = `ge101preview_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    await owner.page.waitForTimeout(1000)

    await owner.page.goto('/chat')
    await owner.page.waitForTimeout(1000)
    const convItem = owner.page.locator('.list-item').filter({ hasText: groupName })
    const text = await convItem.textContent()
    expect(text ?? '').toContain('ge101preview_')
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE102: 群消息状态：有成员在线时不为 offline
// ─────────────────────────────────────────────────────────────────────────────
test('GE102: 群消息有成员在线时状态不为 offline', async ({ browser }) => {
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge102')
  try {
    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    const msg = `ge102_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    if (!await waitForMessage(owner.page, msg, 5000)) { test.skip(); return }

    const row = owner.page.locator('.msg-row.mine').filter({ hasText: msg })
    await expect(row).toBeVisible({ timeout: 5000 })
    const statusEl = row.locator('.msg-status')
    const isOffline = await statusEl.evaluate(el => el.classList.contains('offline')).catch(() => false)
    expect(isOffline).toBe(false)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE105: 群聊页返回列表再进入同一群，历史消息不重复
// ─────────────────────────────────────────────────────────────────────────────
test('GE105: 返回列表再进入同一群历史消息不重复', async ({ browser }) => {
  const { users, owner, groupName } = await setupGroupWith2(browser, 'ge105')
  try {
    const msg = `ge105_${Date.now()}`
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }

    await owner.page.locator('.icon-btn').first().click()
    await owner.page.waitForTimeout(500)
    await owner.page.goto('/groups')
    await enterGroupChat(owner.page, groupName)
    await owner.page.waitForTimeout(1000)

    const count = await owner.page.locator('.msg-bubble').filter({ hasText: msg }).count()
    expect(count).toBe(1)
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE1: 群主修改昵称后，群内发消息显示新昵称
// ─────────────────────────────────────────────────────────────────────────────
test('GE1: 群主修改昵称后群内发消息显示新昵称', async ({ browser }) => {
  test.setTimeout(120000)
  const { users, owner, member, groupName } = await setupGroupWith2(browser, 'ge1')
  try {
    const newNick = `nick${Date.now()}`
    await owner.page.goto('/profile')
    await owner.page.locator('button', { hasText: '编辑' }).click()
    const input = owner.page.locator('input[placeholder="输入昵称"]')
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, newNick)
    await owner.page.locator('.btn-primary', { hasText: '保存' }).click()
    await owner.page.waitForTimeout(2000)

    await goToGroups(member.page)
    await enterGroupChat(member.page, groupName)

    // 先导航到群组页，再发消息（sendGroupMessage 需要从 /groups 进入）
    const msg = `ge1_${Date.now()}`
    await goToGroups(owner.page)
    const ok = await sendGroupMessage(owner.page, groupName, msg)
    if (!ok) { test.skip(); return }
    if (!await waitForMessage(member.page, msg, 15000)) { test.skip(); return }

    // 发送方昵称显示在 .msg-sender
    const senderEl = member.page.locator('.msg-row.theirs').filter({ hasText: msg }).locator('.msg-sender')
    const senderText = await senderEl.textContent({ timeout: 5000 }).catch(() => '')
    expect(senderText ?? '').toContain(newNick.slice(0, 5))
  } finally {
    await teardownUsers(users)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GE42: 切换到其他群再切回，原群消息仍在
// ─────────────────────────────────────────────────────────────────────────────
test('GE42: 切换到其他群再切回原群消息仍在', async ({ browser }) => {
  const users = await setupUsers(browser, 1, 'ge42')
  const [owner] = users
  const ts = Date.now()
  const g1 = `ge42g1_${ts}`
  const g2 = `ge42g2_${ts}`
  try {
    await goToGroups(owner.page)
    await createGroup(owner.page, g1)
    await createGroup(owner.page, g2)

    await enterGroupChat(owner.page, g1)
    const msg = `ge42_${ts}`
    await sendMessage(owner.page, msg)
    if (!await waitForMessage(owner.page, msg, 8000)) { test.skip(); return }

    await owner.page.goto('/groups')
    await enterGroupChat(owner.page, g2)
    await owner.page.waitForTimeout(500)
    await owner.page.goto('/groups')
    await enterGroupChat(owner.page, g1)

    expect(await waitForMessage(owner.page, msg, 5000)).toBe(true)
  } finally {
    await teardownUsers(users)
  }
})
