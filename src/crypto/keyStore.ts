import { db, initDb } from '../db'
import { userApi } from '../api'
import { groupApi } from '../api'
import { generateKeyPair, unwrapGroupKey } from './e2e'
import { warmUpPublicKeys, getPublicKey } from './publicKeyCache'
import { setGroupKey } from './groupKeyCache'

// in-flight 去重：同一 username 的并发调用只执行一次（防 React StrictMode 双调用 race）
const ensureInflight = new Map<string, Promise<void>>()

export async function ensureKeyPair(username: string): Promise<void> {
  if (ensureInflight.has(username)) return ensureInflight.get(username)!
  // 在任何 await 之前立即 set，确保并发调用能命中已有的 Promise（防 React StrictMode 双调用）
  const req = (async () => {
    try {
      const existing = await db.getKeyPair(username)
      if (existing) {
        await userApi.uploadPublicKey(JSON.stringify(existing.publicKeyJwk))
        return
      }
      const { privateKey, publicKeyJwk } = await generateKeyPair()
      const raceCheck = await db.getKeyPair(username)
      if (raceCheck) {
        await userApi.uploadPublicKey(JSON.stringify(raceCheck.publicKeyJwk))
        return
      }
      await db.saveKeyPair({ username, privateKey, publicKeyJwk, createdAt: Date.now() })
      await userApi.uploadPublicKey(JSON.stringify(publicKeyJwk))
      localStorage.setItem(`newKeyGenerated_${username}`, '1')
    } finally {
      ensureInflight.delete(username)
    }
  })()
  ensureInflight.set(username, req)
  return req
}

export async function getPrivateKey(username: string): Promise<CryptoKey | null> {
  const record = await db.getKeyPair(username)
  return record?.privateKey ?? null
}

export async function getOwnPublicKeyJwk(username: string): Promise<JsonWebKey | null> {
  const record = await db.getKeyPair(username)
  return record?.publicKeyJwk ?? null
}

// 完整会话初始化：密钥生成/上传 + 联系人公钥预热 + 群密钥预热
// 登录后必须等此函数 resolve 才能建立 WS / 允许用户操作
// 返回 { newKeyGenerated: true } 表示生成了新密钥（IDB 被清除/新设备），调用方应提示用户
export async function initSession(username: string): Promise<{ newKeyGenerated: boolean }> {
  // 0. 初始化当前用户专属 DB
  initDb(username)

  // 1. 确保自己的密钥对已生成并上传到服务器
  await ensureKeyPair(username)

  const myPrivKey = await getPrivateKey(username)

  // 2. 并行拉取：在线用户列表 + 最近会话记录 + 我加入的群
  const [onlineRes, convsFromDb, groupsRes] = await Promise.allSettled([
    userApi.online(),
    db.getConversations(),
    groupApi.list(),
  ])

  // 3. 收集需要预热公钥的用户集合
  const usersToWarm: { username: string; publicKey?: string | null }[] = []

  if (onlineRes.status === 'fulfilled' && onlineRes.value.success) {
    for (const u of onlineRes.value.data) usersToWarm.push(u)
  }

  if (convsFromDb.status === 'fulfilled') {
    for (const conv of convsFromDb.value) {
      if (conv.type === 'private') {
        usersToWarm.push({ username: conv.targetUsername })
      }
    }
  }

  // 4. 批量预热私聊联系人公钥（已有 publicKey 字段的直接写缓存，其余并发拉取）
  if (usersToWarm.length > 0) {
    await warmUpPublicKeys(usersToWarm as Parameters<typeof warmUpPublicKeys>[0])
  }

  // 5. 预热群密钥（解密失败静默跳过，不阻塞主流程）
  if (groupsRes.status === 'fulfilled' && groupsRes.value.success && myPrivKey) {
    const groups = groupsRes.value.data
    await Promise.allSettled(
      groups.map(async (group) => {
        try {
          const keyRes = await groupApi.getMyGroupKey(group.id)
          if (!keyRes.success || !keyRes.data) return
          const pipeIdx = keyRes.data.lastIndexOf('|')
          if (pipeIdx < 0) return
          const encryptedKey = keyRes.data.slice(0, pipeIdx)
          const wrappedBy = keyRes.data.slice(pipeIdx + 1)
          const wrapperPubKey = await getPublicKey(wrappedBy)
          if (!wrapperPubKey) return
          const groupKey = await unwrapGroupKey(encryptedKey, wrapperPubKey, myPrivKey)
          setGroupKey(group.id, groupKey)
        } catch { }
      })
    )
  }

  // 检查是否本次登录生成了新密钥（IDB 被清除/新设备），通知调用方展示提示
  const newKeyFlag = `newKeyGenerated_${username}`
  const newKeyGenerated = localStorage.getItem(newKeyFlag) === '1'
  if (newKeyGenerated) localStorage.removeItem(newKeyFlag)
  return { newKeyGenerated }
}
