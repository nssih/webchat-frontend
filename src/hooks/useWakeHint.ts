import { useState, useEffect, useRef } from 'react'

// 请求超过 WAKE_THRESHOLD 秒后显示冷启动提示，倒计时显示剩余等待时间
const WAKE_THRESHOLD = 3000   // 3s 后开始提示
const WAKE_TIMEOUT = 60000    // 最长等待 60s

export function useWakeHint() {
  const [wakeHint, setWakeHint] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  function startWaiting() {
    startRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      // 超过阈值后开始显示倒计时
      const update = () => {
        const elapsed = Date.now() - startRef.current
        const remaining = Math.max(0, Math.ceil((WAKE_TIMEOUT - elapsed) / 1000))
        if (remaining > 0) {
          setWakeHint(`服务器正在唤醒，请稍候 (${remaining}s)...`)
        } else {
          setWakeHint('服务器响应超时，请检查网络后重试')
          stopWaiting()
        }
      }
      update()
      intervalRef.current = setInterval(update, 1000)
    }, WAKE_THRESHOLD)
  }

  function stopWaiting() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setWakeHint(null)
  }

  useEffect(() => () => stopWaiting(), [])

  return { wakeHint, startWaiting, stopWaiting }
}
