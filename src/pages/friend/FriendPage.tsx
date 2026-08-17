import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { sanitizeAvatarUrl } from '../../utils/sanitize'
import type { User } from '../../types'
import { getPrivateConvId } from '../../utils'
import { setPublicKeys } from '../../crypto/publicKeyCache'

interface UserRowProps {
  u: User
  onStartChat: (u: User) => void
}

function UserRow({ u, onStartChat }: UserRowProps) {
  return (
    <div className="list-item" onClick={() => onStartChat(u)}>
      <div className="avatar">
        {u.avatar && sanitizeAvatarUrl(u.avatar)
          ? <img src={sanitizeAvatarUrl(u.avatar)} alt="" />
          : <span>{(u.nickname || u.username)[0].toUpperCase()}</span>}
        <span className="online-dot" />
      </div>
      <div className="list-item-body">
        <span className="list-item-name">{u.nickname || u.username}</span>
        <span className="list-item-sub">@{u.username}</span>
      </div>
      <button className="btn-sm btn-primary" onClick={e => { e.stopPropagation(); onStartChat(u) }}>
        发消息
      </button>
    </div>
  )
}

export default function FriendPage() {
  const user = useAuthStore(s => s.user)!
  const { upsertConversation, conversations } = useChatStore()
  const navigate = useNavigate()

  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const mainContent = document.querySelector('.main-content') as HTMLElement | null
    if (mainContent) { mainContent.style.overflow = ''; mainContent.style.paddingBottom = '' }
    loadOnline()
  }, [])

  // 实时监听上线/下线事件
  useEffect(() => {
    function onOnline(e: Event) {
      const { username } = (e as CustomEvent).detail
      userApi.getUserByUsername(username).then(res => {
        if (res.success) {
          setOnlineUsers(prev => {
            if (prev.some(u => u.username === username)) return prev
            setPublicKeys([res.data])
            return [...prev, res.data]
          })
        }
      }).catch(() => {})
    }
    function onOffline(e: Event) {
      const { username } = (e as CustomEvent).detail
      setOnlineUsers(prev => prev.filter(u => u.username !== username))
    }
    function onReconnected() {
      loadOnline()
    }
    window.addEventListener('user-online', onOnline)
    window.addEventListener('user-offline', onOffline)
    window.addEventListener('ws-reconnected', onReconnected)
    return () => {
      window.removeEventListener('user-online', onOnline)
      window.removeEventListener('user-offline', onOffline)
      window.removeEventListener('ws-reconnected', onReconnected)
    }
  }, [])

  async function loadOnline() {
    setLoading(true)
    try {
      const res = await userApi.online()
      if (res.success) {
        setOnlineUsers(res.data)
        setPublicKeys(res.data)
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }

  const recentUsernames = conversations
    .filter(c => c.type === 'private')
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .map(c => c.targetUsername)

  const recentSet = new Set(recentUsernames)

  const recentOnline = onlineUsers.filter(u => recentSet.has(u.username))
  recentOnline.sort((a, b) => recentUsernames.indexOf(a.username) - recentUsernames.indexOf(b.username))

  const otherOnline = onlineUsers.filter(u => !recentSet.has(u.username))

  function startChat(target: User) {
    const convId = getPrivateConvId(user.username, target.username)
    upsertConversation({
      id: convId,
      type: 'private',
      targetUsername: target.username,
      targetNickname: target.nickname,
      targetAvatar: target.avatar,
      lastMessage: null,
      lastMessageTime: null,
      unreadCount: 0,
      updatedAt: Date.now(),
    })
    navigate(`/chat/${convId}`, {
      state: {
        conv: {
          id: convId,
          type: 'private',
          targetUsername: target.username,
          targetNickname: target.nickname,
          targetAvatar: target.avatar,
        },
      },
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>在线用户</h2>
      </div>

      <div className="list">
        {loading && <div className="empty-state"><p>加载中...</p></div>}

        {!loading && onlineUsers.length === 0 && (
          <div className="empty-state">
            <p>暂无其他在线用户</p>
            <p className="empty-hint">让朋友也登录进来吧</p>
          </div>
        )}

        {!loading && recentOnline.length > 0 && (
          <>
            <div className="list-section-title">最近联系</div>
            {recentOnline.map(u => <UserRow key={u.id} u={u} onStartChat={startChat} />)}
          </>
        )}

        {!loading && otherOnline.length > 0 && (
          <>
            <div className="list-section-title">其他在线用户</div>
            {otherOnline.map(u => <UserRow key={u.id} u={u} onStartChat={startChat} />)}
          </>
        )}
      </div>
    </div>
  )
}