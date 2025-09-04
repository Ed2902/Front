import { useEffect, useState } from 'react'
import axios from 'axios'

const API_ORIGIN = import.meta.env.VITE_API_URL.replace(
  '/api',
  '/backendfastway'
)

export default function SecureImage({ src, alt = '', ...imgProps }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let revokedUrl = ''
    let cancelled = false

    async function load() {
      setError('')
      setBlobUrl('')

      if (!src) return

      const token = localStorage.getItem('token')
      const absoluteUrl = src.startsWith('http') ? src : `${API_ORIGIN}${src}`

      try {
        const res = await axios.get(absoluteUrl, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        revokedUrl = url
        setBlobUrl(url)
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        if (cancelled) return
        setError('No se pudo cargar la imagen.')
      }
    }

    load()

    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [src])

  if (error) {
    return (
      <div
        className='d-flex align-items-center justify-content-center bg-light text-muted'
        style={{ height: 180 }}
      >
        <small>{error}</small>
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div
        className='d-flex align-items-center justify-content-center bg-light text-muted'
        style={{ height: 180 }}
      >
        <small>Cargando imagen…</small>
      </div>
    )
  }

  return <img src={blobUrl} alt={alt} {...imgProps} />
}
