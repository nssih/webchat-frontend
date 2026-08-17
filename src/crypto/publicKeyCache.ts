import { userApi } from '../api'
import type { User } from '../types'

const TTL_MS = 10 * 60 * 1000 // 公钥缓存 10 分钟，过期强制重拉

interface CacheEntry {
  jwk: JsonWebKey | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
// in-flight 去重：同一 username 并发请求只发一次 HTTP
const inflight = new Map<string, Promise<JsonWebKey | null>>()

function fetchAndCache(username: string): Promise<JsonWebKey | null> {
  if (inflight.has(username)) return inflight.get(username)!
  const req = (async () => {
    try {
      const res = await userApi.getUserByUsername(username)
      if (res.success && res.data.publicKey) {
        const jwk = JSON.parse(res.data.publicKey) as JsonWebKey
        cache.set(username, { jwk, expiresAt: Date.now() + TTL_MS })
        return jwk
      }
      // 对方暂无公钥，短暂缓存 null 避免频繁重试（3 秒后可重试，对新注册用户更友好）
      cache.set(username, { jwk: null, expiresAt: Date.now() + 3_000 })
      return null
    } catch {
      return null
    } finally {
      inflight.delete(username)
    }
  })()
  inflight.set(username, req)
  return req
}

export async function getPublicKey(username: string): Promise<JsonWebKey | null> {
  if (!username) return null
  const entry = cache.get(username)
  if (entry && Date.now() < entry.expiresAt) return entry.jwk
  return fetchAndCache(username)
}

// 强制清除缓存后重拉（解密失败/加密失败时调用）
export async function refreshPublicKey(username: string): Promise<JsonWebKey | null> {
  cache.delete(username)
  inflight.delete(username)
  return fetchAndCache(username)
}

// 批量预热：传入用户列表，一次性把公钥全部拉进缓存
export async function warmUpPublicKeys(users: User[]): Promise<void> {
  const toFetch = users.filter(u => {
    if (!u.username) return false
    // 已有公钥字段直接写入缓存，不发 HTTP
    if (u.publicKey) {
      try {
        const jwk = JSON.parse(u.publicKey) as JsonWebKey
        cache.set(u.username, { jwk, expiresAt: Date.now() + TTL_MS })
      } catch { }
      return false
    }
    // 缓存未过期则跳过
    const entry = cache.get(u.username)
    return !(entry && Date.now() < entry.expiresAt)
  })
  await Promise.allSettled(toFetch.map(u => fetchAndCache(u.username)))
}

// 批量写入（兼容旧调用）
export function setPublicKeys(users: User[]): void {
  for (const u of users) {
    if (u.publicKey) {
      try {
        cache.set(u.username, { jwk: JSON.parse(u.publicKey) as JsonWebKey, expiresAt: Date.now() + TTL_MS })
      } catch { }
    }
  }
}

export function invalidatePublicKey(username: string): void {
  cache.delete(username)
}

export function clearPublicKeyCache(): void {
  cache.clear()
}

// 带重试的公钥获取：用于邀请/密钥轮换时对方可能还未上传公钥的场景
export async function fetchPublicKeyWithRetry(
  username: string,
  maxRetries = 5,
  delayMs = 1200,
): Promise<JsonWebKey | null> {
  for (let i = 0; i < maxRetries; i++) {
    const key = await refreshPublicKey(username)
    if (key) return key
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs))
  }
  return null
}
