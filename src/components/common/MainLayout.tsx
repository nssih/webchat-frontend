import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { formatFileSize } from '../../utils'
import { useWebSocket } from '../../hooks/useWebSocket'
import { acceptTransfer, rejectTransfer, cancelIncomingTransfer, sendWsMessage } from '../../hooks/useWebSocket'
import { initSession } from '../../crypto/keyStore'
import { getPrivateConvId } from '../../utils'

export default function MainLayout() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { connect, disconnect } = useWebSocket()
  const isChatPage = location.pathname.startsWith('/chat/')

  const { loadConversations } = useChatStore()
  const totalUnread = useChatStore(s =>
    s.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
  )

  const [keyState, setKeyState] = useState<'pending' | 'ready' | 'failed'>('pending')

  // ===== 全局文件传输 UI 状态（数组，支持多个对话同时传输） =====
  const [receiveRequest, setReceiveRequest] = useState<{
    transferId: string; filename: string | undefined
    fileSize: number | undefined; fromUsername: string; fromName: string
  } | null>(null)
  const [receiveProgressList, setReceiveProgressList] = useState<Array<{
    transferId: string; filename: string; received: number
    total: number; startedAt: number; fromName: string
  }>>([])
  const [sendProgressList, setSendProgressList] = useState<Array<{
    transferId: string; sent: number; total: number; startedAt: number; toName: string
  }>>([])
  const [savedToast, setSavedToast] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sendingFileToast, setSendingFileToast] = useState<string | null>(null)
  const [newKeyToast, setNewKeyToast] = useState(false)
  const cleanedTransferIdsRef = useRef(new Set<string>())

  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  const loadConversationsRef = useRef(loadConversations)
  const navigateRef = useRef(navigate)
  useEffect(() => { connectRef.current = connect }, [connect])
  useEffect(() => { disconnectRef.current = disconnect }, [disconnect])
  useEffect(() => { loadConversationsRef.current = loadConversations }, [loadConversations])
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  useEffect(() => {
    if (!user) {
      disconnectRef.current()
      navigateRef.current('/login')
      return
    }
    const username = user.username
    // 已就绪时不重置，避免同账号下路由变化触发 useEffect 重跑时闪烁加密初始化页面
    setKeyState(prev => prev === 'ready' ? 'ready' : 'pending')
    initSession(username)
      .then(({ newKeyGenerated }) => {
        setKeyState('ready')
        if (newKeyGenerated) setNewKeyToast(true)
        loadConversationsRef.current()
        connectRef.current()
        // 密钥就绪后请求通知权限（在用户操作上下文中，避免冷启动被浏览器拦截）
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission()
        }
      })
      .catch(() => setKeyState('failed'))
  }, [user?.username])

  // 每 4 分钟向后端发一个请求，作为 UptimeRobot 外部监控的补充保活
  useEffect(() => {
    const url = `${API_BASE}/actuator/health`
    const timer = setInterval(() => {
      fetch(url, { method: 'GET', cache: 'no-store', mode: 'cors' })
        .catch(() => { /* 静默处理，不影响用户 */ })
    }, 4 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // document.title 实时反映未读数，页面隐藏时闪烁提示
  useEffect(() => {
    if (totalUnread === 0) {
      document.title = 'WebChat'
      return
    }
    document.title = `(${totalUnread}) WebChat`
    if (document.visibilityState === 'visible') return
    let show = true
    const timer = setInterval(() => {
      document.title = show ? `(${totalUnread}) WebChat` : 'WebChat'
      show = !show
    }, 1500)
    return () => { clearInterval(timer) }
  }, [totalUnread])

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible') {
        document.title = totalUnread > 0 ? `(${totalUnread}) WebChat` : 'WebChat'
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [totalUnread])

  // ===== 全局文件传输事件监听（不依赖 ChatPage 存活） =====
  useEffect(() => {
    function onReceiveRequest(e: Event) {
      const { transferId, filename, fileSize, fromUsername, fromNickname } = (e as CustomEvent).detail
      setReceiveRequest({ transferId, filename, fileSize, fromUsername, fromName: fromNickname ?? fromUsername })
    }
    function onReceiveStart(e: Event) {
      const { transferId, filename, totalChunks, fromNickname } = (e as CustomEvent).detail
      setReceiveProgressList(prev => [...prev, { transferId, filename: filename ?? '', received: 0, total: totalChunks, startedAt: 0, fromName: fromNickname ?? '' }])
    }
    function onReceiveProgress(e: Event) {
      const { transferId, received, totalChunks, startedAt } = (e as CustomEvent).detail
      setReceiveProgressList(prev => prev.map(p =>
        p.transferId === transferId ? { ...p, received, total: totalChunks, startedAt } : p
      ))
    }
    function onReceiveDone(e: Event) {
      const { transferId, filename } = (e as CustomEvent).detail
      setReceiveProgressList(prev => prev.filter(p => p.transferId !== transferId))
      if (filename) {
        setSavedToast(`「${filename}」已保存到你选择的位置`)
        setTimeout(() => setSavedToast(null), 1500)
      }
    }
    function onSendProgress(e: Event) {
      const { transferId, sent, total, startedAt, toNickname } = (e as CustomEvent).detail
      setSendProgressList(prev => {
        const exists = prev.find(p => p.transferId === transferId)
        if (exists) return prev.map(p => p.transferId === transferId ? { ...p, sent, total, startedAt } : p)
        return [...prev, { transferId, sent, total, startedAt, toName: toNickname ?? '' }]
      })
    }
    function onSendDone(e: Event) {
      const { transferId, filename } = (e as CustomEvent).detail
      setSendProgressList(prev => prev.filter(p => p.transferId !== transferId))
      if (filename) {
        setSendingFileToast(`「${filename}」已发送`)
        setTimeout(() => setSendingFileToast(null), 1500)
      }
    }
    function onTransferError(e: Event) {
      const { transferId, message } = (e as CustomEvent).detail
      // 已清理过的 transferId 跳过，防止重复 error 事件导致频繁 setState 抖动
      if (cleanedTransferIdsRef.current.has(transferId)) return
      cleanedTransferIdsRef.current.add(transferId)
      // 只清除关联的进度条（按 transferId 匹配）
      setSendProgressList(prev => prev.filter(p => p.transferId !== transferId))
      setReceiveProgressList(prev => prev.filter(p => p.transferId !== transferId))
      setReceiveRequest(prev => prev?.transferId === transferId ? null : prev)
      if (message) {
        setErrorMsg(message)
        setTimeout(() => setErrorMsg(null), 3000)
      }
    }
    window.addEventListener('file-receive-request', onReceiveRequest)
    window.addEventListener('file-receive-start', onReceiveStart)
    window.addEventListener('file-receive-progress', onReceiveProgress)
    window.addEventListener('file-receive-done', onReceiveDone)
    window.addEventListener('file-send-progress', onSendProgress)
    window.addEventListener('file-send-done', onSendDone)
    window.addEventListener('file-transfer-error', onTransferError)
    return () => {
      window.removeEventListener('file-receive-request', onReceiveRequest)
      window.removeEventListener('file-receive-start', onReceiveStart)
      window.removeEventListener('file-receive-progress', onReceiveProgress)
      window.removeEventListener('file-receive-done', onReceiveDone)
      window.removeEventListener('file-send-progress', onSendProgress)
      window.removeEventListener('file-send-done', onSendDone)
      window.removeEventListener('file-transfer-error', onTransferError)
    }
  }, [])

  // 有活跃文件传输时禁止意外刷新/关闭页面
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const hasActiveTransfer = receiveProgressList.length > 0 || sendProgressList.length > 0 || receiveRequest !== null
      if (hasActiveTransfer) {
        e.preventDefault()
        e.returnValue = '当前有文件传输进行中，刷新将中断传输'
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [receiveProgressList, sendProgressList, receiveRequest])

  function handleAccept() {
    if (!receiveRequest || !user) return
    const req = receiveRequest
    setReceiveRequest(null)
    const convId = getPrivateConvId(user.username, req.fromUsername)

    // 手机端接收超过 1GB 的文件：提示建议在电脑上接收，但由用户决定是否继续
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && req.fileSize != null && req.fileSize > 1 * 1024 * 1024 * 1024) {
      const sizeMB = (req.fileSize / 1024 / 1024 / 1024).toFixed(2)
      const ok = confirm(
        `此文件大小为 ${sizeMB}GB，在手机上接收大文件可能耗时较长且受网络影响较大。\n\n` +
        `建议在电脑浏览器（Chrome / Edge）中接收以获得最佳体验。\n\n` +
        `是否仍要在手机上继续接收？`
      )
      if (!ok) {
        rejectTransfer(req.transferId, convId)
        return
      }
    }

    // Firefox + HTTP 环境（非 Secure Context）不支持 showSaveFilePicker
    // 使用内存收集后下载的兼容模式
    const canUseFilePicker = typeof (window as any).showSaveFilePicker === 'function'
      && window.isSecureContext
    if (!canUseFilePicker) {
      // 降级模式：整个文件收集到内存后触发下载，iOS/Firefox 等不支持流式写盘的浏览器走此路径
      // 限制 200MB，超出会把设备内存撑爆导致 Tab 崩溃
      const MEMORY_LIMIT = 200 * 1024 * 1024
      if (req.fileSize != null && req.fileSize > MEMORY_LIMIT) {
        alert(`你的浏览器不支持大文件流式保存，最大支持接收 200MB 的文件。\n请在桌面版 Chrome 或 Edge 浏览器中接收此文件。`)
        rejectTransfer(req.transferId, convId)
        return
      }
      acceptTransfer(req.transferId, convId, null)
      return
    }

    // showSaveFilePicker 弹出系统对话框期间，页面可能被浏览器节流，
    // 导致 setInterval 心跳延迟。在等用户选保存位置期间每 15 秒发一次 PING，
    // 防止代理/负载均衡器因连接空闲而断开 WebSocket
    const keepaliveTimer = setInterval(() => {
      sendWsMessage({ type: 'PING' })
    }, 15_000)

    ;(window as any).showSaveFilePicker({
      suggestedName: req.filename ?? 'file',
      types: [{ description: '文件', accept: { '*/*': [] } }],
    })
      .then((fileHandle: FileSystemFileHandle) => fileHandle.createWritable())
      .then((writable: FileSystemWritableFileStream) => {
        clearInterval(keepaliveTimer)
        acceptTransfer(req.transferId, convId, writable)
      })
      .catch(() => {
        clearInterval(keepaliveTimer)
        rejectTransfer(req.transferId, convId)
      })
  }

  function handleReject() {
    if (!receiveRequest || !user) return
    const convId = getPrivateConvId(user.username, receiveRequest.fromUsername)
    rejectTransfer(receiveRequest.transferId, convId)
    setReceiveRequest(null)
  }

  // 计算进度
  function calcProgress(current: number, total: number, startedAt: number) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0
    if (pct >= 100 && current >= total) return { pct, etaStr: '正在保存中...' }
    if (current === 0 || startedAt === 0) return { pct, etaStr: '计算中...' }
    const elapsed = (Date.now() - startedAt) / 1000
    const speed = current / elapsed
    const remaining = (total - current) / speed
    const etaStr = remaining < 60 ? `约 ${Math.ceil(remaining)} 秒` : `约 ${Math.ceil(remaining / 60)} 分钟`
    return { pct, etaStr }
  }

  if (!user) return null

  if (keyState === 'pending') {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
          <div>正在初始化加密...</div>
        </div>
      </div>
    )
  }

  if (keyState === 'failed') {
    const isInsecure = !window.isSecureContext
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: 14, maxWidth: 280 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          {isInsecure ? (
            <>
              <div style={{ marginBottom: 8, color: 'var(--text-main)', fontWeight: 600 }}>需要 HTTPS 连接</div>
              <div style={{ marginBottom: 16 }}>端对端加密需要安全连接，请使用 <strong>https://</strong> 访问本应用</div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>加密初始化失败，请检查网络后重试</div>
              <button
                className="btn-primary"
                onClick={() => {
                  setKeyState('pending')
                  initSession(user.username)
                    .then(({ newKeyGenerated }) => {
                      setKeyState('ready')
                      if (newKeyGenerated) setNewKeyToast(true)
                      loadConversations()
                      connect()
                    })
                    .catch(() => setKeyState('failed'))
                }}
              >
                重试
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* ===== 全局文件传输 UI ===== */}

      {/* 接收文件请求弹窗 */}
      {receiveRequest && (
        <div className="file-receive-request global-overlay">
          <span className="file-receive-info">
            <strong>{receiveRequest.fromName}</strong> 想给你发文件：
            「{receiveRequest.filename ?? '文件'}」
            {receiveRequest.fileSize != null && ` (${formatFileSize(receiveRequest.fileSize)})`}
          </span>
          <div className="file-receive-actions">
            <button className="btn-sm btn-primary" onClick={handleAccept}>接受</button>
            <button className="btn-sm" onClick={handleReject}>拒绝</button>
          </div>
        </div>
      )}

      {/* 接收进度条（支持多个同时传输） */}
      {receiveProgressList.map(p => {
        const { pct, etaStr } = calcProgress(p.received, p.total, p.startedAt)
        return (
          <div key={p.transferId} className="transfer-progress-bar global-recv">
            <div className="transfer-progress-header">
              <span>📥 接收来自 {p.fromName} · {pct}%</span>
              <div className="transfer-progress-actions">
                <span className="transfer-eta">{etaStr}</span>
                <button className="transfer-cancel-btn" onClick={() => {
                  cancelIncomingTransfer(p.transferId, user!.username)
                  setReceiveProgressList(prev => prev.filter(x => x.transferId !== p.transferId))
                }}>终止</button>
              </div>
            </div>
            <div className="transfer-progress-track">
              <div className="transfer-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}

      {/* 发送进度条（支持多个同时传输） */}
      {sendProgressList.map(p => {
        const { pct, etaStr } = calcProgress(p.sent, p.total, p.startedAt)
        return (
          <div key={p.transferId} className="transfer-progress-bar global-send">
            <div className="transfer-progress-header">
              <span>📤 发送给 {p.toName} · {pct}%</span>
              <div className="transfer-progress-actions">
                <span className="transfer-eta">{etaStr}</span>
                <button className="transfer-cancel-btn" onClick={() => {
                  sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId: p.transferId })
                  window.dispatchEvent(new CustomEvent('file-transfer-error', {
                    detail: { transferId: p.transferId, message: '已手动终止发送' },
                  }))
                  setSendProgressList(prev => prev.filter(x => x.transferId !== p.transferId))
                }}>终止</button>
              </div>
            </div>
            <div className="transfer-progress-track">
              <div className="transfer-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}

      {/* Toast 消息 */}
      {savedToast && <div className="file-saved-toast">{savedToast}</div>}
      {sendingFileToast && <div className="file-saved-toast">{sendingFileToast}</div>}
      {errorMsg && <div className="file-error-toast">{errorMsg}</div>}
      {newKeyToast && (
        <div className="file-error-toast" style={{ cursor: 'pointer' }} onClick={() => setNewKeyToast(false)}>
          此设备加密密钥已更新，之前收到的历史消息无法解密，新消息将正常加解密。点击关闭
        </div>
      )}

      <div className={`main-content${isChatPage ? ' main-content--chat' : ''}`}>
        <Outlet />
      </div>
      <nav className="bottom-nav">
        <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">
            💬
            {totalUnread > 0 && (
              <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </span>
          <span>消息</span>
        </NavLink>
        <NavLink to="/friends" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">🟢</span>
          <span>在线</span>
        </NavLink>
        <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">👥</span>
          <span>群组</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">⚙️</span>
          <span>我的</span>
        </NavLink>
      </nav>
    </div>
  )
}
