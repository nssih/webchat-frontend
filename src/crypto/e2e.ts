// ECDH P-256 + HKDF-SHA-256 + AES-GCM 端对端加密
// 私钥永不离开设备，服务器只见密文

const subtle = crypto.subtle

export async function generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyJwk: JsonWebKey }> {
  const kp = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // 私钥不可导出原始字节，只能存 IndexedDB
    ['deriveKey'],
  )
  const publicKeyJwk = await subtle.exportKey('jwk', kp.publicKey)
  return { privateKey: kp.privateKey, publicKeyJwk }
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
}

// ECDH → 原始共享秘密 → HKDF → AES-GCM 128 位密钥
export async function deriveAesKey(myPrivateKey: CryptoKey, theirPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const theirPublicKey = await importPublicKey(theirPublicKeyJwk)
  const ecdhKey = await subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  // HKDF 派生最终 AES-GCM 密钥，info 固定为 "webchat-e2e"
  const info = new TextEncoder().encode('webchat-e2e')
  const salt = new Uint8Array(32) // 零盐（确定性派生）
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ecdhKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// 将 Uint8Array 转为 Base64（分段转换，避免 Chrome 函数参数上限 65536）
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// 返回 "iv_base64:ciphertext_base64"
export async function encryptContent(aesKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded)
  const ivB64 = uint8ArrayToBase64(iv)
  const ctB64 = uint8ArrayToBase64(new Uint8Array(ciphertext))
  return `${ivB64}:${ctB64}`
}

// 解密 "iv_base64:ciphertext_base64"，失败抛出
export async function decryptContent(aesKey: CryptoKey, ciphertext: string): Promise<string> {
  const colonIdx = ciphertext.indexOf(':')
  if (colonIdx < 0) throw new Error('invalid ciphertext format')
  const ivB64 = ciphertext.slice(0, colonIdx)
  const ctB64 = ciphertext.slice(colonIdx + 1)
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0))
  const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct)
  return new TextDecoder().decode(plainBuf)
}

// 组合：加密一条消息（私钥 + 对方公钥 → 密文字符串）
export async function encryptMessage(
  myPrivateKey: CryptoKey,
  theirPublicKeyJwk: JsonWebKey,
  plaintext: string,
): Promise<string> {
  const aesKey = await deriveAesKey(myPrivateKey, theirPublicKeyJwk)
  return encryptContent(aesKey, plaintext)
}

// 组合：解密一条消息
export async function decryptMessage(
  myPrivateKey: CryptoKey,
  theirPublicKeyJwk: JsonWebKey,
  ciphertext: string,
): Promise<string> {
  const aesKey = await deriveAesKey(myPrivateKey, theirPublicKeyJwk)
  return decryptContent(aesKey, ciphertext)
}

// ===== 群密钥（AES-GCM 256 位，随机生成，用成员 ECDH 公钥包装） =====

// 生成群共享 AES 密钥（可导出，用于包装后存服务器）
export async function generateGroupKey(): Promise<CryptoKey> {
  return subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // 可导出，以便用成员公钥包装后上传
    ['encrypt', 'decrypt'],
  )
}

// 导出群密钥为 raw bytes，再用接收方 ECDH 公钥加密（ECDH + HKDF 包装）
export async function wrapGroupKey(
  groupKey: CryptoKey,
  recipientPublicKeyJwk: JsonWebKey,
  myPrivateKey: CryptoKey,
): Promise<string> {
  const rawKey = await subtle.exportKey('raw', groupKey)
  const rawB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
  // 用 ECDH 派生的 AES 密钥加密 raw 群密钥
  const wrapKey = await deriveAesKey(myPrivateKey, recipientPublicKeyJwk)
  return encryptContent(wrapKey, rawB64)
}

// 解包：用自己私钥 + 上传者公钥解密，还原群 AES 密钥
export async function unwrapGroupKey(
  encryptedKey: string,
  senderPublicKeyJwk: JsonWebKey,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapKey = await deriveAesKey(myPrivateKey, senderPublicKeyJwk)
  const rawB64 = await decryptContent(wrapKey, encryptedKey)
  const raw = Uint8Array.from(atob(rawB64), c => c.charCodeAt(0))
  return subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// 用群 AES 密钥加密消息
export async function encryptWithGroupKey(groupKey: CryptoKey, plaintext: string): Promise<string> {
  return encryptContent(groupKey, plaintext)
}

// 用群 AES 密钥解密消息
export async function decryptWithGroupKey(groupKey: CryptoKey, ciphertext: string): Promise<string> {
  return decryptContent(groupKey, ciphertext)
}
