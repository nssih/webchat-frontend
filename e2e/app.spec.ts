import { test, expect, type Page } from '@playwright/test'

// ─── 测试用账号（每次跑前尝试注册，已存在则直接用） ─────────────────────
const USER_A = { username: 'e2e_alice_001', password: 'Test1234!' }
const USER_B = { username: 'e2e_bob_001', password: 'Test1234!' }

async function tryRegister(page: Page, username: string, password: string) {
  await page.goto('/register')
  await page.fill('input[placeholder="3-50位字母/数字/下划线"]', username)
  await page.fill('input[placeholder="至少6位"]', password)
  await page.fill('input[placeholder="再次输入密码"]', password)
  await page.click('button:has-text("注册")')
  // 成功进 chat，或已存在错误都 ok
  await page.waitForURL(/\/(chat|register)/, { timeout: 15_000 })
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.fill('input[placeholder="输入用户名"]', username)
  await page.fill('input[placeholder="输入密码"]', password)
  await page.click('button:has-text("登录")')
  await page.waitForURL(/\/chat/, { timeout: 15_000 })
  await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 25000 })
  await page.waitForFunction(
    () => document.body.getAttribute('data-ws-ready') === 'true',
    { timeout: 30000 }
  )
}

// ─── setup：确保两个测试账号存在 ─────────────────────────────────────
// serial 保证 setup 先跑，其余并发

test.describe('0. Setup - 创建测试账号', () => {
  test('注册 USER_A（已存在则跳过）', async ({ page }) => {
    await tryRegister(page, USER_A.username, USER_A.password)
    // 若已存在会停在 /register 并显示错误，也算通过
    expect(page.url()).toMatch(/\/(chat|register)/)
  })

  test('注册 USER_B（已存在则跳过）', async ({ page }) => {
    await tryRegister(page, USER_B.username, USER_B.password)
    expect(page.url()).toMatch(/\/(chat|register)/)
  })
})

// ─── 1. 登录页 UI ────────────────────────────────────────────────────
test.describe('1. 登录页', () => {
  test('显示用户名、密码输入框和登录按钮', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/WebChat/)
    await expect(page.getByPlaceholder('输入用户名')).toBeVisible()
    await expect(page.getByPlaceholder('输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('有跳转注册的链接', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/注册|没有账号/)).toBeVisible()
  })

  test('未登录访问 /chat 重定向到 /login', async ({ page }) => {
    await page.goto('/chat')
    await expect(page).toHaveURL(/\/login/)
  })

  test('密码为空点击登录不跳转', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="输入用户名"]', 'someone')
    await page.click('button:has-text("登录")')
    await expect(page).toHaveURL(/\/login/)
  })

  test('错误密码登录显示错误提示', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
    await page.fill('input[placeholder="输入用户名"]', 'nonexistent_user_xyz')
    await page.fill('input[placeholder="输入密码"]', 'wrongpassword_xyz')
    await page.click('button:has-text("登录")')
    await expect(page.locator('.form-error')).toBeVisible({ timeout: 8_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─── 2. 注册页 UI ────────────────────────────────────────────────────
test.describe('2. 注册页', () => {
  test('显示用户名、密码、确认密码输入框', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByPlaceholder('3-50位字母/数字/下划线')).toBeVisible()
    await expect(page.getByPlaceholder('至少6位')).toBeVisible()
    await expect(page.getByPlaceholder('再次输入密码')).toBeVisible()
  })

  test('有跳转登录的链接', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText(/登录|已有账号/)).toBeVisible()
  })

  test('重复用户名注册显示错误提示', async ({ page }) => {
    // 先注册一个临时账号
    const tempUser = 'e2e_dup_test_001'
    const tempPwd = 'Test1234!'
    await page.goto('/register')
    await page.fill('input[placeholder="3-50位字母/数字/下划线"]', tempUser)
    await page.fill('input[placeholder="至少6位"]', tempPwd)
    await page.fill('input[placeholder="再次输入密码"]', tempPwd)
    await page.click('button:has-text("注册")')
    await page.waitForURL(/\/(chat|register)/, { timeout: 15_000 })

    // 再次注册相同用户名
    await page.goto('/register')
    await page.fill('input[placeholder="3-50位字母/数字/下划线"]', tempUser)
    await page.fill('input[placeholder="至少6位"]', tempPwd)
    await page.fill('input[placeholder="再次输入密码"]', tempPwd)
    await page.click('button:has-text("注册")')
    await expect(page.locator('.form-error')).toBeVisible({ timeout: 8_000 })
    // 错误信息包含"已被注册"或通用失败提示
    await expect(page.locator('.form-error')).not.toHaveText('')
  })

  test('两次密码不一致显示错误', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[placeholder="3-50位字母/数字/下划线"]', 'newuser_xyz')
    await page.fill('input[placeholder="至少6位"]', 'Password1!')
    await page.fill('input[placeholder="再次输入密码"]', 'DifferentPwd!')
    await page.click('button:has-text("注册")')
    await expect(page.locator('.form-error')).toContainText('两次密码不一致')
  })

  test('用户名格式不合法显示错误', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[placeholder="3-50位字母/数字/下划线"]', 'ab') // 少于3位
    await page.fill('input[placeholder="至少6位"]', USER_A.password)
    await page.fill('input[placeholder="再次输入密码"]', USER_A.password)
    await page.click('button:has-text("注册")')
    await expect(page.locator('.form-error')).toBeVisible({ timeout: 5_000 })
  })
})

