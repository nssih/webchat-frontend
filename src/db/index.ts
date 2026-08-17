import { openDB, type IDBPDatabase } from 'idb'
import type { Message, Conversation } from '../types'

const DB_VERSION = 4

interface KeyPairRecord {
  username: string
  privateKey: CryptoKey
  publicKeyJwk: JsonWebKey
  createdAt: number
}

const dbInstances = new Map<string, IDBPDatabase>()
let currentUsername: string | null = null

async function getDb() {
  if (!currentUsername) throw new Error('DB not initialized: call initDb(username) first')
  const existing = dbInstances.get(currentUsername)
  if (existing) return existing
  const dbName = `webchat-${currentUsername}`
  const instance = await openDB(dbName, DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 2) {
        if (database.objectStoreNames.contains('messages')) database.deleteObjectStore('messages')
        if (database.objectStoreNames.contains('conversations')) database.deleteObjectStore('conversations')
      }
      if (!database.objectStoreNames.contains('messages')) {
        const msgStore = database.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('conversationId', 'conversationId')
        msgStore.createIndex('timestamp', 'timestamp')
        msgStore.createIndex('seq', 'seq')
      }
      if (!database.objectStoreNames.contains('conversations')) {
        const convStore = database.createObjectStore('conversations', { keyPath: 'id' })
        convStore.createIndex('updatedAt', 'updatedAt')
      }
      if (oldVersion < 3) {
        if (!database.objectStoreNames.contains('keyPairs')) {
          database.createObjectStore('keyPairs', { keyPath: 'username' })
        }
      }
      if (oldVersion >= 2 && oldVersion < 4) {
        // v2/v3 → v4：补充 seq 索引（v1 升级时已在重建 store 时一并创建）
        if (database.objectStoreNames.contains('messages')) {
          const msgStore = transaction.objectStore('messages')
          if (!msgStore.indexNames.contains('seq')) {
            msgStore.createIndex('seq', 'seq')
          }
        }
      }
    },
  })
  dbInstances.set(currentUsername, instance)
  return instance
}

export function initDb(username: string) {
  currentUsername = username
}

export function closeDb() {
  if (currentUsername) {
    dbInstances.get(currentUsername)?.close()
    dbInstances.delete(currentUsername)
    currentUsername = null
  }
}

export async function deleteDb(username: string) {
  const instance = dbInstances.get(username)
  if (instance) {
    instance.close()
    dbInstances.delete(username)
  }
  if (currentUsername === username) currentUsername = null
  await indexedDB.deleteDatabase(`webchat-${username}`)
}

export const db = {
  async saveMessage(msg: Message) {
    const d = await getDb()
    await d.put('messages', msg)
  },

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    const d = await getDb()
    const all = await d.getAllFromIndex('messages', 'conversationId', conversationId)
    return all.sort((a, b) => a.timestamp - b.timestamp).slice(-limit)
  },

  async updateMessageStatus(msgId: string, status: Message['status']) {
    const d = await getDb()
    const msg = await d.get('messages', msgId)
    if (msg) {
      msg.status = status
      await d.put('messages', msg)
    }
  },

  async updateMessageContent(msgId: string, content: string) {
    const d = await getDb()
    const msg = await d.get('messages', msgId)
    if (msg) {
      msg.content = content
      await d.put('messages', msg)
    }
  },

  async saveConversation(conv: Conversation) {
    const d = await getDb()
    await d.put('conversations', conv)
  },

  async getConversations(): Promise<Conversation[]> {
    const d = await getDb()
    const all = await d.getAll('conversations')
    return all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  },

  async deleteMessage(msgId: string) {
    const d = await getDb()
    await d.delete('messages', msgId)
  },

  async deleteConversation(convId: string) {
    const d = await getDb()
    await d.delete('conversations', convId)
  },

  async deleteMessagesByConversation(convId: string) {
    const d = await getDb()
    const tx = d.transaction('messages', 'readwrite')
    const keys = await tx.store.index('conversationId').getAllKeys(convId)
    await Promise.all(keys.map(k => tx.store.delete(k)))
    await tx.done
  },

  async saveKeyPair(record: KeyPairRecord) {
    const d = await getDb()
    await d.put('keyPairs', record)
  },

  async getKeyPair(username: string): Promise<KeyPairRecord | undefined> {
    const d = await getDb()
    return d.get('keyPairs', username)
  },
}