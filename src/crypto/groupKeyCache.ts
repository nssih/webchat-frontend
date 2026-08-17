import { groupApi } from '../api'
import { getPrivateKey } from './keyStore'
import { getPublicKey, refreshPublicKey } from './publicKeyCache'
import { unwrapGroupKey } from './e2e'
import { useAuthStore } from '../store/authStore'

// 最新版本缓存：groupId → CryptoKey（轮换后指向最新版本）
const latestCache = new Map<number, CryptoKey>()
// 历史版本缓存：`${groupId}_v${version}` → CryptoKey（离线消息解密用，不随轮换清除）
const versionedCache = new Map<string, CryptoKey>()
// in-flight 去重：key = `${groupId}` 或 `${groupId}_v${version}`
const inflight = new Map<string, Promise<CryptoKey | null>>()

async function fetchAndDecrypt(groupId: number, version?: number): Promise<CryptoKey | null> {
  const username = useAuthStore.getState().user?.username
  if (!username) return null
  let wrappedBy = ''
  try {
    const res = await groupApi.getMyGroupKey(groupId, version)
    if (!res.success || !res.data) return null

    const pipeIdx = res.data.lastIndexOf('|')
    if (pipeIdx < 0) return null
    const encryptedKey = res.data.slice(0, pipeIdx)
    wrappedBy = res.data.slice(pipeIdx + 1)

    const myPrivKey = await getPrivateKey(username)
    if (!myPrivKey) return null

    let wrapperPubKey = await getPublicKey(wrappedBy)
    if (!wrapperPubKey) wrapperPubKey = await refreshPublicKey(wrappedBy)
    if (!wrapperPubKey) return null

    return await unwrapGroupKey(encryptedKey, wrapperPubKey, myPrivKey)
  } catch (e) {
    console.error('[groupKeyCache] fetchAndDecrypt failed', groupId, version, 'wrappedBy:', wrappedBy, e)
    return null
  }
}

// 获取群密钥：有 version 时按版本查（离线消息），无 version 时取最新
export async function getGroupKey(groupId: number, version?: number): Promise<CryptoKey | null> {
  if (version != null) {
    const vKey = `${groupId}_v${version}`
    if (versionedCache.has(vKey)) return versionedCache.get(vKey)!
    if (inflight.has(vKey)) return inflight.get(vKey)!

    const req = (async () => {
      try {
        const key = await fetchAndDecrypt(groupId, version)
        if (key) versionedCache.set(vKey, key)
        return key
      } finally {
        inflight.delete(vKey)
      }
    })()
    inflight.set(vKey, req)
    return req
  }

  // 无版本：取最新
  const cacheKey = String(groupId)
  if (latestCache.has(groupId)) return latestCache.get(groupId)!
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!

  const req = (async () => {
    try {
      const key = await fetchAndDecrypt(groupId)
      if (key) latestCache.set(groupId, key)
      return key
    } finally {
      inflight.delete(cacheKey)
    }
  })()
  inflight.set(cacheKey, req)
  return req
}

export function setGroupKey(groupId: number, key: CryptoKey): void {
  latestCache.set(groupId, key)
}

// 只清最新版本缓存（轮换场景）；历史版本留用，供离线消息解密
export function invalidateGroupKey(groupId: number): void {
  latestCache.delete(groupId)
}

export function clearGroupKeyCache(): void {
  latestCache.clear()
  versionedCache.clear()
}
