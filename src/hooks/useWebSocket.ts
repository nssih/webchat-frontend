import { useRef, useCallback, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore, setPendingDelivery } from '../store/chatStore'
import { authApi, groupApi } from '../api'
import { getPrivateConvId, getGroupConvId } from '../utils'
import type { WsMessage, Message, Group } from '../types'
import { getPrivateKey } from '../crypto/keyStore'
import { getPublicKey, invalidatePublicKey, fetchPublicKeyWithRetry } from '../crypto/publicKeyCache'
import { decryptMessage, decryptWithGroupKey, generateGroupKey, wrapGroupKey } from '../crypto/e2e'
import { getGroupKey, setGroupKey, invalidateGroupKey } from '../crypto/groupKeyCache'

// 生产/staging 通过 VITE_WS_URL 注入；开发时用相对路径走 Vite 代理（同源，绕过 CSP ws: 限制）
const WS_URL = import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined'
    ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
    : 'ws://localhost:8080')
const PING_INTERVAL = 25000    // 每 25 秒发一次 PING
const RECONNECT_DELAY = 3000

// 文件传输期间放宽心跳容忍度，因为解密/写盘会阻塞主线程处理 PONG
// 空闲时 3 次无响应就重连（75s），传输时 20 次无响应才重连（500s≈8分钟）
// 配合单片 300s 超时，确保地铁/电梯等长时间断网场景也能续传
const MAX_MISSED_PONGS_IDLE = 3
const MAX_MISSED_PONGS_TRANSFERRING = 20

let wsInstance: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let manualClose = false
let missedPongs = 0            // 连续未收到 PONG 的次数

// 按对话（convId）跟踪传输活跃状态，用于：
// 1. 传输期间放宽心跳容忍度（>0 时）
// 2. 阻止同一对话内并发传输
const activeTransferConvs = new Set<string>()       // 收发合计
const sendingFileConvs = new Set<string>()           // 仅发送

// ACK 等待器：transferId_chunkIndex → { resolve, isError }
const ackWaiters = new Map<string, (ok: boolean) => void>()

// 接收中的传输状态（已接受，持有 writable）
interface TransferState {
  messageId: string
  fromUsername: string
  fromNickname: string | null
  fromAvatar: string | null
  filename: string | undefined
  fileSize: number | undefined
  contentType: string
  totalChunks: number
  received: number
  startedAt: number
  writable: FileSystemWritableFileStream | null  // null = Firefox fallback (内存收集后下载)
  chunks: Uint8Array[]  // Firefox fallback: 收集所有分片
}
const incomingTransfers = new Map<string, TransferState>()

// 等待用户接受的传输请求（尚无 writable）
type PendingTransferMeta = Omit<TransferState, 'writable'>
const pendingTransfers = new Map<string, PendingTransferMeta>()

