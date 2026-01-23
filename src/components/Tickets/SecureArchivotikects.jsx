// SecureArchivotikects.jsx
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
import './SecurearchivosTickets.css'

// ✅ Tickets API (normalmente: http://localhost:4000/tikets)
const API_URL = import.meta.env.VITE_API_URL_5 || ''

// ✅ FIX: los uploads están en el ORIGIN (http://localhost:4000), no dentro de /tikets
const FILES_ORIGIN = (() => {
  let b = String(API_URL).replace(/\/+$/, '')
  b = b.replace(/\/tikets\/?$/i, '') // quita /tikets
  b = b.replace(/\/api\/?$/i, '') // por si acaso
  return b
})()

const buildAbsoluteUrl = (origin, ruta) => {
  const r = String(ruta || '').trim()
  if (!r) return ''
  if (/^https?:\/\//i.test(r)) return r // ya absoluta
  const o = String(origin || '').replace(/\/+$/, '')
  return `${o}${r.startsWith('/') ? '' : '/'}${r}`
}

export default function SecureArchivotikects({ rutaRelativa, nombreArchivo }) {
  const { token } = useContext(AuthContext)
  const [preview, setPreview] = useState(null) // { url, tipo }
  const [loading, setLoading] = useState(false)

  const nombreFs = useMemo(
    () =>
      String(rutaRelativa || '')
        .split('/')
        .pop(),
    [rutaRelativa]
  )
  const nombreMostrar = nombreArchivo || nombreFs

  const getExt = name => {
    if (!name || typeof name !== 'string') return ''
    const parts = name.split('.')
    return parts.length < 2 ? '' : parts.pop().toLowerCase()
  }

  const esImagen = name =>
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getExt(name))
  const esPdf = name => getExt(name) === 'pdf'
  const esWord = name => ['doc', 'docx'].includes(getExt(name))
  const esExcel = name => ['xls', 'xlsx', 'csv'].includes(getExt(name))

  const icono = () => {
    if (esImagen(nombreFs)) return <FaFileImage />
    if (esPdf(nombreFs)) return <FaFilePdf />
    if (esWord(nombreFs)) return <FaFileWord />
    if (esExcel(nombreFs)) return <FaFileExcel />
    return <FaFileAlt />
  }

  const fileUrl = useMemo(() => {
    if (!rutaRelativa) return ''
    return buildAbsoluteUrl(FILES_ORIGIN, rutaRelativa)
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

  const handleDownload = async () => {
    try {
      setLoading(true)
      if (!fileUrl) throw new Error('Ruta inválida')

      const resp = await axios.get(fileUrl, {
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

  const handlePreview = async () => {
    try {
      setLoading(true)
      if (!fileUrl) throw new Error('Ruta inválida')

      const resp = await axios.get(fileUrl, {
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

  return (
    <>
      <div className='sat-actions'>
        <div className='sat-file'>
          <span className='sat-fileIcon' title={nombreMostrar}>
            {icono()}
          </span>
          <div className='sat-fileMeta' title={nombreMostrar}>
            <div className='sat-fileName'>{nombreMostrar}</div>
            <div className='sat-filePath'>{rutaRelativa}</div>
          </div>
        </div>

        <div className='sat-btnRow'>
          <button
            type='button'
            className='sat-btn sat-btn-view'
            onClick={handlePreview}
            disabled={loading}
            title='Ver'
          >
            <FaEye size={12} />
            <span>{loading ? 'Cargando…' : 'Ver'}</span>
          </button>

          <button
            type='button'
            className='sat-btn sat-btn-dl'
            onClick={handleDownload}
            disabled={loading}
            title='Descargar'
          >
            <FaDownload size={12} />
            <span>Descargar</span>
          </button>
        </div>
      </div>

      {preview &&
        createPortal(
          <div className='sat-backdrop' onClick={closePreview}>
            <div className='sat-modal' onClick={e => e.stopPropagation()}>
              <div className='sat-head'>
                <div className='sat-title' title={nombreMostrar}>
                  {nombreMostrar}
                </div>
                <button
                  type='button'
                  className='sat-close'
                  onClick={closePreview}
                  aria-label='Cerrar'
                >
                  ✕
                </button>
              </div>

              <div className='sat-body'>
                {preview.tipo === 'imagen' && (
                  <img
                    src={preview.url}
                    className='sat-img'
                    alt={nombreMostrar}
                  />
                )}

                {preview.tipo === 'pdf' && (
                  <iframe
                    src={preview.url}
                    className='sat-iframe'
                    title={nombreMostrar}
                  />
                )}

                {preview.tipo === 'otro' && (
                  <div className='sat-muted'>
                    No hay previsualización disponible para este tipo de
                    archivo.
                    <br />
                    Usa <b>Descargar</b> para abrirlo.
                  </div>
                )}
              </div>

              <div className='sat-foot'>
                <button
                  type='button'
                  className='sat-btn sat-btn-ghost'
                  onClick={closePreview}
                >
                  Cerrar
                </button>
                <button
                  type='button'
                  className='sat-btn sat-btn-dl'
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
