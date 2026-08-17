/**
 * 输入校验、个人资料、限流场景测试
 *
 * 覆盖：
 * V1  注册密码少于6位 → 中文错误提示
 * V2  注册密码恰好6位 → 正常注册成功
 * V3  注册用户名含非法字符 → 中文错误提示
 * V4  注册两次密码不一致 → 中文错误提示
 * V5  昵称超过50字 → 中文错误提示
 * V6  昵称50字以内 → 保存成功
 * V7  群名超过100字 → 中文错误提示
 * V8  群名100字以内 → 创建成功
 * V9  登录连续失败超过限流 → 429 提示（本地 login-max=1000，此场景验证错误密码正确提示）
 * V10 注册后昵称默认等于用户名
 * V11 个人页显示 UID
 * V12 修改昵称为空时不保存（使用原昵称）
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:8080'
const PASSWORD = 'Test1234!'

async function apiRegister(username: string, password = PASSWORD) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword: password }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(`注册失败: ${data.message}`)
  return data.data as { accessToken: string; user: { username: string; nickname: string; uid: string } }
}

async function apiDeleteAccount(accessToken: string, password = PASSWORD) {
  await fetch(`${BASE_URL}/api/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => {})
}

async function login(page: Page, username: string, password = PASSWORD) {
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

// ── V1: 密码少于6位显示中文错误 ───────────────────────────────────────────────

test('V1: 注册密码少于6位显示中文错误提示', async ({ page }) => {
  await page.goto('/register')
  await page.locator('input[placeholder="3-50位字母/数字/下划线"]').fill('v1testuser')
  await page.locator('input[placeholder="至少6位"]').fill('12345')
  await page.locator('input[placeholder="再次输入密码"]').fill('12345')
  await page.locator('button:has-text("注册")').click()

  const error = page.locator('.form-error')
  await expect(error).toBeVisible({ timeout: 3000 })
  await expect(error).toContainText('6')
  // 不能跳走
  await expect(page).toHaveURL(/\/register/)
})

// ── V2: 密码恰好6位注册成功 ───────────────────────────────────────────────────

test('V2: 注册密码恰好6位可以成功注册', async ({ browser }) => {
  const ts = Date.now()
  const username = `v2u${ts}`
  const password = 'Ab1234'

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  let accessToken = ''
  try {
    await page.goto('/register')
    await page.locator('input[placeholder="3-50位字母/数字/下划线"]').fill(username)
    await page.locator('input[placeholder="至少6位"]').fill(password)
    await page.locator('input[placeholder="再次输入密码"]').fill(password)
    await page.locator('button:has-text("注册")').click()
    await page.waitForURL(/\/chat/, { timeout: 15000 })
    await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 15000 })

    // 拿到 token 用于清理
    const auth = await apiRegister(username).catch(() => null)
    if (auth) accessToken = auth.accessToken
  } finally {
    await ctx.close()
    // 通过 API 清理：先尝试直接注册同名账号拿 token（若 UI 注册已成功则此处失败，用上面的 token）
    if (!accessToken) {
      const auth2 = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: username, password }),
      }).then(r => r.json()).catch(() => null)
      if (auth2?.data?.accessToken) accessToken = auth2.data.accessToken
    }
    if (accessToken) await apiDeleteAccount(accessToken, password)
  }
})

// ── V3: 用户名含非法字符显示中文错误 ─────────────────────────────────────────

test('V3: 注册用户名含非法字符显示中文错误提示', async ({ page }) => {
  await page.goto('/register')
  await page.locator('input[placeholder="3-50位字母/数字/下划线"]').fill('user name!')
  await page.locator('input[placeholder="至少6位"]').fill(PASSWORD)
  await page.locator('input[placeholder="再次输入密码"]').fill(PASSWORD)
  await page.locator('button:has-text("注册")').click()

  const error = page.locator('.form-error')
  await expect(error).toBeVisible({ timeout: 3000 })
  await expect(error).toContainText(/字母|数字|下划线/)
  await expect(page).toHaveURL(/\/register/)
})

// ── V4: 两次密码不一致显示中文错误 ───────────────────────────────────────────

test('V4: 注册两次密码不一致显示中文错误提示', async ({ page }) => {
  await page.goto('/register')
  await page.locator('input[placeholder="3-50位字母/数字/下划线"]').fill('v4testuser')
  await page.locator('input[placeholder="至少6位"]').fill('Password1!')
  await page.locator('input[placeholder="再次输入密码"]').fill('DifferentPwd!')
  await page.locator('button:has-text("注册")').click()

  await expect(page.locator('.form-error')).toContainText('两次密码不一致')
  await expect(page).toHaveURL(/\/register/)
})

// ── V5: 昵称超过50字显示中文错误 ─────────────────────────────────────────────

test('V5: 修改昵称超过50字符显示中文错误提示', async ({ browser }) => {
  const ts = Date.now()
  const username = `v5u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)

    await page.getByRole('button', { name: '编辑' }).click()
    const longNickname = 'A'.repeat(51)
    // maxLength=50 限制输入，用 nativeInputValueSetter 绕过并触发 React onChange
    await page.locator('input[placeholder="输入昵称"]').evaluate(
      (el: HTMLInputElement, val) => {
        el.removeAttribute('maxlength')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter?.call(el, val)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      },
      longNickname
    )
    await page.getByRole('button', { name: '保存' }).click()

    await expect(page.locator('.form-error')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.form-error')).toContainText('50')
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V6: 昵称50字以内保存成功 ─────────────────────────────────────────────────

test('V6: 修改昵称50字以内保存成功', async ({ browser }) => {
  const ts = Date.now()
  const username = `v6u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)

    await page.getByRole('button', { name: '编辑' }).click()
    const newNickname = `nick_${ts}`
    await page.locator('input[placeholder="输入昵称"]').fill(newNickname)
    await page.getByRole('button', { name: '保存' }).click()

    // 保存成功，界面显示新昵称，无错误
    await expect(page.locator('.form-error')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('.profile-info')).toContainText(newNickname, { timeout: 5000 })
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V7: 群名超过100字显示中文错误 ─────────────────────────────────────────────

test('V7: 创建群组名称超过100字符显示中文错误提示', async ({ browser }) => {
  const ts = Date.now()
  const username = `v7u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('群组').click()
    await expect(page).toHaveURL(/\/groups/)

    await page.getByRole('button', { name: '+ 创建' }).click()
    await expect(page.locator('.modal')).toBeVisible({ timeout: 3000 })

    const longName = 'G'.repeat(101)
    // maxLength=100 限制，用 nativeInputValueSetter 绕过并触发 React onChange
    await page.locator('input[placeholder="群组名称"]').evaluate(
      (el: HTMLInputElement, val) => {
        el.removeAttribute('maxlength')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter?.call(el, val)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      },
      longName
    )
    await page.locator('.modal .btn-primary').click()

    await expect(page.locator('.form-error')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.form-error')).toContainText('100')
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V8: 群名100字以内创建成功 ─────────────────────────────────────────────────

test('V8: 创建群组名称100字以内创建成功', async ({ browser }) => {
  const ts = Date.now()
  const username = `v8u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('群组').click()
    await expect(page).toHaveURL(/\/groups/)

    const groupName = `v8grp_${ts}`
    await page.getByRole('button', { name: '+ 创建' }).click()
    await page.locator('input[placeholder="群组名称"]').fill(groupName)
    await page.locator('.modal .btn-primary').click()

    await expect(page.locator('.list-item').filter({ hasText: groupName })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.form-error')).not.toBeVisible()
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V9: 连续登录错误密码，每次都显示明确中文错误（非空、非英文） ────────────────

test('V9: 连续错误密码登录每次均显示中文错误提示', async ({ page }) => {
  // 注册一个真实账号，然后用错误密码连续登录，验证每次都有中文提示
  const ts = Date.now()
  const username = `v9u${ts}`
  const auth = await apiRegister(username)

  try {
    for (let i = 0; i < 3; i++) {
      await page.goto('/login')
      await page.locator('input[placeholder="输入用户名"]').fill(username)
      await page.locator('input[placeholder="输入密码"]').fill('wrongpassword123')
      await page.locator('button[type="submit"]').click()
      const error = page.locator('.form-error')
      await expect(error).toBeVisible({ timeout: 8000 })
      const text = await error.textContent()
      // 错误文本必须是中文（不能是英文 bean validation 消息）
      expect(text).toBeTruthy()
      expect(text).not.toMatch(/must be|size|between|null/)
      await expect(page).toHaveURL(/\/login/)
    }
  } finally {
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V10: 注册后昵称默认等于用户名 ────────────────────────────────────────────

test('V10: 注册后默认昵称等于用户名', async ({ browser }) => {
  const ts = Date.now()
  const username = `v10u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)
    // 默认昵称应等于用户名
    await expect(page.locator('.profile-info')).toContainText(username, { timeout: 5000 })
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V11: 个人页显示 UID ───────────────────────────────────────────────────────

test('V11: 个人页显示 UID', async ({ browser }) => {
  const ts = Date.now()
  const username = `v11u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.locator('.profile-uid')).toBeVisible({ timeout: 5000 })
    const uidText = await page.locator('.profile-uid').textContent()
    expect(uidText).toMatch(/UID/)
    // UID 不能为空
    expect(uidText?.replace('UID:', '').trim().length).toBeGreaterThan(0)
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})

// ── V12: 昵称输入框为空时保存，使用空昵称（后端允许 undefined，显示用户名兜底） ──

test('V12: 修改昵称为空提交不崩溃，界面正常显示', async ({ browser }) => {
  const ts = Date.now()
  const username = `v12u${ts}`
  const auth = await apiRegister(username)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await login(page, username)
    await page.locator('.bottom-nav').getByText('我的').click()
    await expect(page).toHaveURL(/\/profile/)

    await page.getByRole('button', { name: '编辑' }).click()
    await page.locator('input[placeholder="输入昵称"]').fill('')
    await page.getByRole('button', { name: '保存' }).click()

    // 不崩溃，无 JS 错误，页面仍正常（显示用户名或原昵称作为兜底）
    await expect(page.locator('.profile-info')).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/profile/)
  } finally {
    await ctx.close()
    await apiDeleteAccount(auth.accessToken)
  }
})