export function useWebSocket() {
  const { addMessage, updateMessageStatus, upsertConversation } = useChatStore()
  const connectedRef = useRef(false)
  const handleIncomingRef = useRef<((msg: WsMessage) => Promise<void>) | null>(null)

  const connect = useCallback(async () => {
    let token = useAuthStore.getState().accessToken
    const currentUser = useAuthStore.getState().user
    if (!token || !currentUser) return
    if (wsInstance?.readyState === WebSocket.OPEN ||
        wsInstance?.readyState === WebSocket.CONNECTING) return

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expMs = payload.exp * 1000
      if (expMs - Date.now() < 60_000) {
        const refreshToken = useAuthStore.getState().refreshToken
        if (refreshToken) {
          try {
            const res = await authApi.refresh(refreshToken)
            if (res.success) {
              useAuthStore.getState().setAuth(res.data.accessToken, res.data.refreshToken, res.data.user)
              token = res.data.accessToken
            } else {
              useAuthStore.getState().clearAuth()
              window.location.href = '/login'
              return
            }
          } catch {
            useAuthStore.getState().clearAuth()
            window.location.href = '/login'
            return
          }
        }
      }
    } catch { }

    manualClose = false

    // 优先用一次性 ticket 替换 URL 中的 token，避免 token 出现在服务器访问日志
    let wsQuery = `token=${token}`
    try {
      const ticketRes = await authApi.getWsTicket()
      if (ticketRes.success && ticketRes.data?.ticket) {
        wsQuery = `ticket=${ticketRes.data.ticket}`
      }
    } catch { /* 降级：继续用 token */ }

    wsInstance = new WebSocket(`${WS_URL}/ws/chat?${wsQuery}`)

    wsInstance.onopen = () => {
      connectedRef.current = true
      missedPongs = 0
      // 重连成功后通知各页面刷新在线状态
      window.dispatchEvent(new CustomEvent('ws-reconnected'))
      // 立即发一个 PING，等后端 PONG 回来后设置 data-ws-ready 标志
      // 保证测试（及真实用户）进入聊天前 WS 已完全就绪
      if (wsInstance?.readyState === WebSocket.OPEN) {
        wsInstance.send(JSON.stringify({ type: 'PING' }))
      }
      pingTimer = setInterval(() => {
        missedPongs++
        // 传输进行时放宽心跳容忍度，避免解密/写盘阻塞 PONG 导致误断
        const maxMissed = activeTransferConvs.size > 0 ? MAX_MISSED_PONGS_TRANSFERRING : MAX_MISSED_PONGS_IDLE
        if (missedPongs > maxMissed) {
          wsInstance?.close()
          return
        }
        if (wsInstance?.readyState === WebSocket.OPEN) {
          wsInstance.send(JSON.stringify({ type: 'PING' }))
        }
      }, PING_INTERVAL)
    }

    // 同步处理 FILE_TRANSFER_ERROR，避免 async 处理延迟导致 ACK 等待超时
    function onFileTransferError(msg: WsMessage) {
      const transferId = msg.transferId!
      const currentUser = useAuthStore.getState().user!
      // 先拿 meta（pending 或 incoming 中都有对方信息），再清理
      const pMeta = pendingTransfers.get(transferId)
      const wasPending = pendingTransfers.has(transferId)
      pendingTransfers.delete(transferId)
      // 如果用户尚未接受就收到错误，关闭接收请求弹窗
      if (wasPending) {
        window.dispatchEvent(new CustomEvent('file-transfer-error', {
          detail: { transferId, message: '发送方已取消文件传输' },
        }))
      }
      // 清理 incoming（传输中途中断）
      const state = incomingTransfers.get(transferId)
      if (state) {
        if (state.writable) state.writable.abort().catch(() => {})
        incomingTransfers.delete(transferId)
        const convId = getPrivateConvId(currentUser.username, state.fromUsername)
        unregisterTransfer(convId)
      } else if (pMeta) {
        const convId = getPrivateConvId(currentUser.username, pMeta.fromUsername)
        unregisterTransfer(convId)
      }
      window.dispatchEvent(new CustomEvent('file-receive-done', {
        detail: { transferId },
      }))
      // 立即以 false 解除所有属于此 transferId 的 ACK 等待，让发送方立即感知失败
      const prefix = transferId + '_'
      for (const key of Array.from(ackWaiters.keys())) {
        if (key.startsWith(prefix)) {
          ackWaiters.get(key)?.(false)
          ackWaiters.delete(key)
        }
      }
      if (msg.content) {
        window.dispatchEvent(new CustomEvent('file-transfer-error', { detail: { transferId, message: msg.content } }))
      }
    }

    wsInstance.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        // === 控制类消息同步处理，不被 async 解密/写盘阻塞 ===
        if (msg.type === 'PONG') {
          missedPongs = 0
          // WS 双向通信确认：后端已注册此连接，标记就绪供测试等待
          document.body.setAttribute('data-ws-ready', 'true')
          return
        }
        if (msg.type === 'FILE_CHUNK_ACK' && msg.transferId != null && msg.chunkIndex != null) {
          const key = `${msg.transferId}_${msg.chunkIndex}`
          ackWaiters.get(key)?.(true)
          return
        }
        if (msg.type === 'FILE_TRANSFER_ERROR' && msg.transferId) {
          onFileTransferError(msg)
          return
        }
        // 其他消息（NEW_MESSAGE、FILE_CHUNK 等）走异步处理
        handleIncomingRef.current?.(msg).catch(() => {})
      } catch { }
    }

    wsInstance.onclose = () => {
      connectedRef.current = false
      missedPongs = 0
      document.body.removeAttribute('data-ws-ready')
      if (pingTimer) clearInterval(pingTimer)
      // 通知 waitForChunkAck 立即中断，不等超时
      window.dispatchEvent(new CustomEvent('ws-disconnected'))
      const state = useChatStore.getState()
      for (const [convId, msgs] of Object.entries(state.messages)) {
        for (const m of msgs) {
          if (m.status === 'sending') {
            state.updateMessageStatus(m.id, convId, 'failed')
          }
        }
      }
      if (!manualClose) {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    wsInstance.onerror = () => {
      wsInstance?.close()
    }
  }, [])

  const handleIncoming = useCallback(async (msg: WsMessage) => {
    if (msg.type === 'PONG') {
      missedPongs = 0
      return
    }

    if (msg.type === 'NEW_MESSAGE') {
      const currentUser = useAuthStore.getState().user!

      // 普通文字消息
      const isGroup = !!msg.toGroupName
      const convId = isGroup
        ? getGroupConvId(msg.toGroupName!)
        : getPrivateConvId(currentUser.username, msg.fromUsername!)

      const existingMsgs = useChatStore.getState().messages[convId] ?? []
      if (msg.messageId && existingMsgs.some(m => m.id === msg.messageId)) return

      let content = msg.content ?? ''
      let decryptionFailed = false
      if (!isGroup) {
        try {
          const myPrivKey = await getPrivateKey(currentUser.username)
          // 对方可能刚注册尚未上传公钥，以短间隔重试最多 6 次（总计约 6s）
          let theirPubKey = await getPublicKey(msg.fromUsername!)
          if (!theirPubKey) {
            theirPubKey = await fetchPublicKeyWithRetry(msg.fromUsername!, 6, 1000)
          }
          if (myPrivKey && theirPubKey) {
            try {
              content = await decryptMessage(myPrivKey, theirPubKey, content)
            } catch {
              // 解密失败：可能是发送方换了密钥对，清除缓存，下次收到新消息时重拉
              invalidatePublicKey(msg.fromUsername!)
              decryptionFailed = true
            }
          } else {
            decryptionFailed = true
          }
        } catch { }
      } else if (isGroup && msg.groupId) {
        try {
          if (msg.keyVersion != null) {
            // 离线消息：按版本号查历史密钥，不走 invalidate+retry（历史密钥固定）
            const groupKey = await getGroupKey(msg.groupId, msg.keyVersion)
            if (groupKey) {
              try {
                content = await decryptWithGroupKey(groupKey, content)
              } catch {
                decryptionFailed = true
              }
            } else {
              decryptionFailed = true
            }
          } else {
            // 实时消息：取最新密钥，失败时 invalidate 后重试一次
            const groupKey = await getGroupKey(msg.groupId)
            if (groupKey) {
              try {
                content = await decryptWithGroupKey(groupKey, content)
              } catch {
                // 群密钥不匹配（轮换进行中），清缓存后重拉一次再重试
                invalidateGroupKey(msg.groupId)
                try {
                  const freshKey = await getGroupKey(msg.groupId)
                  if (freshKey) {
                    content = await decryptWithGroupKey(freshKey, content)
                  } else {
                    decryptionFailed = true
                  }
                } catch {
                  decryptionFailed = true
                }
              }
            } else {
              // 群密钥未加载（尚未初始化或拉取失败），标记解密失败
              decryptionFailed = true
            }
          }
        } catch {
          decryptionFailed = true
        }
      }

      // 解密失败时不显示密文，改为占位符保护用户隐私
      if (decryptionFailed) {
        content = '[解密失败]'
      }

      const localMsg: Message = {
        id: msg.messageId ?? `${Date.now()}_${Math.random()}`,
        conversationId: convId,
        conversationType: isGroup ? 'group' : 'private',
        fromUsername: msg.fromUsername!,
        fromNickname: msg.fromNickname ?? null,
        fromAvatar: msg.fromAvatar ?? null,
        toUsername: msg.toUsername,
        toGroupName: msg.toGroupName,
        contentType: msg.contentType ?? 'text',
        content,
        filename: msg.filename,
        fileSize: msg.fileSize,
        status: 'sent',
        timestamp: msg.timestamp ?? Date.now(),
        seq: msg.seq,
        createdAt: Date.now(),
        replyTo: msg.replyToId ? {
          messageId: msg.replyToId,
          sender: msg.replyToSender ?? '',
          content: msg.replyToContent ?? '',
        } : undefined,
      }
      addMessage(localMsg)

      const existingConv = useChatStore.getState().conversations.find(c => c.id === convId)
      // 当前会话已在屏幕上，不累加未读数（避免与 ChatPage 的 clearUnread 产生竞态）
      const isActive = useChatStore.getState().activeConversationId === convId
      upsertConversation({
        id: convId,
        type: isGroup ? 'group' : 'private',
        targetUsername: isGroup ? msg.toGroupName! : msg.fromUsername!,
        targetNickname: isGroup ? null : (msg.fromNickname ?? null),
        targetAvatar: isGroup ? (existingConv?.targetAvatar ?? null) : (msg.fromAvatar ?? null),
        groupId: isGroup ? (msg.groupId ?? existingConv?.groupId) : undefined,
        lastMessage: msg.contentType === 'text' ? content : `[${msg.contentType}]`,
        lastMessageTime: msg.timestamp ?? Date.now(),
        lastMessageStatus: 'received',
        lastMessageMine: false,
        unreadCount: isActive ? (existingConv?.unreadCount ?? 0) : (existingConv?.unreadCount ?? 0) + 1,
        updatedAt: Date.now(),
      })

      // 桌面通知（页面不可见时）
      if (document.visibilityState !== 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const senderName = msg.fromNickname || msg.fromUsername || '新消息'
        const body = msg.contentType === 'text' ? content.slice(0, 60) : `[${msg.contentType}]`
        if (isGroup) {
          const groupName = existingConv?.targetNickname || msg.toGroupName || '群消息'
          new Notification(groupName, { body: `${senderName}：${body}`, icon: '/icon-192.png' })
        } else {
          new Notification(senderName, { body, icon: '/icon-192.png' })
        }
      }

      // 收到消息后立即发 MESSAGE_RECEIVED 回执，通知发送方消息已送达（双灰勾）
      // 仅私聊发；群聊暂不发（群聊没有单独的送达回执机制）
      if (!isGroup && msg.fromUsername && msg.messageId) {
        sendWsMessage({ type: 'MESSAGE_RECEIVED', messageId: msg.messageId, toUsername: msg.fromUsername })
      }
    }

    if (msg.type === 'CHAT_DELIVERY' && msg.messageId) {
      const state = useChatStore.getState()
      let finalStatus: Message['status']
      if (msg.status === 'sent') finalStatus = 'sent'
      else if (msg.status === 'received') finalStatus = 'received'
      else if (msg.status === 'expired') finalStatus = 'failed'
      else finalStatus = 'offline'
      let found = false
      for (const [convId, msgs] of Object.entries(state.messages)) {
        const m = msgs.find(m => m.id === msg.messageId)
        if (m) {
          // 状态只能向前升级，不能降级
          const order: Message['status'][] = ['sending', 'sent', 'offline', 'received', 'read', 'failed']
          if (order.indexOf(finalStatus) > order.indexOf(m.status)) {
            updateMessageStatus(msg.messageId, convId, finalStatus)
          }
          found = true
          break
        }
      }
      if (!found) setPendingDelivery(msg.messageId, finalStatus)
    }

    // 对方 WS 收到消息立即回执 → 升级为 received（双灰勾）
    if (msg.type === 'MESSAGE_RECEIVED' && msg.messageId) {
      const state = useChatStore.getState()
      for (const [convId, msgs] of Object.entries(state.messages)) {
        const found = msgs.find(m => m.id === msg.messageId)
        if (found && found.status !== 'read') {
          updateMessageStatus(msg.messageId, convId, 'received')
          break
        }
      }
    }

    // 对方打开聊天页面 → 升级为 read（双蓝勾）
    if (msg.type === 'MESSAGE_READ' && msg.messageId) {
      const state = useChatStore.getState()
      for (const [convId, msgs] of Object.entries(state.messages)) {
        const found = msgs.find(m => m.id === msg.messageId)
        if (found) {
          updateMessageStatus(msg.messageId, convId, 'read')
          break
        }
      }
    }

    if (msg.type === 'GROUP_KEY_ROTATE' && msg.groupId) {
      const groupId = msg.groupId
      invalidateGroupKey(groupId)
      // 通知 GroupPage 成员有变动，刷新群列表和邀请弹窗
      window.dispatchEvent(new CustomEvent('group-member-changed', { detail: { groupId } }))
      try {
        const currentUser = useAuthStore.getState().user!
        const groupRes = await groupApi.get(groupId)
        if (!groupRes.success) return
        const group = groupRes.data
        if (group.owner.username !== currentUser.username) return
        const myPrivKey = await getPrivateKey(currentUser.username)
        if (!myPrivKey) return
        const newGroupKey = await generateGroupKey()
        for (const member of group.members) {
          try {
            // 对方可能尚未完成 initSession，重试等待公钥上传
            const memberPubKey = await fetchPublicKeyWithRetry(member.username)
            if (!memberPubKey) continue
            const wrapped = await wrapGroupKey(newGroupKey, memberPubKey, myPrivKey)
            await groupApi.uploadGroupKey(groupId, member.username, wrapped, currentUser.username)
          } catch { }
        }
        setGroupKey(groupId, newGroupKey)
      } catch { }
    }

    if (msg.type === 'GROUP_DISSOLVED' && msg.groupId) {
      // 群主解散了群组，把本地该群的会话从列表移除
      const convId = getGroupConvId(msg.toGroupName ?? String(msg.groupId))
      invalidateGroupKey(msg.groupId)
      useChatStore.getState().clearConversation(convId)
      // 通知 GroupPage 移除该群（若当前在群组页）
      window.dispatchEvent(new CustomEvent('group-dissolved', { detail: { groupId: msg.groupId } }))
    }

    if (msg.type === 'GROUP_MEMBER_ADDED' && msg.groupId && msg.groupData) {
      try {
        const group: Group = JSON.parse(msg.groupData)
        const convId = getGroupConvId(group.name)
        // 必须携带 groupId 写入 store，否则 groupIdFromConvId() 返回 null，发消息被静默 block
        upsertConversation({
          id: convId,
          type: 'group',
          targetUsername: group.name,
          targetNickname: null,
          targetAvatar: group.avatar ?? null,
          groupId: group.id,
          lastMessage: null,
          lastMessageTime: null,
          unreadCount: 0,
          updatedAt: Date.now(),
        })
        // 预热群密钥缓存，让用户可以立即发消息，不需要等第一条消息触发懒加载
        getGroupKey(group.id).catch(() => {})
        // 通知 GroupPage 刷新列表（若当前已在群组页面）
        window.dispatchEvent(new CustomEvent('group-member-added', { detail: { groupId: group.id } }))
      } catch {
        // JSON 解析失败时降级：通知 GroupPage 主动拉一次列表
        window.dispatchEvent(new CustomEvent('group-member-added', { detail: {} }))
      }
    }

    // ===== 在线状态实时推送 =====
    if (msg.type === 'USER_ONLINE' && msg.fromUsername) {
      window.dispatchEvent(new CustomEvent('user-online', { detail: { username: msg.fromUsername } }))
    }
    if (msg.type === 'USER_OFFLINE' && msg.fromUsername) {
      window.dispatchEvent(new CustomEvent('user-offline', { detail: { username: msg.fromUsername } }))
    }

    // ===== 接收方：收到分片传输开始 =====
    if (msg.type === 'FILE_TRANSFER_START' && msg.transferId) {
      const currentUser = useAuthStore.getState().user!
      const totalChunks = msg.totalChunks ?? 0

      // 发送方断线重连后重发的 START：已接受的传输直接回 ACK-1，不重复弹窗
      if (incomingTransfers.has(msg.transferId)) {
        sendWsMessage({ type: 'FILE_CHUNK_ACK', transferId: msg.transferId, chunkIndex: -1 })
        return
      }

      const convId = getPrivateConvId(currentUser.username, msg.fromUsername ?? '')
      const IMAGE_INLINE_MAX = 5 * 1024 * 1024
      const isSilentImage = msg.contentType === 'image'
        && msg.fileSize != null && msg.fileSize <= IMAGE_INLINE_MAX

      if (isSilentImage) {
        // ≤5MB 图片：静默自动接受，用内存收集分片，收齐后拼成 dataUrl 存入消息
        activeTransferConvs.add(convId)
        incomingTransfers.set(msg.transferId, {
          messageId: msg.messageId ?? msg.transferId,
          fromUsername: msg.fromUsername ?? '',
          fromNickname: msg.fromNickname ?? null,
          fromAvatar: msg.fromAvatar ?? null,
          filename: msg.filename,
          fileSize: msg.fileSize,
          contentType: msg.contentType ?? 'image',
          totalChunks,
          received: 0,
          startedAt: 0,
          writable: null,   // 走内存收集路径
          chunks: [],
        })
        sendWsMessage({ type: 'FILE_CHUNK_ACK', transferId: msg.transferId, chunkIndex: -1 })
        return
      }

      pendingTransfers.set(msg.transferId, {
        messageId: msg.messageId ?? msg.transferId,
        fromUsername: msg.fromUsername ?? '',
        fromNickname: msg.fromNickname ?? null,
        fromAvatar: msg.fromAvatar ?? null,
        filename: msg.filename,
        fileSize: msg.fileSize,
        contentType: msg.contentType ?? 'file',
        totalChunks,
        received: 0,
        startedAt: 0,
        chunks: [],
      })
      activeTransferConvs.add(convId)
      window.dispatchEvent(new CustomEvent('file-receive-request', {
        detail: {
          transferId: msg.transferId,
          filename: msg.filename,
          fileSize: msg.fileSize,
          totalChunks,
          fromUsername: msg.fromUsername ?? '',
          fromNickname: msg.fromNickname ?? msg.fromUsername ?? '',
        },
      }))
    }

    // ===== 接收方：收到一个分片，解密后写盘（或 Firefox 兼容模式：内存收集） =====
    if (msg.type === 'FILE_CHUNK' && msg.transferId && msg.chunkIndex != null && msg.fileData) {
      const state = incomingTransfers.get(msg.transferId)
      if (!state) return

      // 发送方断线重连后可能重发已写过的片，直接回 ACK 跳过，防止重复写入文件
      if (msg.chunkIndex < state.received) {
        sendWsMessage({ type: 'FILE_CHUNK_ACK', transferId: msg.transferId, chunkIndex: msg.chunkIndex })
        return
      }

      if (state.received === 0) state.startedAt = Date.now()

      const currentUser = useAuthStore.getState().user!
      const myPrivKey = await getPrivateKey(currentUser.username)
      const senderPubKey = await getPublicKey(state.fromUsername)

      try {
        if (!myPrivKey || !senderPubKey) {
          if (state.writable) await state.writable.abort().catch(() => {})
          incomingTransfers.delete(msg.transferId)
          const convId = getPrivateConvId(currentUser.username, state.fromUsername)
          unregisterTransfer(convId)
          sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId: msg.transferId })
          window.dispatchEvent(new CustomEvent('file-receive-done', { detail: { transferId: msg.transferId, filename: state.filename } }))
          return
        }

        const b64 = await decryptMessage(myPrivKey, senderPubKey, msg.fileData)
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

        if (state.writable) {
          // 标准模式：直接写盘
          await state.writable.write(bytes)
        } else {
          // 内存收集：静默图片 或 Firefox/iOS 兼容模式
          state.chunks.push(bytes)
        }
        state.received++

        // 通知发送方本片已写盘，驱动其发下一片
        sendWsMessage({
          type: 'FILE_CHUNK_ACK',
          transferId: msg.transferId,
          chunkIndex: msg.chunkIndex,
        })

        window.dispatchEvent(new CustomEvent('file-receive-progress', {
          detail: {
            transferId: msg.transferId,
            received: state.received,
            totalChunks: state.totalChunks,
            startedAt: state.startedAt,
          },
        }))

        // 所有分片接收完毕
        if (state.received === state.totalChunks) {
          const IMAGE_INLINE_MAX = 5 * 1024 * 1024
          const isSilentImage = state.contentType === 'image'
            && state.fileSize != null && state.fileSize <= IMAGE_INLINE_MAX

          if (state.writable) {
            // 标准模式：关闭文件流
            await state.writable.close()
          } else if (isSilentImage) {
            // 静默图片：分片拼成 dataUrl，直接存入消息，不触发下载
            const totalBytes = state.chunks.reduce((sum, c) => sum + c.length, 0)
            const merged = new Uint8Array(totalBytes)
            let offset = 0
            for (const chunk of state.chunks) {
              merged.set(chunk, offset)
              offset += chunk.length
            }
            // Uint8Array → base64（分段处理避免超 call stack）
            let binary = ''
            const SUB = 8192
            for (let j = 0; j < merged.length; j += SUB) {
              binary += String.fromCharCode(...merged.subarray(j, j + SUB))
            }
            const mimeType = state.filename
              ? (state.filename.match(/\.(png)$/i) ? 'image/png'
                : state.filename.match(/\.(gif)$/i) ? 'image/gif'
                : state.filename.match(/\.(webp)$/i) ? 'image/webp'
                : 'image/jpeg')
              : 'image/jpeg'
            const dataUrl = `data:${mimeType};base64,${btoa(binary)}`

            incomingTransfers.delete(msg.transferId)
            const convId = getPrivateConvId(currentUser.username, state.fromUsername)
            unregisterTransfer(convId)

            sendWsMessage({
              type: 'FILE_SAVED',
              transferId: msg.transferId,
              messageId: state.messageId,
              toUsername: state.fromUsername,
            })

            // 图片 dataUrl 直接作为消息内容存入 IndexedDB，刷新后仍可预览
            const localMsg: Message = {
              id: state.messageId,
              conversationId: convId,
              conversationType: 'private',
              fromUsername: state.fromUsername,
              fromNickname: state.fromNickname,
              fromAvatar: state.fromAvatar,
              toUsername: currentUser.username,
              contentType: 'image',
              content: dataUrl,
              filename: state.filename,
              fileSize: state.fileSize,
              status: 'sent',
              timestamp: Date.now(),
              createdAt: Date.now(),
            }
            addMessage(localMsg)

            const existingConv = useChatStore.getState().conversations.find(c => c.id === convId)
            const isActiveConv = useChatStore.getState().activeConversationId === convId
            upsertConversation({
              id: convId,
              type: 'private',
              targetUsername: state.fromUsername,
              targetNickname: state.fromNickname,
              targetAvatar: state.fromAvatar,
              lastMessage: '[图片]',
              lastMessageTime: Date.now(),
              unreadCount: isActiveConv ? (existingConv?.unreadCount ?? 0) : (existingConv?.unreadCount ?? 0) + 1,
              updatedAt: Date.now(),
            })
            window.dispatchEvent(new CustomEvent('file-receive-done', {
              detail: { transferId: msg.transferId },
            }))
            return
          } else {
            // Firefox/iOS 兼容模式：从内存构建 Blob 并触发下载
            const blob = new Blob(state.chunks as BlobPart[])
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = state.filename ?? 'file'
            a.click()
            // 延迟 revoke，确保下载触发后才释放
            setTimeout(() => URL.revokeObjectURL(url), 10_000)
          }

          incomingTransfers.delete(msg.transferId)
          const convId = getPrivateConvId(currentUser.username, state.fromUsername)
          unregisterTransfer(convId)

          sendWsMessage({
            type: 'FILE_SAVED',
            transferId: msg.transferId,
            messageId: state.messageId,
            toUsername: state.fromUsername,
          })

          const localMsg: Message = {
            id: state.messageId,
            conversationId: convId,
            conversationType: 'private',
            fromUsername: state.fromUsername,
            fromNickname: state.fromNickname,
            fromAvatar: state.fromAvatar,
            toUsername: currentUser.username,
            contentType: state.contentType === 'image' ? 'image' : 'file',
            content: '[已保存到本地]',
            filename: state.filename,
            fileSize: state.fileSize,
            status: 'sent',
            timestamp: Date.now(),
            createdAt: Date.now(),
          }
          addMessage(localMsg)

          const existingConv = useChatStore.getState().conversations.find(c => c.id === convId)
          const isActiveConv2 = useChatStore.getState().activeConversationId === convId
          upsertConversation({
            id: convId,
            type: 'private',
            targetUsername: state.fromUsername,
            targetNickname: state.fromNickname,
            targetAvatar: state.fromAvatar,
            lastMessage: `[${state.contentType === 'image' ? '图片' : '文件'}] ${state.filename ?? ''}`,
            lastMessageTime: Date.now(),
            unreadCount: isActiveConv2 ? (existingConv?.unreadCount ?? 0) : (existingConv?.unreadCount ?? 0) + 1,
            updatedAt: Date.now(),
          })

          window.dispatchEvent(new CustomEvent('file-receive-done', {
            detail: { transferId: msg.transferId, filename: state.filename },
          }))
        }
      } catch {
        if (state.writable) { try { await state.writable.abort() } catch { } }
        incomingTransfers.delete(msg.transferId)
        const convId = getPrivateConvId(currentUser.username, state.fromUsername)
        unregisterTransfer(convId)
        sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId: msg.transferId })
        window.dispatchEvent(new CustomEvent('file-receive-done', { detail: { transferId: msg.transferId, filename: state.filename } }))
      }
    }

    // ===== 发送方：收到 FILE_SAVED，更新消息状态为"已接收" =====
    if (msg.type === 'FILE_SAVED' && msg.transferId && msg.messageId) {
      const state = useChatStore.getState()
      for (const [convId, msgs] of Object.entries(state.messages)) {
        const found = msgs.find(m => m.id === msg.messageId)
        if (found) {
          // 图片消息 content 是 dataUrl，不追加文字；普通文件才追加"对方已成功接收"
          if (found.contentType !== 'image') {
            const newContent = found.content.includes('对方已成功接收')
              ? found.content
              : `${found.content} · 对方已成功接收`
            useChatStore.getState().updateMessageContent?.(msg.messageId, convId, newContent)
          }
          updateMessageStatus(msg.messageId, convId, 'received')
          break
        }
      }
    }

    // ===== 接收方：传输中断 =====
    // FILE_TRANSFER_ERROR 现在在 onmessage 中同步处理（onFileTransferError）
  }, [addMessage, updateMessageStatus, upsertConversation])
  handleIncomingRef.current = handleIncoming

  const send = useCallback((msg: WsMessage) => {
    if (wsInstance?.readyState === WebSocket.OPEN) {
      wsInstance.send(JSON.stringify(msg))
    }
  }, [])

  const disconnect = useCallback(() => {
    manualClose = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pingTimer) clearInterval(pingTimer)
    sendWsMessage({ type: 'PAGE_UNLOAD' })
    wsInstance?.close()
    wsInstance = null
  }, [])

  // 页面刷新/关闭前通知后端主动离开，让后端立即清锁而非等续传
  // pagehide 覆盖移动端/页面冻结场景（beforeunload 在这些场景可能不触发）
  useEffect(() => {
    function onBeforeUnload() {
      sendWsMessage({ type: 'PAGE_UNLOAD' })
    }
    function onPageHide() {
      sendWsMessage({ type: 'PAGE_UNLOAD' })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])




  return { send, connect, disconnect, isConnected: () => connectedRef.current }
}

