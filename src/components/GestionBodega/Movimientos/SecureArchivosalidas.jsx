import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { FaFilePdf } from 'react-icons/fa'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : `${window.location.origin}`

export default function SecureArchivosalidas({
  src,
  mode = 'open',
  inline = false,
  filename,
  height = 520,
  className = '',
  style,
  children,
  onError,
  title = 'Abrir PDF',
  'aria-label': ariaLabel = 'Abrir PDF',
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const revokeRef = useRef('')

  // -- Helpers ----------------------------------------------------
  const toAbsolute = s => {
    if (!s) return ''
    const isAbs = /^https?:\/\//i.test(s)
    const normalized = s.startsWith('/') ? s : `/${s}`
    const abs = isAbs ? s : `${API_BASE}${normalized}`
    return normalizeApiPrefix(abs)
  }

  // Si la URL es del mismo origen y empieza con /api/, remueve ese segmento
  const normalizeApiPrefix = absUrl => {
    try {
      const u = new URL(absUrl)
      const base = new URL(API_BASE)
      if (u.origin === base.origin && u.pathname.startsWith('/api/')) {
        u.pathname = u.pathname.replace(/^\/api\//, '/')
        return u.toString()
      }
      return absUrl
    } catch {
      return absUrl
    }
  }

  const absoluteUrl = toAbsolute(src)

  // Prefetch solo si inline=true
  useEffect(() => {
    let cancelled = false
    async function prefetch() {
      if (!inline || !absoluteUrl) return
      try {
        setLoading(true)
        setError('')
        const token = localStorage.getItem('token')
        const res = await axios.get(absoluteUrl, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        revokeRef.current = url
        setBlobUrl(url)
      } catch (e) {
        if (cancelled) return
        setError('No se pudo cargar el PDF.')
        onError?.(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setBlobUrl('')
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current)
      revokeRef.current = ''
    }
    prefetch()

    return () => {
      cancelled = true
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current)
        revokeRef.current = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absoluteUrl, inline])

  // Acción click cuando inline=false
  const handleClick = async e => {
    e?.preventDefault?.()
    if (!absoluteUrl || loading) return

    // Abrimos la pestaña ANTES del await para evitar bloqueos de popup
    const popup = mode === 'open' ? window.open('', '_blank') : null

    try {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('token')
      const res = await axios.get(absoluteUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const blob = res.data // ya es Blob
      const url = URL.createObjectURL(blob)

      if (mode === 'download') {
        const a = document.createElement('a')
        a.href = url
        a.download =
          filename || src?.split('/')?.pop() || 'documento_salida.pdf'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        if (popup) {
          popup.opener = null
          popup.location = url
        } else {
          // Fallback si el popup fue bloqueado
          const a = document.createElement('a')
          a.href = url
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          a.remove()
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch (e) {
      setError('No se pudo abrir el PDF.')
      onError?.(e)
      // Si abrimos un popup vacío, ciérralo para no dejarlo colgado
      if (popup && !popup.closed) popup.close()
    } finally {
      setLoading(false)
    }
  }

  // Visor inline
  if (inline) {
    if (error) {
      return (
        <div
          className='d-flex align-items-center justify-content-center bg-light text-muted border rounded'
          style={{ height }}
        >
          <small>{error}</small>
        </div>
      )
    }
    if (!blobUrl || loading) {
      return (
        <div
          className='d-flex align-items-center justify-content-center bg-light text-muted border rounded'
          style={{ height }}
        >
          <div className='d-flex align-items-center gap-2'>
            <div className='spinner-border spinner-border-sm text-secondary' />
            <small>Cargando PDF…</small>
          </div>
        </div>
      )
    }
    return (
      <iframe
        src={blobUrl}
        title={title}
        aria-label={ariaLabel}
        className={className}
        style={{ border: 0, width: '100%', height, ...style }}
      />
    )
  }

  // Botón por defecto (abre/descarga)
  return (
    <button
      type='button'
      className={`btn btn-sm btn-outline-primary ${className}`}
      style={style}
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel}
      disabled={!absoluteUrl || loading}
    >
      {children ?? (
        <>
          <FaFilePdf className='me-1' />
          PDF
        </>
      )}
    </button>
  )
}
