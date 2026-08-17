import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { getApiError } from '../../utils'
import { useWakeHint } from '../../hooks/useWakeHint'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { wakeHint, startWaiting, stopWaiting } = useWakeHint()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    startWaiting()
    try {
      const res = await authApi.login({
        login,
        password,
        deviceName: navigator.userAgent.slice(0, 100),
      })
      stopWaiting()
      if (res.success) {
        setAuth(res.data.accessToken, res.data.refreshToken, res.data.user)
        navigate('/chat')
      } else {
        setError(res.message ?? '登录失败')
      }
    } catch (err) {
      stopWaiting()
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = wakeHint ?? (loading ? '登录中...' : '登录')

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💬</span>
          <h1>WebChat</h1>
          <p>隐私优先的即时通讯</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="输入用户名"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          {wakeHint && !error && (
            <div className="wake-hint">{wakeHint}</div>
          )}
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {buttonLabel}
          </button>
        </form>
        <p className="auth-switch">
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  )
}