export function sendWsMessage(msg: WsMessage): boolean {
  if (wsInstance?.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(msg))
    return true
  }
  return false
}

// 发送消息，如果 WebSocket 断开则等待重连后重试（最多 timeoutMs 毫秒）
export async function sendWsMessageWithRetry(msg: WsMessage, timeoutMs: number): Promise<boolean> {
  if (sendWsMessage(msg)) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200))
    if (sendWsMessage(msg)) return true
  }
  return false
}

// 等待 WebSocket 恢复 OPEN 状态，最多等 timeoutMs 毫秒
// 60s：给足重连时间，覆盖地铁/电梯等弱网场景下信号恢复慢的情况
export function waitForWsOpen(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (wsInstance?.readyState === WebSocket.OPEN) {
      resolve(true)
      return
    }
    let done = false
    const interval = setInterval(() => {
      if (wsInstance?.readyState === WebSocket.OPEN) {
        if (done) return
        done = true
        clearTimeout(timer)
        clearInterval(interval)
        resolve(true)
      }
    }, 200)
    const timer = setTimeout(() => {
      if (done) return
      done = true
      clearInterval(interval)   // 超时时必须清理 interval，否则持续轮询泄漏
      resolve(false)
    }, timeoutMs)
  })
}

// 等待指定传输的指定分片 ACK，超时返回 false
// 等待期间每 15 秒发一次 PING 保持 WebSocket 不被代理/负载均衡器因空闲断开
// WebSocket 断线时立即返回 false，不等超时，让外层尽快进入重连重发循环
export function waitForChunkAck(transferId: string, chunkIndex: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const key = `${transferId}_${chunkIndex}`
    let done = false
    function finish(ok: boolean) {
      if (done) return
      done = true
      clearTimeout(timer)
      clearInterval(keepaliveTimer)
      ackWaiters.delete(key)
      // 移除断线监听
      window.removeEventListener('ws-disconnected', onDisconnect)
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    // 等待期间定期发 PING，防止 Cloudflare/Render 等代理的空闲超时断开连接
    const keepaliveTimer = setInterval(() => {
      sendWsMessage({ type: 'PING' })
    }, 15_000)
    // WebSocket 断线时立即中断，不等 60s 超时
    function onDisconnect() { finish(false) }
    window.addEventListener('ws-disconnected', onDisconnect)
    ackWaiters.set(key, (ok: boolean) => finish(ok))
  })
}

