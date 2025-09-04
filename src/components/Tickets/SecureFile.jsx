import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''

/** Normaliza src: maneja null/undefined/"undefined"/"null" y JSON string escapado */
function normalizeSrc(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (!s || s === 'undefined' || s === 'null') return ''

  // Solo intenta parsear si "parece" JSON (comillas, objeto o array)
  const looksLikeJson =
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith('{') && s.endsWith('}')) ||
    (s.startsWith('[') && s.endsWith(']'))

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(s)
      return typeof parsed === 'string' ? parsed : String(parsed ?? '')
    } catch {
      // si falla, seguimos con el valor tal cual
    }
  }
  return s
}

/** Inferencia simple de MIME por extensión (fallback si el servidor no manda content-type correcto) */
function inferMimeFromName(name = '') {
  const n = String(name).toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(n)) {
    const ext = n.split('.').pop()
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  }
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (/\.(mp4)$/.test(n)) return 'video/mp4'
  if (/\.(webm)$/.test(n)) return 'video/webm'
  if (/\.(mov)$/.test(n)) return 'video/quicktime'
  if (/\.(mkv)$/.test(n)) return 'video/x-matroska'
  if (/\.(mp3)$/.test(n)) return 'audio/mpeg'
  if (/\.(wav)$/.test(n)) return 'audio/wav'
  if (/\.(ogg)$/.test(n)) return 'audio/ogg'
  if (/\.(m4a)$/.test(n)) return 'audio/m4a'
  if (/\.(txt)$/.test(n)) return 'text/plain'
  if (/\.(csv)$/.test(n)) return 'text/csv'
  if (/\.(json)$/.test(n)) return 'application/json'
  if (/\.(zip)$/.test(n)) return 'application/zip'
  if (/\.(doc)$/.test(n)) return 'application/msword'
  if (/\.(docx)$/.test(n))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.(xls)$/.test(n)) return 'application/vnd.ms-excel'
  if (/\.(xlsx)$/.test(n))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (/\.(ppt)$/.test(n)) return 'application/vnd.ms-powerpoint'
  if (/\.(pptx)$/.test(n))
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  return ''
}

/** Une origin + ruta relativa evitando // dobles y respeta URLs absolutas */
function toAbsolute(origin, rel) {
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  const o = String(origin || '').replace(/\/+$/, '')
  const p = String(rel)
  return `${o}${p.startsWith('/') ? '' : '/'}${p}`
}

export default function SecureFile({
  src, // 'uploads/tikets/.../file.ext' o JSON string "\"uploads/...\""
  className = '',
  style = {},
  previewHeight = 480, // alto del visor PDF
  alt = '', // alt para imágenes
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const [mime, setMime] = useState('')
  const [filename, setFilename] = useState('archivo')

  // Normaliza el src por si llega en formato JSON string
  const cleanSrc = useMemo(() => normalizeSrc(src), [src])

  useEffect(() => {
    let revokedUrl = ''
    let cancelled = false

    async function load() {
      setError('')
      setBlobUrl('')
      setMime('')
      setFilename('archivo')

      if (!cleanSrc) return

      const token = localStorage.getItem('token') || ''
      const absoluteUrl = toAbsolute(API_ORIGIN, cleanSrc)

      try {
        const res = await axios.get(absoluteUrl, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (cancelled) return

        const url = URL.createObjectURL(res.data)
        revokedUrl = url
        setBlobUrl(url)

        const serverMime = res.headers['content-type'] || res.data.type || ''
        const nameFromPath = cleanSrc.split('/').pop() || 'archivo'

        const disp = res.headers['content-disposition']
        const match =
          disp && /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/.exec(disp)
        setFilename(match ? decodeURIComponent(match[2]) : nameFromPath)

        const effectiveMime =
          serverMime && serverMime !== 'application/octet-stream'
            ? serverMime
            : inferMimeFromName(nameFromPath)

        setMime(effectiveMime || serverMime || '')
      } catch (e) {
        if (cancelled) return
        const status = e?.response?.status || 0
        if (status === 401 || status === 403) {
          setError('No autorizado para ver este archivo.')
        } else if (status === 404) {
          setError('Archivo no encontrado.')
        } else if (status >= 500) {
          setError(`Error del servidor (${status}).`)
        } else {
          setError('Error de red (CORS/conexión).')
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [cleanSrc])

  if (!cleanSrc) {
    return (
      <div className='text-muted' style={{ minHeight: 32 }}>
        Sin adjunto
      </div>
    )
  }

  if (error) {
    return <div className='alert alert-warning m-0'>{error}</div>
  }

  if (!blobUrl) {
    return (
      <div className='text-muted' style={{ minHeight: 32 }}>
        Cargando…
      </div>
    )
  }

  // Render según MIME efectivo
  if (mime?.startsWith?.('image/')) {
    return (
      <img
        src={blobUrl}
        alt={alt || filename}
        className={className}
        style={style}
      />
    )
  }

  if (mime?.startsWith?.('video/')) {
    return <video src={blobUrl} controls className={className} style={style} />
  }

  if (mime?.startsWith?.('audio/')) {
    return <audio src={blobUrl} controls className={className} style={style} />
  }

  if (mime === 'application/pdf') {
    return (
      <iframe
        title={filename}
        src={blobUrl}
        className={className}
        style={{
          border: 'none',
          width: '100%',
          height: previewHeight,
          ...(style || {}),
        }}
      />
    )
  }

  // Otros tipos → botón de descarga
  return (
    <a
      href={blobUrl}
      download={filename}
      className={`btn btn-outline-primary ${className}`}
      style={style}
    >
      Descargar {filename}
    </a>
  )
}