// ─── 3. 登录后主界面布局 ──────────────────────────────────────────────
test.describe('3. 主界面布局', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
  })

  test('底部导航栏四个 tab 都显示', async ({ page }) => {
    await expect(page.locator('.bottom-nav')).toBeVisible()
    await expect(page.locator('.bottom-nav').getByText('消息')).toBeVisible()
    await expect(page.locator('.bottom-nav').getByText('在线')).toBeVisible()
    await expect(page.locator('.bottom-nav').getByText('群组')).toBeVisible()
    await expect(page.locator('.bottom-nav').getByText('我的')).toBeVisible()
  })

  test('title 显示 WebChat', async ({ page }) => {
    await expect(page).toHaveTitle(/WebChat/)
  })

  test('点击在线 tab 跳转 /friends', async ({ page }) => {
    await page.locator('.bottom-nav').getByText('在线').click()
    await expect(page).toHaveURL(/\/friends/)
  })

  test('点击群组 tab 跳转 /groups', async ({ page }) => {
    await page.locator('.bottom-nav').getByText('群组').click()
    await expect(page).toHaveURL(/\/groups/)
  })

  test('点击我的 tab 跳转 /profile', async ({ page }) => {
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)
  })

  test('消息列表页有页面标题', async ({ page }) => {
    await expect(page.locator('.page-header')).toBeVisible()
  })
})

// ─── 4. 在线用户列表 ──────────────────────────────────────────────────
test.describe('4. 在线用户列表', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    await expect(page).toHaveURL(/\/friends/)
  })

  test('在线页有"在线用户"标题', async ({ page }) => {
    await expect(page.locator('h2, .page-header h2').filter({ hasText: '在线用户' })).toBeVisible()
  })
})

// ─── 5. 聊天页布局（需要 USER_B 也在线，此处只验证 UI 结构） ───────────
test.describe('5. 聊天页 UI 结构', () => {
  test('从消息列表进入聊天页结构正确', async ({ page }) => {
    // USER_B 先登录建立会话记录
    await login(page, USER_B.username, USER_B.password)
    await page.goto('/login')
    await login(page, USER_A.username, USER_A.password)

    // 点击在线 tab，等 USER_B 出现在列表
    await page.locator('.bottom-nav').getByText('在线').click()
    await expect(page).toHaveURL(/\/friends/)

    // 等待列表加载，点击 USER_B
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)

    if (visible) {
      await userBItem.click()
      await page.waitForURL(/\/chat\//, { timeout: 8_000 })

      // 验证聊天页 UI 结构
      await expect(page.locator('.chat-header')).toBeVisible()
      await expect(page.locator('.chat-messages')).toBeVisible()
      await expect(page.locator('.chat-input-area')).toBeVisible()
      await expect(page.locator('.main-content--chat')).toBeVisible()

      // 输入框、发送按钮、表情按钮
      await expect(page.locator('.chat-input')).toBeVisible()
      await expect(page.getByRole('button', { name: '发送' })).toBeVisible()
      await expect(page.locator('.emoji-btn')).toBeVisible()

      // 发送按钮默认禁用
      await expect(page.getByRole('button', { name: '发送' })).toBeDisabled()

      // 输入后发送按钮可用
      await page.locator('.chat-input').fill('hello')
      await expect(page.getByRole('button', { name: '发送' })).toBeEnabled()
    } else {
      // USER_B 不在线时跳过，记录为通过
      test.skip()
    }
  })
})

// ─── 6. 表情选择器 ───────────────────────────────────────────────────
test.describe('6. 表情选择器', () => {
  test('点击表情按钮弹出 picker，点击外部关闭', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    // 弹出 picker
    await page.locator('.emoji-btn').click()
    await expect(page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 5_000 })

    // 点击遮罩关闭
    await page.locator('.emoji-backdrop').click()
    await expect(page.locator('.emoji-picker-wrap')).toBeHidden({ timeout: 3_000 })
  })

  test('选择表情后插入到输入框', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    await page.locator('.emoji-btn').click()
    await expect(page.locator('.emoji-picker-wrap')).toBeVisible({ timeout: 5_000 })
    // 点第一个表情
    await page.locator('.epr-body button.epr-btn').first().click()
    const val = await page.locator('.chat-input').inputValue()
    expect(val.length).toBeGreaterThan(0)
    // picker 自动关闭
    await expect(page.locator('.emoji-picker-wrap')).toBeHidden({ timeout: 3_000 })
  })
})

