// SecureArchivo.jsx
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { saveAs } from 'file-saver'
import {
  FaFilePdf,
  FaFileImage,
  FaFileAlt,
  FaFileWord,
  FaFileExcel,
  FaDownload,
  FaEye,
} from 'react-icons/fa'

// ✅ API base (normalmente incluye /api)
const API_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_PUBLIC_URL || ''

// ✅ base para archivos (SIN /api)
const FILES_URL = String(API_URL)
  .replace(/\/api\/?$/i, '')
  .replace(/\/$/, '')

const joinUrl = (base, path) => {
  const b = String(base || '').replace(/\/+$/, '')
  const p = String(path || '').trim()
  if (!p) return b
  return `${b}/${p.replace(/^\/+/, '')}`
}

// ✅ Normaliza para que SIEMPRE quede como "uploads/..."
const normalizeRutaRelativa = input => {
  if (!input) return ''
  let s = String(input).trim()
  if (!s) return ''

  // si es URL completa, recorta desde /uploads/ si existe
  const lower = s.toLowerCase()
  const idxUploads = lower.indexOf('/uploads/')
  if (idxUploads >= 0) {
    s = s.slice(idxUploads + 1) // "uploads/..."
  }

  // ✅ Windows -> web
  s = s.replace(/\\/g, '/')

  // limpia prefijos
  s = s.replace(/^\/+/, '')
  s = s.replace(/^api\/+/i, '')
  s = s.replace(/^uploads\/+/i, 'uploads/')

  // ✅ si viene solo filename => uploads/alistamientos/<file>
  if (!/^uploads\//i.test(s)) s = `uploads/alistamientos/${s}`

  return s
}

const getTokenFallback = () => localStorage.getItem('token')

const SecureArchivo = ({
  rutaRelativa,
  nombreArchivo,
  token: tokenProp,
  compact = false,
}) => {
  const token = tokenProp || getTokenFallback()

  const [preview, setPreview] = useState(null) // {url,tipo}
  const [loading, setLoading] = useState(false)

  const ruta = useMemo(
    () => normalizeRutaRelativa(rutaRelativa),
    [rutaRelativa]
  )

  const getExt = name => {
    if (!name || typeof name !== 'string') return ''
    const partes = name.split('.')
    return partes.length < 2 ? '' : (partes.pop() || '').toLowerCase()
  }

  const nombreFs = useMemo(() => {
    if (!ruta) return ''
    return ruta.split('/').pop() || ''
  }, [ruta])

  const nombreMostrar = nombreArchivo || nombreFs || 'archivo'

  const ext = getExt(nombreFs || nombreMostrar)
  const esImagen = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  const esPdf = ext === 'pdf'
  const esWord = ['doc', 'docx'].includes(ext)
  const esExcel = ['xls', 'xlsx', 'csv'].includes(ext)

  const obtenerIcono = () => {
    if (esImagen) return <FaFileImage />
    if (esPdf) return <FaFilePdf />
    if (esWord) return <FaFileWord />
    if (esExcel) return <FaFileExcel />
    return <FaFileAlt />
  }

  // ✅ URL FINAL: http://host/uploads/...
  const fileUrl = useMemo(() => {
    if (!ruta) return ''
    return joinUrl(FILES_URL, ruta)
  }, [ruta])

  useEffect(() => {
    if (!preview) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [preview])

  if (!ruta) return null

  const fetchBlob = async () => {
    if (!fileUrl) throw new Error('Ruta inválida')
    if (!token) throw new Error('No hay token de sesión')

    return axios.get(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    })
  }

  const handleDownload = async () => {
    try {
      setLoading(true)
      const resp = await fetchBlob()
      saveAs(resp.data, nombreMostrar)
    } catch (err) {
      console.error(err)
      alert('No se pudo descargar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    try {
      setLoading(true)
      const resp = await fetchBlob()
      const blobUrl = URL.createObjectURL(resp.data)

      let tipo = 'otro'
      if (esImagen) tipo = 'imagen'
      else if (esPdf) tipo = 'pdf'

      setPreview(prev => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return { url: blobUrl, tipo }
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo previsualizar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const closePreview = () => {
    setPreview(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.6)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  }

  const modalStyle = {
    width: 'min(1100px, 96vw)',
    height: 'min(720px, 92vh)',
    background: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 12px 36px rgba(0,0,0,.45)',
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle = {
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: '#0b1220',
    borderBottom: '1px solid rgba(255,255,255,.08)',
    color: '#fff',
  }

  const bodyStyle = {
    padding: 12,
    overflow: 'auto',
    flex: 1,
    background: '#0f172a',
  }

  const footerStyle = {
    padding: 10,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    background: '#0b1220',
    borderTop: '1px solid rgba(255,255,255,.08)',
  }

  return (
    <>
      <div className='d-flex align-items-center gap-2'>
        {!compact && (
          <span className='text-muted' title={nombreMostrar}>
            {obtenerIcono()}
          </span>
        )}

        <button
          type='button'
          className='btn btn-sm btn-outline-secondary d-flex align-items-center gap-1'
          onClick={handlePreview}
          disabled={loading}
          title='Ver'
        >
          <FaEye size={12} />
          {!compact && <span>{loading ? 'Cargando...' : 'Ver'}</span>}
        </button>

        <button
          type='button'
          className='btn btn-sm btn-outline-primary d-flex align-items-center gap-1'
          onClick={handleDownload}
          disabled={loading}
          title='Descargar'
        >
          <FaDownload size={12} />
          {!compact && <span>Descargar</span>}
        </button>
      </div>

      {preview &&
        createPortal(
          <div style={backdropStyle} onClick={closePreview}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
              <div style={headerStyle}>
                <div className='text-truncate' style={{ maxWidth: '80%' }}>
                  <strong>{nombreMostrar}</strong>
                </div>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-light'
                  onClick={closePreview}
                >
                  Cerrar
                </button>
              </div>

              <div style={bodyStyle}>
                {preview.tipo === 'imagen' && (
                  <img
                    src={preview.url}
                    alt={nombreMostrar}
                    className='img-fluid rounded'
                    style={{
                      maxHeight: '100%',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                )}

                {preview.tipo === 'pdf' && (
                  <iframe
                    src={preview.url}
                    title={nombreMostrar}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 0,
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  />
                )}

                {preview.tipo === 'otro' && (
                  <div className='text-center text-muted small'>
                    No hay previsualización disponible para este tipo de
                    archivo.
                    <br />
                    Usa &quot;Descargar&quot; para abrirlo.
                  </div>
                )}
              </div>

              <div style={footerStyle}>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-light'
                  onClick={closePreview}
                >
                  Cerrar
                </button>
                <button
                  type='button'
                  className='btn btn-sm btn-primary'
                  onClick={handleDownload}
                >
                  Descargar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default SecureArchivo
