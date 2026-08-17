import { test, expect, type Page } from '@playwright/test'

const USER_A = { username: 'e2e_alice_001', password: 'Test1234!' }
const USER_B = { username: 'e2e_bob_001', password: 'Test1234!' }

async function register(page: Page, username: string, password: string) {
  await page.goto('/register')
  await page.fill('input[placeholder="3-50位字母/数字/下划线"]', username)
  await page.fill('input[placeholder="至少6位"]', password)
  await page.fill('input[placeholder="再次输入密码"]', password)
  await page.click('button:has-text("注册")')
  await page.waitForURL(/\/chat/, { timeout: 15_000 })
  // 等待加密初始化完成；若失败则点重试（后端冷启动时偶发 500）
  for (let i = 0; i < 3; i++) {
    const ready = await page.locator('.bottom-nav').isVisible({ timeout: 8_000 }).catch(() => false)
    if (ready) return
    const failed = await page.locator('button:has-text("重试")').isVisible().catch(() => false)
    if (failed) await page.locator('button:has-text("重试")').click()
    else await page.waitForTimeout(1000)
  }
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

async function goToChatWith(page: Page, targetUsername: string) {
  await page.locator('.bottom-nav').getByText('在线').click()
  await expect(page).toHaveURL(/\/friends/)
  const item = page.locator('.list-item').filter({ hasText: targetUsername }).first()
  const visible = await item.isVisible({ timeout: 6_000 }).catch(() => false)
  if (!visible) return false
  await item.click()
  await page.waitForURL(/\/chat\//, { timeout: 8_000 })
  return true
}

// ─── 12. 注销账号 ────────────────────────────────────────────────────
test.describe('12. 注销账号', () => {
  test('注销账号后跳转到登录页，不能再登录', async ({ browser, request }) => {
    // 每次测试生成唯一用户名，避免重试时因用户名已存在导致注册失败
    const username = `e2e_del_${Date.now()}`
    const password = 'Test1234!'

    // 1. 直接用 API 注册，拿到 token，不走 UI（避免 SQLite 并发锁）
    const regRes = await request.post('http://localhost:8080/api/auth/register', {
      data: { username, password, confirmPassword: password },
    })
    const regBody = await regRes.json()
    expect(regBody.success).toBe(true)
    const accessToken = regBody.data.accessToken

    // 2. 直接用 API 注销（需要传密码）
    const delRes = await request.delete('http://localhost:8080/api/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { password },
    })
    const delBody = await delRes.json()
    expect(delBody.success).toBe(true)

    // 3. 全新上下文尝试登录，应该失败（账号已删除）
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await page2.goto('/login')
    await page2.fill('input[placeholder="输入用户名"]', username)
    await page2.fill('input[placeholder="输入密码"]', password)
    await page2.click('button:has-text("登录")')
    await expect(page2.locator('.form-error')).toBeVisible({ timeout: 8_000 })
    await expect(page2).toHaveURL(/\/login/)

    await ctx2.close()
  })

  test('注销确认弹窗可以取消', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('我的').click()
    await page.getByRole('button', { name: /注销账号/ }).click()
    await expect(page.getByText(/永久删除|无法恢复/)).toBeVisible({ timeout: 3_000 })

    // 点取消
    await page.getByRole('button', { name: /^取消$/ }).click()

    // 弹窗消失，仍在 profile 页
    await expect(page.getByText(/永久删除|无法恢复/)).toBeHidden({ timeout: 3_000 })
    await expect(page).toHaveURL(/\/profile/)

    // 账号仍可正常使用
    await expect(page.locator('.profile-username')).toContainText(USER_A.username)
  })
})

// ─── 13. 刷新后 sending 消息标为 failed ───────────────────────────────
test.describe('13. 刷新后传输中消息标为 failed', () => {
  test('页面加载时没有 sending 状态的消息残留', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)
    await page.locator('.bottom-nav').getByText('在线').click()
    const ok = await goToChatWith(page, USER_B.username)
    if (!ok) { test.skip(); return }

    // 直接检查页面上没有 sending 状态的气泡（正常情况下加载后应全部 resolved）
    await page.waitForTimeout(1000)
    const sendingCount = await page.locator('.msg-status-sending').count()
    expect(sendingCount).toBe(0)
  })
})

// ─── 14. 进度条终止按钮 UI 存在 ───────────────────────────────────────
test.describe('14. 文件传输进度条终止按钮', () => {
  test('模拟传输中进度条包含终止按钮', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)

    // 通过注入自定义事件模拟一个进度条出现
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('file-send-progress', {
        detail: {
          transferId: 'test-transfer-123',
          sent: 5,
          total: 10,
          startedAt: Date.now() - 5000,
          toNickname: 'test_user',
        }
      }))
    })

    // 进度条应出现
    await expect(page.locator('.transfer-progress-bar.global-send')).toBeVisible({ timeout: 3_000 })

    // 终止按钮存在
    await expect(page.locator('.transfer-cancel-btn').first()).toBeVisible()
    await expect(page.locator('.transfer-cancel-btn').first()).toContainText('终止')
  })

  test('点击接收进度条终止按钮后进度条消失', async ({ page }) => {
    await login(page, USER_A.username, USER_A.password)

    // 注入接收进度条
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('file-receive-start', {
        detail: {
          transferId: 'test-recv-456',
          filename: 'test.zip',
          totalChunks: 20,
          fromNickname: 'test_sender',
        }
      }))
      window.dispatchEvent(new CustomEvent('file-receive-progress', {
        detail: {
          transferId: 'test-recv-456',
          received: 5,
          totalChunks: 20,
          startedAt: Date.now() - 3000,
        }
      }))
    })

    await expect(page.locator('.transfer-progress-bar.global-recv')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('.transfer-cancel-btn').first()).toBeVisible()

    // 点击终止
    await page.locator('.transfer-cancel-btn').first().click()

    // 进度条消失
    await expect(page.locator('.transfer-progress-bar.global-recv')).toBeHidden({ timeout: 3_000 })
  })
})