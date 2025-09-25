import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : `${window.location.origin}`

/**
 * SecureArchivo
 * - mode: "open" (abre en nueva pestaña) | "download" (fuerza descarga). default "open"
 * - inline: true para renderizar un visor (iframe) con el blob (prefetch)
 * - src: string (ruta absoluta o relativa)
 * - filename: nombre sugerido para descarga (opcional)
 * - height: alto del iframe cuando inline=true (default 520)
 * - className/style: estilos para el wrapper/botón
 * - children: contenido del botón/enlace (por ej. un ícono)
 *
 * NOTA: Si inline=false (default), no predescarga; descarga/abre al hacer clic.
 */
export default function SecureArchivo({
  src,
  mode = 'open',
  inline = false,
  filename,
  height = 520,
  className = '',
  style,
  children,
  onError,
  title = 'Abrir archivo',
  'aria-label': ariaLabel = 'Abrir archivo',
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const revokeRef = useRef('')

  // Normalizar URL absoluta desde src
  const toAbsolute = s => {
    if (!s) return ''
    const isAbs = /^https?:\/\//i.test(s)
    const normalized = s.startsWith('/') ? s : `/${s}`
    return isAbs ? s : `${API_BASE}${normalized}`
  }
  const absoluteUrl = toAbsolute(src)

  // Prefetch solo si inline
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
        setError('No se pudo cargar el archivo.')
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

  // Accion onClick cuando inline=false
  const handleClick = async e => {
    e?.preventDefault?.()
    if (!absoluteUrl || loading) return
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const res = await axios.get(absoluteUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const blob = res.data
      const url = URL.createObjectURL(blob)

      if (mode === 'download') {
        // Forzar descarga con filename si hay
        const a = document.createElement('a')
        a.href = url
        a.download = filename || src?.split('/')?.pop() || 'archivo'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        // Abrir en nueva pestaña
        window.open(url, '_blank', 'noopener,noreferrer')
        // revocar más tarde (cuando se cierre el tab puede que todavía se use el blob)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch (e) {
      setError('No se pudo abrir el archivo.')
      onError?.(e)
    } finally {
      setLoading(false)
    }
  }

  // Render inline (visor PDF en iframe)
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
            <small>Cargando archivo…</small>
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

  // Render como link/botón con children (ej: icono)
  return (
    <button
      type='button'
      className={`btn btn-link p-0 text-decoration-none ${className}`}
      style={style}
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel}
      disabled={!absoluteUrl || loading}
    >
      {children ?? <span>Ver archivo</span>}
    </button>
  )
}
