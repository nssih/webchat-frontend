import { create } from 'zustand'
import type { Conversation, Message } from '../types'
import { db } from '../db'

// CHAT_DELIVERY 可能在对应消息写入 store 之前到达（普通文件传完才写消息），先暂存
const pendingDeliveries = new Map<string, Message['status']>()

export function setPendingDelivery(msgId: string, status: Message['status']) {
  pendingDeliveries.set(msgId, status)
}

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  setConversations: (convs: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  resetAll: () => void
  addMessage: (msg: Message) => void
  updateMessageStatus: (msgId: string, convId: string, status: Message['status']) => void
  updateMessageContent: (msgId: string, convId: string, content: string) => void
  deleteMessage: (msgId: string, convId: string) => void
  loadMessages: (conversationId: string) => Promise<void>
  loadConversations: () => Promise<void>
  upsertConversation: (conv: Conversation) => void
  removeConversation: (convId: string) => void
  clearConversation: (convId: string) => void
  clearUnread: (convId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  resetAll: () => set({ conversations: [], messages: {}, activeConversationId: null }),

  addMessage: (msg) => {
    set((state) => {
      const existing = state.messages[msg.conversationId] ?? []
      if (existing.some(m => m.id === msg.id)) return {}
      // 按 timestamp 插入到正确位置，保持列表有序
      const next = [...existing]
      let i = next.length
      while (i > 0 && next[i - 1].timestamp > msg.timestamp) i--
      next.splice(i, 0, msg)
      return {
        messages: {
          ...state.messages,
          [msg.conversationId]: next,
        },
      }
    })
    // Blob URL 是内存临时引用，刷新后失效，不存入 IndexedDB
    const toStore = (msg.contentType === 'image' || msg.contentType === 'file') && msg.content.startsWith('blob:')
      ? { ...msg, content: '' }
      : msg
    db.saveMessage(toStore)
    // 消息写入后，应用在它到达前暂存的 CHAT_DELIVERY 状态
    const pending = pendingDeliveries.get(msg.id)
    if (pending) {
      pendingDeliveries.delete(msg.id)
      get().updateMessageStatus(msg.id, msg.conversationId, pending)
    }
  },

  updateMessageStatus: (msgId, convId, status) => {
    set((state) => {
      const msgs = state.messages[convId] ?? []
      const updatedMsgs = msgs.map((m) => (m.id === msgId ? { ...m, status } : m))
      // 如果是最后一条消息，同步更新会话的状态
      const convs = state.conversations.map(c => {
        if (c.id !== convId) return c
        const lastMsg = updatedMsgs[updatedMsgs.length - 1]
        if (lastMsg?.id === msgId) {
          return { ...c, lastMessageStatus: status as Conversation['lastMessageStatus'] }
        }
        return c
      })
      return {
        messages: { ...state.messages, [convId]: updatedMsgs },
        conversations: convs,
      }
    })
    db.updateMessageStatus(msgId, status)
  },

  deleteMessage: (msgId, convId) => {
    set((state) => {
      const msgs = state.messages[convId] ?? []
      return {
        messages: {
          ...state.messages,
          [convId]: msgs.filter((m) => m.id !== msgId),
        },
      }
    })
    db.deleteMessage(msgId)
  },

  updateMessageContent: (msgId, convId, content) => {
    set((state) => {
      const msgs = state.messages[convId] ?? []
      return {
        messages: {
          ...state.messages,
          [convId]: msgs.map((m) => (m.id === msgId ? { ...m, content } : m)),
        },
      }
    })
    db.updateMessageContent(msgId, content)
  },

  loadMessages: async (conversationId) => {
    const msgs = await db.getMessages(conversationId)
    set((state) => {
      const inMemory = state.messages[conversationId] ?? []
      const dbIds = new Set(msgs.map(m => m.id))
      const memoryOnly = inMemory.filter(m => !dbIds.has(m.id))
      const merged = [...msgs, ...memoryOnly].sort((a, b) => {
        const tDiff = a.timestamp - b.timestamp
        if (tDiff !== 0) return tDiff
        // 时间戳相同时用 seq 做二次排序
        if (a.seq != null && b.seq != null) return a.seq - b.seq
        return 0
      })
      return { messages: { ...state.messages, [conversationId]: merged } }
    })
  },

  loadConversations: async () => {
    const convs = await db.getConversations()
    set((state) => {
      const dbIds = new Set(convs.map(c => c.id))
      // 保留内存里有但 DB 里没有的会话（WS 刚推来尚未持久化的）
      const memoryOnly = state.conversations.filter(c => !dbIds.has(c.id))
      const merged = [...convs, ...memoryOnly].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      return { conversations: merged }
    })
  },

  upsertConversation: (conv) => {
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id)
      const next = [...state.conversations]
      let merged: Conversation
      if (idx >= 0) {
        const old = next[idx]
        merged = {
          ...old,
          ...conv,
          targetNickname: conv.targetNickname ?? old.targetNickname,
          targetAvatar: conv.targetAvatar ?? old.targetAvatar,
          groupId: conv.groupId ?? old.groupId,
          lastMessage: conv.lastMessage ?? old.lastMessage,
          lastMessageTime: conv.lastMessageTime ?? old.lastMessageTime,
          lastMessageStatus: conv.lastMessageStatus ?? old.lastMessageStatus,
          lastMessageMine: conv.lastMessageMine ?? old.lastMessageMine,
        }
        next[idx] = merged
      } else {
        merged = conv
        next.unshift(merged)
      }
      next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      db.saveConversation(merged)
      return { conversations: next }
    })
  },

  clearUnread: (convId) => {
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === convId)
      if (idx < 0) return {}
      const next = [...state.conversations]
      next[idx] = { ...next[idx], unreadCount: 0 }
      db.saveConversation(next[idx])
      return { conversations: next }
    })
  },

  // 仅从会话列表移除（不删消息），用于用户主动隐藏会话入口
  removeConversation: (convId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== convId),
    }))
    db.deleteConversation(convId)
  },

  // 同时删除会话和消息（群解散/成员被移除等强制清理场景）
  clearConversation: (convId) => {
    set((state) => {
      const msgs = { ...state.messages }
      delete msgs[convId]
      return {
        conversations: state.conversations.filter((c) => c.id !== convId),
        messages: msgs,
      }
    })
    db.deleteConversation(convId)
    db.deleteMessagesByConversation(convId)
  },
}))