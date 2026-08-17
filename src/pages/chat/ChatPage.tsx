import React, { useEffect, useRef, useState, useCallback } from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { sendWsMessage, sendWsMessageWithRetry, waitForChunkAckResilient, registerSendTransfer, unregisterSendTransfer, hasActiveTransferInConv } from '../../hooks/useWebSocket'
import type { Message, Conversation, WsMessage } from '../../types'
import { generateId, getApiError, formatFileSize } from '../../utils'
import MessageBubble from '../../components/chat/MessageBubble'
import { getPrivateKey } from '../../crypto/keyStore'
import { getPublicKey, refreshPublicKey } from '../../crypto/publicKeyCache'
import { encryptMessage, encryptWithGroupKey } from '../../crypto/e2e'
import { getGroupKey } from '../../crypto/groupKeyCache'

export default function ChatPage() {
  const { convId } = useParams<{ convId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const conv: Conversation | undefined = location.state?.conv

  const user = useAuthStore(s => s.user)!
  const { messages, loadMessages, addMessage, updateMessageStatus, upsertConversation, clearUnread, clearConversation, setActiveConversation } = useChatStore()
  const storeConv = useChatStore(s => s.conversations.find(c => c.id === convId))

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? text.length
    const end = ta.selectionEnd ?? text.length
    const newText = text.slice(0, start) + emojiData.emoji + text.slice(end)
    setText(newText)
    setShowEmojiPicker(false)
    setTimeout(() => {
      ta.focus()
      const pos = start + emojiData.emoji.length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }, [text])
  const [atBottom, setAtBottom] = useState(true)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  // true = 对方发来未读新消息；false = 只是往上翻历史，底部有更多内容
  const [newMsgIsFromOther, setNewMsgIsFromOther] = useState(false)
  const prevMsgCountRef = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [noKeyWarning, setNoKeyWarning] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const currentTransferIdRef = useRef<string | null>(null)
  // message id → DOM element，用于引用块点击后跳转
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  // 监听发送方文件传输错误（仅需清理 currentTransferIdRef）
  useEffect(() => {
    function onTransferError(e: Event) {
      const { transferId } = (e as CustomEvent).detail
      if (currentTransferIdRef.current === transferId) {
        currentTransferIdRef.current = null
        // 所有 sending 状态的消息（图片/文件）标为 failed
        if (convId) {
          const msgs = useChatStore.getState().messages[convId] ?? []
          msgs.filter(m => m.status === 'sending').forEach(m => updateMessageStatus(m.id, convId, 'failed'))
        }
      }
    }
    window.addEventListener('file-transfer-error', onTransferError)
    return () => window.removeEventListener('file-transfer-error', onTransferError)
  }, [convId, updateMessageStatus])

  // 文件传输中阻止页面意外刷新，弹出确认提示
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (currentTransferIdRef.current !== null) {
        // 尽量通知后端清理（浏览器可能阻止发送，但 try 一下）
        try { sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId: currentTransferIdRef.current }) } catch {}
        unregisterSendTransfer(convId!)
        currentTransferIdRef.current = null
        e.preventDefault()
        e.returnValue = '当前有文件正在传输中，刷新将中断传输'
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [convId])

  // 组件卸载（离开聊天页/刷新）时清理传输状态，防止后端残留导致"已有文件在传输中"
  useEffect(() => {
    return () => {
      const transferId = currentTransferIdRef.current
      if (transferId) {
        sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
        unregisterSendTransfer(convId!)
        currentTransferIdRef.current = null
      }
    }
  }, [convId])

  // 页面加载时把卡在 sending 的消息标为 failed（刷新后传输中断，状态无法恢复）
  useEffect(() => {
    if (!convId) return
    const msgs = useChatStore.getState().messages[convId] ?? []
    msgs.filter(m => m.status === 'sending').forEach(m => updateMessageStatus(m.id, convId, 'failed'))
  }, [convId, updateMessageStatus])

  const convMessages = messages[convId!] ?? []

  // 软键盘处理：监听 visualViewport 高度变化，用 CSS var 驱动消息区 padding-bottom
  // 不用 translateY/height 硬改，避免和 Safari 自身的滚动行为打架产生抖动
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let rafId = 0
    function onViewportChange() {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!pageRef.current) return
        // windowHeight - viewportHeight = 键盘高度
        const keyboardHeight = Math.max(0, window.innerHeight - vv!.height)
        pageRef.current.style.setProperty('--keyboard-h', `${keyboardHeight}px`)
        if (keyboardHeight > 0) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        }
      })
    }

    vv.addEventListener('resize', onViewportChange)
    const page = pageRef.current
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      cancelAnimationFrame(rafId)
      page?.style.removeProperty('--keyboard-h')
    }
  }, [])

  useEffect(() => {
    if (convId) {
      setActiveConversation(convId)
      loadMessages(convId)
      clearUnread(convId)
      setAtBottom(true)
      setHasNewMsg(false)
      setNewMsgIsFromOther(false)
      prevMsgCountRef.current = 0
    }
    return () => {
      setActiveConversation(null)
    }
  }, [convId, loadMessages, setActiveConversation, clearUnread])
  // 监听滚动位置，判断是否在底部
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = container!
      setAtBottom(scrollHeight - scrollTop - clientHeight < 60)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (convId) clearUnread(convId)
    const currentCount = convMessages.length
    const prevCount = prevMsgCountRef.current
    const newMsgs = convMessages.slice(prevCount)
    // 判断新增的消息里是否有对方发来的
    const hasOtherNewMsg = newMsgs.some(m => m.fromUsername !== user.username)
    prevMsgCountRef.current = currentCount

    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setHasNewMsg(false)
      setNewMsgIsFromOther(false)
    } else if (newMsgs.length > 0) {
      // 只有真正新增了消息才触发提示（排除初始加载和 convId 切换时的批量写入）
      if (prevCount > 0) {
        setHasNewMsg(true)
        if (hasOtherNewMsg) setNewMsgIsFromOther(true)
      }
    }
    // 发已读回执：首次加载时对所有非自己的消息批量发送，之后只对最新一条发送
    if (!convId || !user) return
    const msgs = useChatStore.getState().messages[convId] ?? []
    const groupId = msgs[0]?.conversationType === 'group'
      ? (useChatStore.getState().conversations.find(c => c.id === convId)?.groupId)
      : undefined
    if (prevCount === 0) {
      // 首次加载：批量对所有非自己的消息发回执
      for (const m of msgs) {
        if (m.fromUsername !== user.username) {
          sendWsMessage({ type: 'MESSAGE_READ', messageId: m.id, toUsername: m.fromUsername, groupId })
        }
      }
    } else {
      // 新消息到达：只对最新一条发回执
      const latest = msgs[msgs.length - 1]
      if (latest && latest.fromUsername !== user.username) {
        sendWsMessage({ type: 'MESSAGE_READ', messageId: latest.id, toUsername: latest.fromUsername, groupId })
      }
    }
  }, [convMessages.length, convId, user, atBottom, clearUnread])

  function parseConvId(): { type: 'private' | 'group'; targetUsername: string } {
    if (!convId) return { type: 'private', targetUsername: '' }
    if (convId.startsWith('group_')) {
      return { type: 'group', targetUsername: convId.slice(6) }
    }
    // 优先从导航 state 的 conv 对象取（最可靠，无歧义）
    if (conv?.targetUsername) return { type: 'private', targetUsername: conv.targetUsername }
    // 其次从 store 里取（从会话列表进入时已存有 targetUsername）
    if (storeConv?.targetUsername) return { type: 'private', targetUsername: storeConv.targetUsername }
    // 降级：从 convId 字符串还原。格式 private_{sorted[0]}_{sorted[1]}
    // 优先尝试自己排在前（my + '_' + target）
    const withoutPrefix = convId.slice('private_'.length)
    const myUsername = user.username
    const suffix = '_' + myUsername
    if (withoutPrefix.startsWith(myUsername + '_')) {
      return { type: 'private', targetUsername: withoutPrefix.slice(myUsername.length + 1) }
    }
    if (withoutPrefix.endsWith(suffix)) {
      return { type: 'private', targetUsername: withoutPrefix.slice(0, withoutPrefix.length - suffix.length) }
    }
    return { type: 'private', targetUsername: withoutPrefix }
  }

  function buildConversation(msg: Message): Conversation {
    const isMine = msg.fromUsername === user.username
    return {
      id: convId!,
      type: convType,
      targetUsername: conv?.targetUsername ?? storeConv?.targetUsername ?? convTarget,
      targetNickname: conv?.targetNickname ?? storeConv?.targetNickname ?? null,
      targetAvatar: conv?.targetAvatar ?? storeConv?.targetAvatar ?? null,
      groupId: convType === 'group' ? (groupIdFromConvId() ?? storeConv?.groupId) : undefined,
      lastMessage: msg.contentType === 'text' ? msg.content : `[${msg.contentType}]`,
      lastMessageTime: msg.timestamp,
      lastMessageStatus: isMine ? msg.status : 'received',
      lastMessageMine: isMine,
      unreadCount: 0,
      updatedAt: Date.now(),
    }
  }

  async function encryptContent(
    type: 'private' | 'group',
    targetUsername: string,
    content: string,
  ): Promise<{ encrypted: string; blocked: boolean }> {
    if (type === 'private') {
      const myPrivKey = await getPrivateKey(user.username)
      let theirPubKey = await getPublicKey(targetUsername)
      if (!myPrivKey || !theirPubKey) {
        setNoKeyWarning('对方尚未设置加密，暂时无法发送消息，请稍后重试')
        return { encrypted: content, blocked: true }
      }
      setNoKeyWarning(null)
      try {
        const encrypted = await encryptMessage(myPrivKey, theirPubKey, content)
        return { encrypted, blocked: false }
      } catch {
        // 加密失败，可能是缓存了旧公钥，强制重拉后重试一次
        theirPubKey = await refreshPublicKey(targetUsername)
        if (!theirPubKey) return { encrypted: content, blocked: true }
        try {
          const encrypted = await encryptMessage(myPrivKey, theirPubKey, content)
          return { encrypted, blocked: false }
        } catch {
          return { encrypted: content, blocked: true }
        }
      }
    }
    const groupId = groupIdFromConvId()
    if (groupId === null) return { encrypted: content, blocked: true }
    const groupKey = await getGroupKey(groupId)
    if (!groupKey) {
      setNoKeyWarning('群密钥加载中，请稍后重试')
      return { encrypted: content, blocked: true }
    }
    setNoKeyWarning(null)
    const encrypted = await encryptWithGroupKey(groupKey, content)
    return { encrypted, blocked: false }
  }

  function groupIdFromConvId(): number | null {
    // 优先从导航 state 取（GroupPage 直接跳转时携带）
    const stateGroupId = (location.state as { groupId?: number } | null)?.groupId
    if (stateGroupId != null) return stateGroupId
    // 其次从 conv 对象取（含 groupId 字段）
    const convGroupId = (location.state as { conv?: { groupId?: number } } | null)?.conv?.groupId
    if (convGroupId != null) return convGroupId
    // 最后从会话 store 取（从会话列表进入时，Conversation 里存有 groupId）
    const storeGroupId = storeConv?.groupId ?? null
    return storeGroupId
  }

  function handleScrollToMessage(messageId: string) {
    const el = msgRefsMap.current.get(messageId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('msg-highlight')
      setTimeout(() => el.classList.remove('msg-highlight'), 1500)
    }
  }

  async function sendText() {
    const plainContent = text.trim()
    if (!plainContent || !convId) return
    setText('')
    const currentReplyTo = replyTo
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const msgId = generateId()
    const { encrypted, blocked } = await encryptContent(convType, convTarget, plainContent)
    if (blocked) {
      setText(plainContent)
      return
    }
    setReplyTo(null)
    const msg: Message = {
      id: msgId,
      conversationId: convId,
      conversationType: convType,
      fromUsername: user.username,
      fromNickname: user.nickname,
      fromAvatar: user.avatar,
      toUsername: convType === 'private' ? convTarget : undefined,
      toGroupName: convType === 'group' ? convTarget : undefined,
      contentType: 'text',
      content: plainContent,
      status: 'sending',
      timestamp: Date.now(),
      createdAt: Date.now(),
      replyTo: currentReplyTo ? {
        messageId: currentReplyTo.id,
        sender: currentReplyTo.fromNickname || currentReplyTo.fromUsername,
        content: currentReplyTo.contentType === 'text'
          ? currentReplyTo.content.slice(0, 80)
          : `[${currentReplyTo.contentType}]`,
      } : undefined,
    }
    addMessage(msg)
    upsertConversation(buildConversation(msg))
    const wsMsg: WsMessage = {
      type: convType === 'group' ? 'GROUP_CHAT' : 'CHAT',
      messageId: msgId,
      toUsername: convType === 'private' ? convTarget : undefined,
      toGroupName: convType === 'group' ? convTarget : undefined,
      groupId: convType === 'group' ? (groupIdFromConvId() ?? undefined) : undefined,
      contentType: 'text',
      content: encrypted,
      replyToId: currentReplyTo?.id,
      replyToSender: currentReplyTo
        ? (currentReplyTo.fromNickname || currentReplyTo.fromUsername)
        : undefined,
      replyToContent: currentReplyTo
        ? (currentReplyTo.contentType === 'text'
            ? currentReplyTo.content.slice(0, 80)
            : `[${currentReplyTo.contentType}]`)
        : undefined,
    }
    if (!sendWsMessage(wsMsg)) {
      sendWsMessageWithRetry(wsMsg, 30_000).then(sent => {
        if (!sent) updateMessageStatus(msgId, convId, 'failed')
      })
    }
  }

  async function handleFileUpload(file: File) {
    if (!convId) return
    if (convType !== 'private') return

    // 已有进行中的发送时禁止并发发送
    if (hasActiveTransferInConv(convId)) {
      alert('当前有文件正在发送中，请等待完成后再次发送')
      return
    }

    const MAX = 2 * 1024 * 1024 * 1024  // 2GB
    const IMAGE_INLINE_MAX = 5 * 1024 * 1024  // 5MB 以内的图片走内联发送

    if (file.size === 0) {
      alert('不支持发送空文件')
      return
    }
    if (file.size > MAX) {
      alert('文件大小不能超过 2GB')
      return
    }

    // 图片 ≤ 5MB：先在本地读出 dataUrl 供发送方自己预览，
    // 然后和大图片一样走分片传输，接收方会静默自动接收并存 IndexedDB
    if (file.type.startsWith('image/') && file.size <= IMAGE_INLINE_MAX) {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      const SUB = 8192
      for (let j = 0; j < bytes.length; j += SUB) {
        binary += String.fromCharCode(...bytes.subarray(j, j + SUB))
      }
      const dataUrl = `data:${file.type};base64,${btoa(binary)}`
      // 发送方本地用 dataUrl 预览（存 IndexedDB，刷新后也在）
      // msgId 由后续分片逻辑生成，这里只是提前把 dataUrl 附加给文件对象供后续使用
      ;(file as any).__previewDataUrl = dataUrl
      // 不 return，fall-through 到分片传输逻辑
    }

    // 大文件警告（超过 200MB 提示）
    if (file.size > 200 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(0)
      const ok = confirm(
        `⚠️ 你即将发送一个 ${sizeMB}MB 的大文件。\n\n` +
        `请注意：\n` +
        `• 传输期间请保持网络通畅，不要关闭此页面\n` +
        `• 对方也必须保持在线，否则传输中断需重新发送\n` +
        `• 传输时间取决于双方网速，可能需要数分钟\n` +
        `• 接收方需在弹出的保存对话框中选择保存位置\n\n` +
        `确定发送吗？`
      )
      if (!ok) return
    }

    setUploading(true)
    registerSendTransfer(convId)
    const transferId = `${user.username}_${generateId()}`
    currentTransferIdRef.current = transferId
    const msgId = generateId()
    // 128KB 每片：原始数据 → Base64（×1.33）→ AES-GCM 加密 → 再 Base64（×1.33）+ IV:tag 开销
    // 128KB × 1.33 × 1.33 + 0.1KB ≈ 227KB，后端 maxTextMessageBufferSize=256KB，留有余量
    // 128KB 是速度与兼容性的平衡点：比 64KB 片数少一半（更快），比 230KB 内存压力更小（更稳）
    const CHUNK_SIZE = 128 * 1024
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const sendStart = Date.now()
    const toDisplayName = storeConv?.targetNickname || storeConv?.targetUsername || convTarget

    window.dispatchEvent(new CustomEvent('file-send-progress', {
      detail: { transferId, sent: 0, total: totalChunks, startedAt: sendStart, toNickname: toDisplayName },
    }))

    try {
      const myPrivKey = await getPrivateKey(user.username)
      const theirPubKey = await getPublicKey(convTarget)
      if (!myPrivKey || !theirPubKey) {
        setNoKeyWarning('对方尚未设置加密，暂时无法发送文件，请稍后重试')
        return
      }
      setNoKeyWarning(null)

      const isImage = file.type.startsWith('image/')
      const contentType = isImage ? 'image' : 'file'
      const previewDataUrl: string | undefined = (file as any).__previewDataUrl

      // 图片传输开始前先显示预览（status: sending），让用户立刻看到图片
      // 普通文件不预览，传完后才写入
      if (isImage && previewDataUrl) {
        const previewMsg: Message = {
          id: msgId,
          conversationId: convId,
          conversationType: 'private',
          fromUsername: user.username,
          fromNickname: user.nickname,
          fromAvatar: user.avatar,
          toUsername: convTarget,
          contentType: 'image',
          content: previewDataUrl,
          filename: file.name,
          fileSize: file.size,
          status: 'sending',
          timestamp: Date.now(),
          createdAt: Date.now(),
        }
        addMessage(previewMsg)
        upsertConversation(buildConversation(previewMsg))
      }

      // 使用 waitForChunkAckResilient 让发送方断线重连后重发 START，
      // 接收方会检测已接受的传输并直接回 ACK-1，不会重复弹窗
      // 超时 10 分钟：给接收方足够的断线重连 + 弱网恢复 + 选保存位置时间
      sendWsMessage({
        type: 'FILE_TRANSFER_START',
        transferId,
        messageId: msgId,
        toUsername: convTarget,
        filename: file.name,
        fileSize: file.size,
        contentType,
        totalChunks,
      })
      const startAcked = await waitForChunkAckResilient(
        transferId, -1,
        () => sendWsMessage({
          type: 'FILE_TRANSFER_START',
          transferId,
          messageId: msgId,
          toUsername: convTarget,
          filename: file.name,
          fileSize: file.size,
          contentType,
          totalChunks,
        }),
        600_000  // 10 分钟
      )
      if (!startAcked) {
        if (currentTransferIdRef.current !== null) {
          sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
          window.dispatchEvent(new CustomEvent('file-transfer-error', {
            detail: { transferId, message: '对方未响应，文件发送已取消' },
          }))
        }
        return
      }

      // 逐片读取 → 加密 → 发送 → 等 ACK
      // 断线时自动重连重试，不加提示
      // 每片只加密一次，加密结果缓存供断线重试复用（避免重复读取文件）
      const encryptedChunkCache = new Map<number, string>()
      for (let i = 0; i < totalChunks; i++) {
        let encryptedChunk = encryptedChunkCache.get(i)
        if (!encryptedChunk) {
          const start = i * CHUNK_SIZE
          const slice = file.slice(start, start + CHUNK_SIZE)
          const buf = await slice.arrayBuffer()

          const bytes = new Uint8Array(buf)
          let b64 = ''
          const SUB = 8192
          for (let j = 0; j < bytes.length; j += SUB) {
            b64 += String.fromCharCode(...bytes.subarray(j, j + SUB))
          }
          b64 = btoa(b64)

          encryptedChunk = await encryptMessage(myPrivKey, theirPubKey, b64)
          // 只缓存当前片的加密结果（重试用），发完下一片时释放，避免大文件占满内存
          encryptedChunkCache.clear()
          encryptedChunkCache.set(i, encryptedChunk)
        }

        const acked = await waitForChunkAckResilient(
          transferId, i,
          () => sendWsMessage({
            type: 'FILE_CHUNK',
            transferId,
            chunkIndex: i,
            totalChunks,
            fileData: encryptedChunk!,
          }),
          300_000  // 每片最多等 5 分钟（含断线重连，覆盖地铁/电梯等长时间断网场景）
        )
        if (!acked) {
          sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
          if (currentTransferIdRef.current !== null) {
            window.dispatchEvent(new CustomEvent('file-transfer-error', {
              detail: { transferId, message: '传输中断，请检查网络后重试' },
            }))
          }
          return
        }

        // 更新发送进度
        window.dispatchEvent(new CustomEvent('file-send-progress', {
          detail: { transferId, sent: i + 1, total: totalChunks, startedAt: sendStart, toNickname: toDisplayName },
        }))
      }

      // 发送 FILE_TRANSFER_END 告知后端传输完成（转发给接收方）
      sendWsMessage({ type: 'FILE_TRANSFER_END', transferId, messageId: msgId })
      window.dispatchEvent(new CustomEvent('file-send-done', {
        detail: { transferId, filename: file.name },
      }))

      if (isImage && previewDataUrl) {
        // 图片消息已在传输开始时写入气泡，只需升级状态为 sent
        updateMessageStatus(msgId, convId, 'sent')
      } else {
        // 普通文件：传完后写入气泡
        const msg: Message = {
          id: msgId,
          conversationId: convId,
          conversationType: 'private',
          fromUsername: user.username,
          fromNickname: user.nickname,
          fromAvatar: user.avatar,
          toUsername: convTarget,
          contentType: 'text',
          content: `[文件] ${file.name} (${formatFileSize(file.size)})`,
          filename: file.name,
          fileSize: file.size,
          status: 'sent',
          timestamp: Date.now(),
          createdAt: Date.now(),
        }
        addMessage(msg)
        upsertConversation(buildConversation(msg))
      }
    } catch (err) {
      sendWsMessage({ type: 'FILE_TRANSFER_ERROR', transferId })
      window.dispatchEvent(new CustomEvent('file-transfer-error', {
        detail: { transferId, message: getApiError(err) },
      }))
    } finally {
      currentTransferIdRef.current = null
      unregisterSendTransfer(convId)
      setUploading(false)
    }
  }

  function handleClearHistory() {
    setShowMenu(false)
    if (!convId) return
    if (!confirm('确定清除此会话的全部聊天记录？清除后无法恢复。')) return
    clearConversation(convId)
    navigate('/chat', { replace: true })
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    // 自动伸展高度：先重置再撑开，避免缩不回去
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setReplyTo(null)
      return
    }
    // 触摸设备（手机/平板）上 Enter 键是换行键，不触发发送
    // 桌面设备上 Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
      e.preventDefault()
      sendText().catch(() => {})
    }
  }

  const { type: convType, targetUsername: convTarget } = parseConvId()

  const title = storeConv?.targetNickname || storeConv?.targetUsername
    || conv?.targetNickname || conv?.targetUsername
    || convId || '聊天'

  return (
    <div className="chat-page" ref={pageRef}>
      <div className="chat-header">
        <button className="icon-btn" onClick={() => navigate('/chat', { replace: true })}>←</button>
        <div className="chat-header-info">
          <span className="chat-header-name">{title}</span>
        </div>
        <button className="icon-btn" onClick={() => setShowMenu(v => !v)}>⋮</button>
      </div>

      {showMenu && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="context-menu" onClick={e => e.stopPropagation()}>
            <button className="danger" onClick={handleClearHistory}>清除聊天记录</button>
            <button onClick={() => setShowMenu(false)}>取消</button>
          </div>
        </div>
      )}

      {noKeyWarning && (
        <div className="encryption-warning">
          ⚠️ {noKeyWarning}
        </div>
      )}

      <div className="chat-messages" ref={messagesContainerRef}>
        {convMessages.map(msg => (
          <div
            key={msg.id}
            ref={el => { if (el) msgRefsMap.current.set(msg.id, el); else msgRefsMap.current.delete(msg.id) }}
          >
            <MessageBubble
              msg={msg}
              isMine={msg.fromUsername === user.username}
              onReply={m => { setReplyTo(m); textareaRef.current?.focus() }}
              onScrollTo={handleScrollToMessage}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {hasNewMsg && (
        <button
          className={`new-msg-hint${newMsgIsFromOther ? ' new-msg-hint--unread' : ''}`}
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            setHasNewMsg(false)
            setNewMsgIsFromOther(false)
          }}
        >
          {newMsgIsFromOther ? '有新消息 ↓' : '回到底部 ↓'}
        </button>
      )}

      <div className="chat-input-area">
        {replyTo && (
          <div className="reply-preview">
            <div className="reply-preview-body">
              <span className="reply-preview-sender">{replyTo.fromNickname || replyTo.fromUsername}</span>
              <span className="reply-preview-content">
                {replyTo.contentType === 'text' ? replyTo.content.slice(0, 60) : `[${replyTo.contentType}]`}
              </span>
            </div>
            <button className="reply-preview-cancel" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        {convType === 'private' && (
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="发送文件" disabled={uploading}>
            +
          </button>
        )}
        <button
          className="icon-btn emoji-btn"
          onClick={() => setShowEmojiPicker(v => !v)}
          title="表情"
        >
          😊
        </button>
        {showEmojiPicker && (
          <>
            <div className="emoji-backdrop" onClick={() => setShowEmojiPicker(false)} />
            <div className="emoji-picker-wrap">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.AUTO}
                lazyLoadEmojis
                skinTonesDisabled
                searchPlaceholder="搜索表情..."
                width="min(300px, calc(100vw - 32px))"
                height={360}
              />
            </div>
          </>
        )}
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          maxLength={5000}
        />
        <button
          className="btn-send"
          onClick={() => sendText().catch(() => {})}
          disabled={!text.trim()}
        >
          发送
        </button>
        {convType === 'private' && (
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }}
          />
        )}
      </div>
    </div>
  )
}