// src/components/Shared/SecureArchivo.jsx
import { useContext, useState, useEffect } from 'react'
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
import AuthContext from '../../../context/AuthContext'
import './Securearchivos.css'

const API_URL = import.meta.env.VITE_API_URL_4
const FILES_URL = (API_URL || '').replace(/\/api\/?$/, '')

const joinUrl = (base, path) => {
  const b = (base || '').replace(/\/+$/, '')
  const p = (path || '').trim()
  if (!p) return b
  return `${b}/${p.replace(/^\/+/, '')}`
}

const SecureArchivo = ({ rutaRelativa, nombreArchivo }) => {
  const { token } = useContext(AuthContext)
  const [preview, setPreview] = useState(null) // { url, tipo }
  const [loading, setLoading] = useState(false)

  // ===================== HELPERS =====================
  const getExt = name => {
    if (!name || typeof name !== 'string') return ''
    const partes = name.split('.')
    return partes.length < 2 ? '' : partes.pop().toLowerCase()
  }

  const esImagen = name =>
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getExt(name))

  const esPdf = name => getExt(name) === 'pdf'
  const esWord = name => ['doc', 'docx'].includes(getExt(name))
  const esExcel = name => ['xls', 'xlsx', 'csv'].includes(getExt(name))

  const buildUrl = () => {
    if (!rutaRelativa) return ''
    // ✅ la ruta ya viene lista: "/uploads/..." o "uploads/..."
    return joinUrl(FILES_URL, rutaRelativa)
  }

  // ===================== BLOQUEAR SCROLL DEL BODY =====================
  useEffect(() => {
    if (!preview) return

    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [preview])

  // ⚠️ El return condicional va DESPUÉS de los hooks
  if (!rutaRelativa) return null

  // A partir de aquí sí podemos usar rutaRelativa con seguridad
  const nombreFs = rutaRelativa.split('/').pop()
  const nombreMostrar = nombreArchivo || nombreFs

  const obtenerIcono = () => {
    if (esImagen(nombreFs)) return <FaFileImage />
    if (esPdf(nombreFs)) return <FaFilePdf />
    if (esWord(nombreFs)) return <FaFileWord />
    if (esExcel(nombreFs)) return <FaFileExcel />
    return <FaFileAlt />
  }

  // ===================== DESCARGA =====================
  const handleDownload = async () => {
    try {
      setLoading(true)
      const url = buildUrl()
      if (!url) throw new Error('Ruta inválida')

      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })

      saveAs(resp.data, nombreMostrar)
    } catch (err) {
      console.error(err)
      alert('No se pudo descargar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  // ===================== PREVIEW =====================
  const handlePreview = async () => {
    try {
      setLoading(true)
      const url = buildUrl()
      if (!url) throw new Error('Ruta inválida')

      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })

      const blobUrl = URL.createObjectURL(resp.data)

      let tipo = 'otro'
      if (esImagen(nombreFs)) tipo = 'imagen'
      else if (esPdf(nombreFs)) tipo = 'pdf'

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

  // ===================== RENDER =====================
  return (
    <>
      {/* Botones de acciones */}
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

      {/* ================= MODAL OVERLAY (PORTAL) ================= */}
      {preview &&
        createPortal(
          <div className='secure-preview-backdrop' onClick={closePreview}>
            <div
              className='secure-preview-modal'
              onClick={e => e.stopPropagation()}
            >
              {/* HEADER */}
              <div className='secure-preview-header d-flex justify-content-between align-items-center'>
                <h6 className='mb-0 text-truncate'>{nombreMostrar}</h6>
                <button
                  type='button'
                  className='btn-close btn-close-white'
                  onClick={closePreview}
                />
              </div>

              {/* BODY */}
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

              {/* FOOTER */}
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
