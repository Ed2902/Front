// src/components/Shared/SecureArchivo.jsx
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

/**
 * API base única. Si viene .../api la recortamos a la raíz del backend.
 * Si no hay env, usa el origin actual.
 */
const API_BASE = import.meta.env.VITE_API_URL_2
  ? import.meta.env.VITE_API_URL_2.replace(/\/api\/?$/, '')
  : `${window.location.origin}`

/** Normaliza rutas relativas: "\" → "/", quita slashes iniciales */
function normalizeRelPath(src) {
  if (!src) return ''
  return String(src).replace(/\\/g, '/').replace(/^\/+/, '')
}

/** Absolutiza (si ya es http/https la respeta) */
function toAbsolute(src) {
  if (!src) return ''
  const isAbs = /^https?:\/\//i.test(src)
  return isAbs ? src : `${API_BASE}/${normalizeRelPath(src)}`
}

/** ¿Es imagen por la extensión del path? */
function isImageByPath(p = '') {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test((p || '').split('?')[0] || '')
}

/** Nombre desde Content-Disposition */
function filenameFromCD(cd = '') {
  if (!cd) return ''
  const mStar = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (mStar) return decodeURIComponent(mStar[1])
  const m =
    cd.match(/filename\s*=\s*"([^"]+)"/i) || cd.match(/filename\s*=\s*([^;]+)/i)
  return m ? m[1].trim() : ''
}

/** Ext sugerida por Content-Type */
function extFromMime(ct = '') {
  if (/pdf/i.test(ct)) return '.pdf'
  if (/png/i.test(ct)) return '.png'
  if (/jpe?g/i.test(ct)) return '.jpg'
  if (/gif/i.test(ct)) return '.gif'
  if (/webp/i.test(ct)) return '.webp'
  if (/bmp/i.test(ct)) return '.bmp'
  if (/svg/i.test(ct)) return '.svg'
  return ''
}

/**
 * Componente único para archivos protegidos.
 *
 * Props:
 * - src: string (relativa o absoluta)
 * - preview?: boolean (si true y es imagen por path, muestra miniatura) [false]
 * - mode?: 'download' | 'open'  (acción del trigger) ['download']
 * - filename?: string sugerido al descargar
 * - alt?: string (para preview)
 * - height?: number (alto preview) [180]
 * - className, style: estilos del preview
 * - onError?: (msg) => void
 * - children: nodo clickable (botón/enlace visual) que dispara la acción
 */
export default function SecureArchivo({
  src,
  preview = false,
  mode = 'download',
  filename: filenameHint,
  alt = '',
  height = 180,
  className = '',
  style,
  onError,
  children,
  ...rest
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const absUrl = useMemo(() => toAbsolute(src), [src])
  const isImage = useMemo(() => isImageByPath(src), [src])

  const token = useMemo(
    () =>
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      '',
    []
  )

  // PREVIEW (solo si se pidió y parece imagen)
  useEffect(() => {
    let revoked = ''
    let cancelled = false

    async function loadPreview() {
      setError('')
      setBlobUrl('')

      if (!preview || !src || !isImage) return
      setLoading(true)

      try {
        const res = await axios.get(absUrl, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        revoked = url
        setBlobUrl(url)
      } catch (e) {
        if (cancelled) return
        console.warn('SecureArchivo preview error:', e)
        const msg = 'No se pudo cargar la vista previa.'
        setError(msg)
        onError && onError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPreview()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [preview, src, absUrl, token, isImage, onError])

  // Acción principal (abrir/descargar con auth)
  const handleAction = async e => {
    e?.preventDefault?.()
    if (!src) return
    try {
      setError('')
      setLoading(true)

      const res = await axios.get(absUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const cd = res.headers?.['content-disposition'] || ''
      const ct = res.headers?.['content-type'] || ''
      let finalName =
        filenameHint ||
        filenameFromCD(cd) ||
        (String(src).split('/').pop() || 'archivo').split('?')[0]

      if (!/\.[A-Za-z0-9]+$/.test(finalName)) {
        const ext = extFromMime(ct)
        if (ext) finalName += ext
      }

      const blob = res.data
      const url = URL.createObjectURL(blob)

      if (mode === 'open') {
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = finalName
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.warn('SecureArchivo action error:', e)
      const msg =
        'No se pudo obtener el archivo. Verifica permisos o disponibilidad.'
      setError(msg)
      onError && onError(msg)
    } finally {
      setLoading(false)
    }
  }

  // UI preview (si aplica)
  const previewNode = preview ? (
    <div className='border rounded p-2 bg-light'>
      {loading && !blobUrl ? (
        <div
          className={`d-flex align-items-center justify-content-center text-muted ${className}`}
          style={{ height, borderRadius: 8, ...style }}
        >
          <small>Cargando…</small>
        </div>
      ) : error ? (
        <div
          className={`d-flex align-items-center justify-content-center bg-light text-muted ${className}`}
          style={{ height, borderRadius: 8, ...style }}
        >
          <small>{error}</small>
        </div>
      ) : isImage && blobUrl ? (
        <img
          src={blobUrl}
          alt={alt}
          className={className}
          style={{ maxWidth: '100%', borderRadius: 8, ...style }}
          {...rest}
        />
      ) : (
        <div
          className={`d-flex align-items-center justify-content-center bg-light text-muted ${className}`}
          style={{ height, borderRadius: 8, ...style }}
        >
          <small>Vista previa no disponible.</small>
        </div>
      )}
    </div>
  ) : null

  // Trigger: usa tus propios botones/links como children
  const triggerNode = children ? (
    <button
      type='button'
      onClick={handleAction}
      disabled={loading || !src}
      title={mode === 'open' ? 'Abrir' : 'Descargar'}
      style={{
        all: 'unset',
        cursor: loading || !src ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  ) : null

  return (
    <div className='d-flex flex-column gap-2'>
      {previewNode}
      {triggerNode}
    </div>
  )
}
