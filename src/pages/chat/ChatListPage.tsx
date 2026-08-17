import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { userApi } from '../../api'
import type { Conversation } from '../../types'
import { formatTime } from '../../utils'
import { sanitizeAvatarUrl } from '../../utils/sanitize'

export default function ChatListPage() {
  const navigate = useNavigate()
  const loadConversations = useChatStore(s => s.loadConversations)
  const conversations = useChatStore(s => s.conversations)
  const clearConversation = useChatStore(s => s.clearConversation)
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState<Conversation | null>(null)
  // 在线用户集合（username → true），用于显示在线/离线状态
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  // 监听在线/离线事件
  useEffect(() => {
    function onOnline(e: Event) {
      const { username } = (e as CustomEvent).detail
      if (username) {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.add(username)
          return next
        })
      }
    }
    function onOffline(e: Event) {
      const { username } = (e as CustomEvent).detail
      if (username) {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.delete(username)
          return next
        })
      }
    }
    function onReconnected() {
      userApi.online().then(res => {
        if (res.success) setOnlineUsers(new Set(res.data.map(u => u.username)))
      }).catch(() => {})
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

  // 停在消息列表页：push 一个锚点，popstate 触发时立即 push 回来，使返回键无法离开此页
  useEffect(() => {
    window.history.pushState({ chatListAnchor: true }, '')
    function onPopState() {
      window.history.pushState({ chatListAnchor: true }, '')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 长按计时
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressTarget = useRef<Conversation | null>(null)

  useEffect(() => {
    loadConversations()
    userApi.online().then(res => {
      if (res.success) {
        setOnlineUsers(new Set(res.data.map(u => u.username)))
      }
    }).catch(() => {})
  }, [loadConversations])

  const filtered = conversations.filter(c => {
    const name = c.targetNickname || c.targetUsername || ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function openChat(conv: Conversation) {
    navigate(`/chat/${conv.id}`, { state: { conv } })
  }

  function onPressStart(conv: Conversation) {
    pressTarget.current = conv
    pressTimer.current = setTimeout(() => {
      setConfirmClear(conv)
    }, 500)
  }

  function onPressEnd() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressTarget.current = null
  }

  function doClear() {
    if (!confirmClear) return
    clearConversation(confirmClear.id)
    setConfirmClear(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>消息</h2>
      </div>

      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>清除聊天记录</h3>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 12 }}>
              确定清除与「{confirmClear.targetNickname || confirmClear.targetUsername}」的所有聊天记录？此操作不可恢复。
            </p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={doClear}>确定清除</button>
              <button onClick={() => setConfirmClear(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          type="search"
          placeholder="搜索会话..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>暂无消息</p>
            <p className="empty-hint">去在线列表开始聊天吧</p>
          </div>
        )}
        {filtered.map(conv => {
          const displayName = conv.targetNickname || conv.targetUsername
          return (
            <div
              key={conv.id}
              className="list-item"
              onClick={() => openChat(conv)}
              onMouseDown={() => onPressStart(conv)}
              onMouseUp={onPressEnd}
              onMouseLeave={onPressEnd}
              onTouchStart={() => onPressStart(conv)}
              onTouchEnd={onPressEnd}
              onTouchCancel={onPressEnd}
              onContextMenu={e => { e.preventDefault(); setConfirmClear(conv) }}
            >
              <div className="avatar">
                {conv.targetAvatar && sanitizeAvatarUrl(conv.targetAvatar)
                  ? <img src={sanitizeAvatarUrl(conv.targetAvatar)} alt="" />
                  : <span>{(displayName || '?')[0].toUpperCase()}</span>
                }
                {conv.type === 'group' && <span className="avatar-badge">群</span>}
                {conv.type === 'private' && (
                  <span className={onlineUsers.has(conv.targetUsername) ? 'online-dot' : 'offline-dot'} />
                )}
              </div>
              <div className="list-item-body">
                <div className="list-item-row">
                  <span className="list-item-name">{displayName || '未知'}</span>
                  {conv.lastMessageTime && (
                    <span className="list-item-time">{formatTime(conv.lastMessageTime)}</span>
                  )}
                </div>
                <div className="list-item-row">
                  <span className="list-item-preview">
                    {conv.lastMessage ?? ''}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="badge">{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