// 带重连重试的 ACK 等待：发送消息后等 ACK，如果连接断开则自动重连并重发消息，
// 直到超时（timeoutMs）才返回 false
// sendFn 负责重新发送消息（chunk/END 等），在重连成功后调用
export async function waitForChunkAckResilient(
  transferId: string,
  chunkIndex: number,
  sendFn: () => boolean,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // 先确保 WebSocket 是 OPEN 状态
    if (wsInstance?.readyState !== WebSocket.OPEN) {
      const reconnected = await waitForWsOpen(60_000)
      if (!reconnected) return false
    }
    // 发消息
    sendFn()
    // 等 ACK，单片最多等 90s（接收方弱网下解密+写盘可能更慢）
    const acked = await waitForChunkAck(transferId, chunkIndex, Math.min(90_000, Math.max(0, deadline - Date.now())))
    if (acked) return true
    if (Date.now() >= deadline) return false
  }
  return false
}

// 用户点"接受"后由 UI 层调用（在 showSaveFilePicker 成功后）
// writable 为 null 表示使用 Firefox 兼容模式（内存收集后下载）
export function acceptTransfer(transferId: string, convId: string, writable: FileSystemWritableFileStream | null): void {
  const meta = pendingTransfers.get(transferId)
  if (!meta) return
  pendingTransfers.delete(transferId)
  incomingTransfers.set(transferId, { ...meta, writable, chunks: [] })
  registerTransfer(convId)
  // 发 -1 ACK，通知发送方开始发分片
  sendWsMessage({ type: 'FILE_CHUNK_ACK', transferId, chunkIndex: -1 })
  window.dispatchEvent(new CustomEvent('file-receive-start', {
    detail: {
      transferId,
      filename: meta.filename,
      fileSize: meta.fileSize,
      totalChunks: meta.totalChunks,
      fromNickname: meta.fromNickname ?? meta.fromUsername,
    },
  }))
}

