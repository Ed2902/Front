import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : `${window.location.origin}`

/** Normaliza rutas relativas: "\" → "/", quita slashes iniciales */
function normalizeRelPath(src) {
  if (!src) return ''
  return String(src).replace(/\\/g, '/').replace(/^\/+/, '')
}

function buildUploadsUrl(rutaFoto) {
  if (!rutaFoto) return ''
  const norm = normalizeRelPath(rutaFoto)
  const withUploads = norm.startsWith('uploads/') ? norm : `uploads/${norm}`

  return `${API_BASE}/${withUploads}`
}

/**
 * SecureAvatar
 *
 * Props:
 * - rutaFoto: string (ej: "personal/1032485205/foto_perfil.jpeg")
 * - alt?: string
 * - fallback?: ReactNode (lo que se muestra si no hay foto / error → ej: iniciales)
 * - className, style: se aplican al <img>
 */
export default function SecureAvatar({
  rutaFoto,
  alt = 'Foto de perfil',
  fallback = null,
  className = '',
  style,
}) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fotoUrl = useMemo(() => buildUploadsUrl(rutaFoto), [rutaFoto])

  const token = useMemo(
    () =>
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      '',
    []
  )

  useEffect(() => {
    let cancelled = false
    let toRevoke = ''

    async function loadFoto() {
      setError('')
      setBlobUrl('')

      // Si no hay ruta, no hacemos nada
      if (!rutaFoto || !fotoUrl) return

      setLoading(true)

      try {
        // 👀 Aquí es donde HACEMOS el GET
        const res = await axios.get(fotoUrl, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        toRevoke = url
        setBlobUrl(url)
      } catch (e) {
        if (cancelled) return
        console.warn('SecureAvatar error:', e)
        setError('No se pudo cargar la foto.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFoto()

    return () => {
      cancelled = true
      if (toRevoke) URL.revokeObjectURL(toRevoke)
    }
  }, [rutaFoto, fotoUrl, token])

  // Si hay error o no hay ruta → fallback
  if (!rutaFoto || error) {
    return fallback
  }

  // Todavía cargando y sin blobUrl → puedes mostrar fallback
  if (loading && !blobUrl) {
    return fallback
  }

  if (!blobUrl) {
    return fallback
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  )
}