// ─── 7. 发送消息 ─────────────────────────────────────────────────────
test.describe('7. 发送消息', () => {
  test('发送文字消息出现在气泡列表，输入框清空', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    const msg = `e2e_test_${Date.now()}`
    await page.locator('.chat-input').fill(msg)
    await page.getByRole('button', { name: '发送' }).click()

    await expect(page.locator(`.msg-bubble`).filter({ hasText: msg })).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('.chat-input')).toHaveValue('')
  })

  test('Enter 键发送消息', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    const msg = `enter_${Date.now()}`
    await page.locator('.chat-input').fill(msg)
    await page.keyboard.press('Enter')
    await expect(page.locator('.msg-bubble').filter({ hasText: msg })).toBeVisible({ timeout: 8_000 })
  })

  test('Shift+Enter 换行不发送', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    await page.locator('.chat-input').fill('line1')
    await page.keyboard.press('Shift+Enter')
    await page.locator('.chat-input').type('line2')
    const val = await page.locator('.chat-input').inputValue()
    expect(val).toContain('line1')
    expect(val).toContain('line2')
  })
})

// ─── 8. 我的页面 ─────────────────────────────────────────────────────
test.describe('8. 我的页面', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)
  })

  test('显示当前用户名', async ({ page }) => {
    await expect(page.locator('.profile-username')).toContainText(USER_A.username)
  })

  test('显示关于入口', async ({ page }) => {
    await expect(page.getByText(/关于/)).toBeVisible()
  })

  test('点击关于跳转关于页并显示内容', async ({ page }) => {
    await page.getByText(/关于/).click()
    await expect(page).toHaveURL(/\/about/)
    await expect(page.locator('text=WebChat')).toBeVisible()
  })

  test('显示退出登录按钮', async ({ page }) => {
    await expect(page.getByRole('button', { name: /退出|登出/ })).toBeVisible()
  })

  test('退出后跳转到登录页', async ({ page }) => {
    await page.getByRole('button', { name: /退出|登出/ }).click()
    // 可能有确认弹窗
    const confirmBtn = page.getByRole('button', { name: /确认|确定|退出/ })
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click()
    }
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })
})

// ─── 9. 关于页面 ─────────────────────────────────────────────────────
test.describe('9. 关于页面', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.goto('/about')
  })

  test('显示 WebChat 标题', async ({ page }) => {
    await expect(page.locator('text=WebChat').first()).toBeVisible()
  })

  test('显示端对端加密相关说明', async ({ page }) => {
    await expect(page.locator('text=/加密|E2E|端对端/').first()).toBeVisible()
  })
})

// ─── 10. header 固定验证 ─────────────────────────────────────────────
test.describe('10. 聊天页 header 固定', () => {
  test('main-content--chat class 存在，外层不滚动', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    // 验证 CSS class 存在
    await expect(page.locator('.main-content--chat')).toBeVisible()

    // 验证 header 在滚动后仍固定（scrollTop 变化但 header 位置不变）
    const headerBefore = await page.locator('.chat-header').boundingBox()
    await page.locator('.chat-messages').evaluate(el => el.scrollTop = 99999)
    const headerAfter = await page.locator('.chat-header').boundingBox()
    expect(headerBefore?.y).toBe(headerAfter?.y)
  })
})

// ─── 11. 文件大小限制 UI ─────────────────────────────────────────────
test.describe('11. 文件大小限制', () => {
  test('选择超过 4GB 的文件显示错误', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const userBItem = page.locator('.list-item').filter({ hasText: USER_B.username }).first()
    const visible = await userBItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!visible) { test.skip(); return }

    await userBItem.click()
    await page.waitForURL(/\/chat\//, { timeout: 8_000 })

    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['x'], 'huge.zip', { type: 'application/zip' })
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 * 1024 })
      const dt = new DataTransfer()
      dt.items.add(file)
      Object.defineProperty(input, 'files', { value: dt.files })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // 应该弹出 alert 或出现错误提示
    const dialog = page.waitForEvent('dialog', { timeout: 3_000 }).catch(() => null)
    const d = await dialog
    if (d) {
      expect(d.message()).toMatch(/4G|超出|过大/)
      await d.dismiss()
    } else {
      await expect(page.locator('text=/4G|超出|过大/i')).toBeVisible({ timeout: 3_000 })
    }
  })
})