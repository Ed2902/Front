// src/components/Shared/SecureFolder.jsx
import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { saveAs } from 'file-saver'
import {
  FaFilePdf,
  FaFileImage,
  FaFileAlt,
  FaDownload,
  FaEye,
} from 'react-icons/fa'
import AuthContext from '../../context/AuthContext'
import './SecureFolder.css'

const API_URL = import.meta.env.VITE_API_URL
const FILES_URL = API_URL.replace(/\/api\/?$/, '')

const SecureFolder = ({ rutaCarpeta }) => {
  const { token } = useContext(AuthContext)
  const [archivos, setArchivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  // ============================================================
  // CARGA DE ARCHIVOS (MISMA LÓGICA QUE USABAS)
  // ============================================================
  useEffect(() => {
    const cargarArchivos = async () => {
      if (!rutaCarpeta) {
        setLoading(false)
        setError('No se definió la carpeta de documentos.')
        return
      }

      try {
        setLoading(true)
        setError('')

        const url = `${API_URL}/uploads/${rutaCarpeta}`

        const { data } = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!data.ok) throw new Error(data.msg || 'Respuesta inválida')

        const lista = (data.files || []).map(f => {
          const rutaRel = f.url.startsWith('/') ? f.url.slice(1) : f.url
          return {
            nombre: f.name,
            ruta: rutaRel,
          }
        })

        setArchivos(lista)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar la lista de documentos.')
        setArchivos([])
      } finally {
        setLoading(false)
      }
    }

    cargarArchivos()
  }, [rutaCarpeta, token])

  // ============================================================
  // HELPERS DE TIPOS
  // ============================================================
  const getExt = name => name.split('.').pop().toLowerCase()

  const esImagen = name =>
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getExt(name))

  const esPdf = name => getExt(name) === 'pdf'

  const obtenerIcono = name => {
    if (esImagen(name)) return <FaFileImage />
    if (esPdf(name)) return <FaFilePdf />
    return <FaFileAlt />
  }

  const buildFileUrl = archivo =>
    `${FILES_URL}/${archivo.ruta || archivo.nombre}`

  // ============================================================
  // DESCARGA CON TOKEN (MISMA LÓGICA)
  // ============================================================
  const handleDownload = async archivo => {
    try {
      const url = buildFileUrl(archivo)
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })

      saveAs(resp.data, archivo.nombre)
    } catch (e) {
      console.error(e)
      alert('No se pudo descargar el archivo.')
    }
  }

  // ============================================================
  // PREVIEW USANDO BLOB (CON TOKEN SIEMPRE)
  // ============================================================
  const handlePreview = async archivo => {
    try {
      const url = buildFileUrl(archivo)
      const nombre = archivo.nombre

      let tipo = 'otro'
      if (esImagen(nombre)) tipo = 'imagen'
      else if (esPdf(nombre)) tipo = 'pdf'

      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })

      const blobUrl = URL.createObjectURL(resp.data)

      setPreview(prev => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return { archivo, url: blobUrl, tipo }
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo cargar la previsualización.')
    }
  }

  const closePreview = () => {
    setPreview(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  const carpetaNombre = rutaCarpeta
    .split('/')
    .filter(Boolean)
    .slice(-2)
    .join('/')

  return (
    <>
      <div className='card secure-folder-card shadow-sm mt-3'>
        <div className='card-header secure-folder-header d-flex justify-content-between align-items-center'>
          <span className='secure-folder-title'>Carpeta de documentos</span>
          <span className='secure-folder-badge'>{carpetaNombre}</span>
        </div>

        <div className='card-body p-0'>
          {loading && (
            <div className='p-3 text-muted small'>Cargando documentos...</div>
          )}

          {error && !loading && (
            <div className='p-3 text-danger small'>{error}</div>
          )}

          {!loading && !error && archivos.length === 0 && (
            <div className='p-3 text-muted small'>
              No se encontraron documentos.
            </div>
          )}

          {!loading && !error && archivos.length > 0 && (
            <div className='secure-folder-list-wrapper'>
              <ul className='list-group list-group-flush'>
                {archivos.map((archivo, idx) => {
                  const nombre = archivo.nombre

                  return (
                    <li
                      key={idx}
                      className='list-group-item secure-folder-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2'
                    >
                      {/* IZQUIERDA */}
                      <div className='d-flex flex-row align-items-center gap-3'>
                        <div className='secure-folder-thumb-wrapper'>
                          <div className='secure-folder-icon'>
                            {obtenerIcono(nombre)}
                          </div>
                        </div>

                        <div className='secure-folder-info'>
                          <div className='secure-folder-name'>{nombre}</div>
                          <div className='secure-folder-tags'>
                            {esImagen(nombre) && (
                              <span className='badge bg-light text-dark me-1'>
                                Imagen
                              </span>
                            )}
                            {esPdf(nombre) && (
                              <span className='badge bg-light text-dark me-1'>
                                PDF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DERECHA - BOTONES */}
                      <div className='d-flex justify-content-end gap-2'>
                        <button
                          type='button'
                          className='btn btn-sm btn-outline-secondary d-flex align-items-center gap-1'
                          onClick={() => handlePreview(archivo)}
                        >
                          <FaEye size={12} /> Ver
                        </button>

                        <button
                          type='button'
                          className='btn btn-sm btn-descargar-doc d-flex align-items-center gap-1'
                          onClick={() => handleDownload(archivo)}
                        >
                          <FaDownload size={12} /> Descargar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          MODAL PREVIEW
      ============================================================ */}
      {preview && (
        <div className='secure-preview-backdrop' onClick={closePreview}>
          <div
            className='secure-preview-modal'
            onClick={e => e.stopPropagation()}
          >
            <div className='secure-preview-header d-flex justify-content-between align-items-center'>
              <h6 className='mb-0 text-truncate'>{preview.archivo.nombre}</h6>
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
                  alt='preview'
                />
              )}

              {preview.tipo === 'pdf' && (
                <iframe
                  src={preview.url}
                  className='secure-preview-iframe'
                  title='PDF'
                />
              )}

              {preview.tipo === 'otro' && (
                <div className='text-center text-muted small'>
                  No hay previsualización disponible.
                </div>
              )}
            </div>

            <div className='secure-preview-footer text-end'>
              <button
                className='btn btn-sm btn-secondary me-2'
                onClick={closePreview}
              >
                Cerrar
              </button>
              <button
                className='btn btn-sm btn-descargar-doc'
                onClick={() => handleDownload(preview.archivo)}
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SecureFolder
