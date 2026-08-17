import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { getApiError } from '../../utils'
import { useWakeHint } from '../../hooks/useWakeHint'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { wakeHint, startWaiting, stopWaiting } = useWakeHint()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      setError('用户名只能包含字母、数字和下划线，长度 3-50 位')
      return
    }
    if (password.length < 6) { setError('密码至少需要 6 位'); return }
    if (password !== confirmPassword) { setError('两次密码不一致'); return }
    setLoading(true)
    startWaiting()
    try {
      const res = await authApi.register({ username, password, confirmPassword })
      stopWaiting()
      if (res.success) {
        setAuth(res.data.accessToken, res.data.refreshToken, res.data.user)
        navigate('/chat')
      } else {
        setError(res.message ?? '注册失败')
      }
    } catch (err) {
      stopWaiting()
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = wakeHint ?? (loading ? '注册中...' : '注册')

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💬</span>
          <h1>WebChat</h1>
          <p>创建你的账号</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="3-50位字母/数字/下划线"
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
              placeholder="至少6位"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              required
              autoComplete="new-password"
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
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  )
}
