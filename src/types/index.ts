// 服务端数据类型
export interface User {
  id: number
  uid: string
  username: string
  nickname: string | null
  avatar: string | null
  publicKey?: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface GroupMember {
  id: number
  uid: string
  username: string
  nickname: string | null
  avatar: string | null
}

export interface Group {
  id: number
  name: string
  avatar: string | null
  owner: User
  members: GroupMember[]
  memberCount: number
  createdAt: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
}

// 本地消息类型（存在 IndexedDB）
export type MessageContentType = 'text' | 'image' | 'file'
export type MessageStatus = 'sending' | 'sent' | 'received' | 'read' | 'failed' | 'offline'
export type ConversationType = 'private' | 'group'

export interface Message {
  id: string
  conversationId: string
  conversationType: ConversationType
  fromUsername: string
  fromNickname: string | null
  fromAvatar: string | null
  toUsername?: string
  toGroupName?: string
  contentType: MessageContentType
  content: string
  filename?: string
  fileSize?: number
  status: MessageStatus
  timestamp: number
  seq?: number
  createdAt: number
  replyTo?: { messageId: string; sender: string; content: string }
}

export interface Conversation {
  id: string
  type: ConversationType
  targetUsername: string   // 私聊对方 username 或群名
  targetNickname: string | null
  targetAvatar: string | null
  groupId?: number         // 群聊时的数字 ID，用于加密
  lastMessage: string | null
  lastMessageTime: number | null
  lastMessageStatus?: 'sending' | 'sent' | 'received' | 'read' | 'failed' | 'offline' | 'incoming'  // incoming = 对方发来的
  lastMessageMine?: boolean  // 最后一条是否是自己发的
  unreadCount: number
  updatedAt: number
}

// WebSocket 消息类型
export type WsMessageType =
  | 'CHAT' | 'GROUP_CHAT' | 'PING'
  | 'CHAT_DELIVERY' | 'NEW_MESSAGE' | 'PONG' | 'ERROR'
  | 'USER_ONLINE' | 'USER_OFFLINE' | 'GROUP_KEY_ROTATE'
  | 'GROUP_DISSOLVED'
  | 'FILE_TRANSFER_START' | 'FILE_CHUNK' | 'FILE_CHUNK_ACK'
  | 'FILE_TRANSFER_END' | 'FILE_TRANSFER_ERROR' | 'FILE_SAVED'
  | 'MESSAGE_READ' | 'MESSAGE_RECEIVED' | 'PAGE_UNLOAD'
  | 'GROUP_MEMBER_ADDED'

export interface WsMessage {
  type: WsMessageType
  messageId?: string
  status?: string
  toUsername?: string
  toGroupName?: string
  groupId?: number
  contentType?: MessageContentType
  content?: string
  filename?: string
  fileSize?: number
  fileData?: string
  fromUsername?: string
  fromNickname?: string
  fromAvatar?: string
  timestamp?: number
  seq?: number
  // 分片传输专用
  transferId?: string
  chunkIndex?: number
  totalChunks?: number
  // GROUP_MEMBER_ADDED 专用：JSON 序列化的 GroupResponse
  groupData?: string
  // 离线群消息投递时携带，表示加密该消息时使用的密钥版本号
  keyVersion?: number
  // 消息引用
  replyToId?: string
  replyToSender?: string
  replyToContent?: string
}