// 用户点"拒绝"（或 showSaveFilePicker 被取消）后由 UI 层调用
export function rejectTransfer(transferId: string, convId?: string): void {
  pendingTransfers.delete(transferId)
  if (convId) activeTransferConvs.delete(convId)
  sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
}

// 接收方在传输进行中点"终止"时调用（已接受、正在接收分片阶段）
// 负责：关闭文件句柄、清理 incomingTransfers、释放传输锁、通知发送方
export function cancelIncomingTransfer(transferId: string, currentUsername: string): void {
  const state = incomingTransfers.get(transferId)
  if (state) {
    if (state.writable) state.writable.abort().catch(() => {})
    incomingTransfers.delete(transferId)
    const convId = getPrivateConvId(currentUsername, state.fromUsername)
    unregisterTransfer(convId)
  }
  sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
}

// 文件传输开始时调用，传入 convId 标记该对话传输活跃
export function registerTransfer(convId: string): void {
  activeTransferConvs.add(convId)
}

// 文件传输结束时调用（成功/失败/取消均需调用）
export function unregisterTransfer(convId: string): void {
  activeTransferConvs.delete(convId)
  sendingFileConvs.delete(convId)
}

// 主动发送文件开始时调用
export function registerSendTransfer(convId: string): void {
  sendingFileConvs.add(convId)
  activeTransferConvs.add(convId)
}

// 主动发送文件结束时调用
export function unregisterSendTransfer(convId: string): void {
  sendingFileConvs.delete(convId)
  activeTransferConvs.delete(convId)
}

// 检查指定对话是否有活跃传输（收发都算），用于阻止同一对话内并发发送
export function hasActiveTransferInConv(convId: string): boolean {
  return activeTransferConvs.has(convId)
}