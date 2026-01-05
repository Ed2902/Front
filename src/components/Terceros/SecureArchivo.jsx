import { useContext, useEffect, useMemo, useState } from 'react'
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
import AuthContext from '../../context/AuthContext'
import './Securearchivos.css'

// ✅ API base (/api)
const API_URL = import.meta.env.VITE_API_URL || ''

// ✅ base para archivos (sin /api)
const FILES_URL = API_URL.replace(/\/api\/?$/, '')

const joinUrl = (base, path) => {
  const b = (base || '').replace(/\/+$/, '')
  const p = (path || '').trim()
  if (!p) return b
  return `${b}/${p.replace(/^\/+/, '')}`
}

const getTokenFallback = () => localStorage.getItem('token')

const SecureArchivo = ({ rutaRelativa, nombreArchivo }) => {
  const auth = useContext(AuthContext)
  const token = auth?.token || getTokenFallback()

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const getExt = name => {
    if (!name || typeof name !== 'string') return ''
    const partes = name.split('.')
    return partes.length < 2 ? '' : partes.pop().toLowerCase()
  }

  const nombreFs = useMemo(() => {
    if (!rutaRelativa) return ''
    return rutaRelativa.split('/').pop() || ''
  }, [rutaRelativa])

  const nombreMostrar = nombreArchivo || nombreFs

  const esImagen = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(
    getExt(nombreFs)
  )
  const esPdf = getExt(nombreFs) === 'pdf'
  const esWord = ['doc', 'docx'].includes(getExt(nombreFs))
  const esExcel = ['xls', 'xlsx', 'csv'].includes(getExt(nombreFs))

  const obtenerIcono = () => {
    if (esImagen) return <FaFileImage />
    if (esPdf) return <FaFilePdf />
    if (esWord) return <FaFileWord />
    if (esExcel) return <FaFileExcel />
    return <FaFileAlt />
  }

  // ✅ URL FINAL CORRECTA: http://host/uploads/...
  const fileUrl = useMemo(() => {
    if (!rutaRelativa) return ''
    return joinUrl(FILES_URL, rutaRelativa)
  }, [rutaRelativa])

  useEffect(() => {
    if (!preview) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [preview])

  if (!rutaRelativa) return null

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
      saveAs(resp.data, nombreMostrar || 'archivo')
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

  return (
    <>
      <div className='shp-actions d-flex align-items-center gap-2'>
        <div className='shp-icon-wrapper'>
          <span className='shp-icon'>{obtenerIcono()}</span>
        </div>

        <button
          type='button'
          className='btn btn-sm btn-outline-secondary d-flex align-items-center gap-1'
          onClick={handlePreview}
          disabled={loading}
        >
          <FaEye size={12} />
          <span>{loading ? 'Cargando...' : 'Ver'}</span>
        </button>

        <button
          type='button'
          className='btn btn-sm btn-descargar-doc d-flex align-items-center gap-1'
          onClick={handleDownload}
          disabled={loading}
        >
          <FaDownload size={12} />
          <span>Descargar</span>
        </button>
      </div>

      {preview &&
        createPortal(
          <div className='secure-preview-backdrop' onClick={closePreview}>
            <div
              className='secure-preview-modal'
              onClick={e => e.stopPropagation()}
            >
              <div className='secure-preview-header d-flex justify-content-between align-items-center'>
                <h6 className='mb-0 text-truncate'>{nombreMostrar}</h6>
                <button
                  type='button'
                  className='btn-close btn-close-white'
                  onClick={closePreview}
                />
              </div>

              <div className='secure-preview-body'>
                {preview.tipo === 'imagen' && (
                  <img
                    src={preview.url}
                    className='img-fluid rounded'
                    alt={nombreMostrar}
                  />
                )}

                {preview.tipo === 'pdf' && (
                  <iframe
                    src={preview.url}
                    className='secure-preview-iframe'
                    title={nombreMostrar}
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

              <div className='secure-preview-footer text-end'>
                <button
                  type='button'
                  className='btn btn-sm btn-secondary me-2'
                  onClick={closePreview}
                >
                  Cerrar
                </button>
                <button
                  type='button'
                  className='btn btn-sm btn-descargar-doc'
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
