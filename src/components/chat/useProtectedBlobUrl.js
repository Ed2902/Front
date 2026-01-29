import { useEffect, useState } from 'react'

const __blobCache = new Map()

export default function useProtectedBlobUrl({ url, token, enabled = true }) {
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()

    const run = async () => {
      try {
        const u = String(url || '').trim()
        const t = String(token || '')
        if (!enabled || !u) {
          setBlobUrl('')
          return
        }

        const cacheKey = `${u}::${t}`
        if (__blobCache.has(cacheKey)) {
          setBlobUrl(__blobCache.get(cacheKey))
          return
        }

        const resp = await fetch(u, {
          method: 'GET',
          headers: t ? { Authorization: `Bearer ${t}` } : {},
          signal: ctrl.signal,
        })

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

        const blob = await resp.blob()
        const objUrl = URL.createObjectURL(blob)
        __blobCache.set(cacheKey, objUrl)

        if (alive) setBlobUrl(objUrl)
      } catch {
        if (alive) setBlobUrl('')
      }
    }

    run()
    return () => {
      alive = false
      try {
        ctrl.abort()
      } catch {}
    }
  }, [url, token, enabled])

  return blobUrl
}
