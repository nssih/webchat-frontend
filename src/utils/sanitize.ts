/** 校验 avatar URL 协议，非法时返回 undefined（渲染首字母头像兜底） */
export function sanitizeAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('https://') || url.startsWith('data:image/')) return url
  return undefined
}
