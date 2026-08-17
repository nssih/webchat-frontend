import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi, authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { sanitizeAvatarUrl } from '../../utils/sanitize'
import { clearPublicKeyCache } from '../../crypto/publicKeyCache'
import { clearGroupKeyCache } from '../../crypto/groupKeyCache'
import { closeDb, deleteDb } from '../../db'
import { getApiError } from '../../utils'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const refreshToken = useAuthStore(s => s.refreshToken)
  const resetAll = useChatStore(s => s.resetAll)
  const { disconnect } = useWebSocket()
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function saveProfile() {
    setSaving(true)
    setError('')
    if (nickname.trim().length > 50) { setError('昵称不能超过 50 个字符'); setSaving(false); return }
    try {
      const res = await userApi.updateProfile({ nickname: nickname.trim() || undefined })
      if (res.success) {
        setUser(res.data)
        setEditing(false)
      } else {
        setError(res.message ?? '保存失败')
      }
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    disconnect()
    resetAll()
    clearPublicKeyCache()
    clearGroupKeyCache()
    closeDb()
    clearAuth()
    navigate('/login')
    if (refreshToken) authApi.logout(refreshToken).catch(() => {})
  }

  async function deleteAccount() {
    if (!deletePassword.trim()) { setDeleteError('请输入密码以确认注销'); return }
    setDeleting(true)
    setDeleteError('')
    const username = user?.username
    try {
      await userApi.deleteAccount(deletePassword)
      disconnect()
      resetAll()
      clearPublicKeyCache()
      clearGroupKeyCache()
      if (username) await deleteDb(username)
      clearAuth()
      navigate('/login')
    } catch (err: unknown) {
      setDeleting(false)
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg ?? '注销失败，请检查网络后重试')
    }
  }

  if (!user) return null

  return (
    <div className="page">
      <div className="page-header">
        <h2>我的</h2>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {user.avatar && sanitizeAvatarUrl(user.avatar)
            ? <img src={sanitizeAvatarUrl(user.avatar)} alt="" />
            : <span>{(user.nickname || user.username)[0].toUpperCase()}</span>
          }
        </div>
        <div className="profile-info">
          {editing ? (
            <div className="form-group">
              <label>昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="输入昵称"
                maxLength={50}
              />
              {error && <div className="form-error">{error}</div>}
              <div className="btn-group">
                <button className="btn-primary" onClick={saveProfile} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
                <button onClick={() => { setEditing(false); setNickname(user.nickname ?? '') }}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <h3>{user.nickname || user.username}</h3>
              <p className="profile-uid">UID: {user.uid}</p>
              <p className="profile-username">用户名: @{user.username}</p>
            </>
          )}
        </div>
        {!editing && (
          <button className="btn-sm" onClick={() => setEditing(true)}>编辑</button>
        )}
      </div>

      <div className="settings-list">
        <div className="settings-item">
          <span>聊天记录存储</span>
          <span className="settings-value">仅本设备</span>
        </div>
        <div className="settings-item">
          <span>服务器存储</span>
          <span className="settings-value">仅账号信息</span>
        </div>
        <div className="settings-item settings-item-link" onClick={() => navigate('/about')}>
          <span>关于 WebChat</span>
          <span className="settings-arrow">›</span>
        </div>
      </div>

      <div className="profile-actions">
        {confirmLogout ? (
          <div className="logout-confirm">
            <p>确定退出登录？</p>
            <div className="btn-group">
              <button className="btn-danger" onClick={logout}>确定退出</button>
              <button onClick={() => setConfirmLogout(false)}>取消</button>
            </div>
          </div>
        ) : confirmDelete ? (
          <div className="logout-confirm">
            <p>注销后账号和所有数据将永久删除，无法恢复。请输入密码确认：</p>
            <input
              type="password"
              placeholder="输入当前密码"
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
              onKeyDown={e => e.key === 'Enter' && deleteAccount()}
              style={{ width: '100%', marginBottom: 8 }}
            />
            {deleteError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{deleteError}</p>}
            <div className="btn-group">
              <button className="btn-danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? '注销中...' : '确定注销'}
              </button>
              <button onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError('') }}>取消</button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn-danger btn-full" onClick={() => setConfirmLogout(true)}>退出登录</button>
            <button className="btn-ghost btn-full" onClick={() => setConfirmDelete(true)}>注销账号</button>
          </>
        )}
      </div>
    </div>
  )
}