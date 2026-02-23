import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Modal as AntdModal } from 'antd'
import { FaFileImage, FaFilePdf } from 'react-icons/fa'

const WMS_API_BASE = String(import.meta.env.VITE_API_URL || '').replace(
  /\/+$/,
  ''
)
const WMS_FILES_BASE = WMS_API_BASE.replace(/\/api\/?$/i, '')

const toAbsolutePreviewUrl = src => {
  const value = String(src || '').trim()
  if (!value) return ''

  const isAbs = /^https?:\/\//i.test(value)
  const normalizedRel = value.replace(/^\/+/, '')

  if (!isAbs) {
    return `${WMS_FILES_BASE}/${normalizedRel}`
  }

  return value.replace(/\/api\/uploads\//i, '/uploads/')
}

const isImageDoc = doc => {
  const mime = String(doc?.mime || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  const name = String(doc?.nombre_original || doc?.ruta || '').toLowerCase()
  return /\.(png|jpe?g|webp|gif)$/i.test(name)
}

export default function DocumentosLoteModal({
  open,
  viewer,
  onClose,
  onSelectDoc,
}) {
  const [preview, setPreview] = useState({
    loading: false,
    error: null,
    url: '',
    tipo: 'otro',
  })

  const selectedDoc = viewer?.selectedDoc || null

  const selectedType = useMemo(() => {
    if (!selectedDoc) return 'otro'
    if (isImageDoc(selectedDoc)) return 'imagen'

    const docTipo = String(selectedDoc?.tipo || '').toLowerCase()
    if (docTipo.includes('pdf')) return 'pdf'

    const mime = String(selectedDoc?.mime || '').toLowerCase()
    if (mime === 'application/pdf') return 'pdf'

    const name = String(selectedDoc?.nombre_original || selectedDoc?.ruta || '')
    if (/\.pdf$/i.test(name)) return 'pdf'

    const ruta = String(selectedDoc?.ruta || selectedDoc?.url || '')
    if (/\.pdf(\?|#|$)/i.test(ruta)) return 'pdf'

    return 'otro'
  }, [selectedDoc])

  useEffect(() => {
    if (!open || !selectedDoc) {
      setPreview(prev => {
        if (prev.url) URL.revokeObjectURL(prev.url)
        return {
          loading: false,
          error: null,
          url: '',
          tipo: 'otro',
        }
      })
      return undefined
    }

    let cancelled = false

    const loadPreview = async () => {
      const src = toAbsolutePreviewUrl(selectedDoc.url || selectedDoc.ruta)
      if (!src) {
        setPreview({
          loading: false,
          error: 'Ruta de archivo inválida.',
          url: '',
          tipo: 'otro',
        })
        return
      }

      try {
        setPreview(prev => {
          if (prev.url) URL.revokeObjectURL(prev.url)
          return { loading: true, error: null, url: '', tipo: selectedType }
        })

        const token = localStorage.getItem('token')
        const resp = await axios.get(src, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (cancelled) return

        const blobUrl = URL.createObjectURL(resp.data)
        setPreview({
          loading: false,
          error: null,
          url: blobUrl,
          tipo: selectedType,
        })
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        if (cancelled) return
        setPreview({
          loading: false,
          error: 'No se pudo visualizar este archivo.',
          url: '',
          tipo: selectedType,
        })
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      setPreview(prev => {
        if (prev.url) URL.revokeObjectURL(prev.url)
        return { ...prev, url: '' }
      })
    }
  }, [open, selectedDoc, selectedType])

  const title = viewer?.idLote
    ? `Documentos del lote ${viewer.idLote}`
    : viewer?.selectedDoc?.nombre_original || 'Vista previa de archivo'

  return (
    <AntdModal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      centered
      width='88vw'
      destroyOnClose={false}
      styles={{ body: { padding: 10, maxHeight: '80vh', overflow: 'hidden' } }}
    >
      <div className='row g-2'>
        <div className='col-12 col-lg-4'>
          {viewer?.loading && (
            <div className='small text-muted p-2'>Cargando documentos...</div>
          )}

          {viewer?.error && (
            <div className='small text-danger p-2'>{viewer.error}</div>
          )}

          {!viewer?.loading && !viewer?.error && (
            <div
              className='list-group'
              style={{ maxHeight: '68vh', overflowY: 'auto' }}
            >
              {viewer?.docs?.length ? (
                viewer.docs.map(doc => {
                  const active =
                    (viewer?.selectedDoc?._id || '') === (doc?._id || '')
                  return (
                    <button
                      key={doc._id || `${doc.tipo}-${doc.ruta}`}
                      type='button'
                      className={`list-group-item list-group-item-action ${
                        active ? 'active' : ''
                      }`}
                      onClick={() => onSelectDoc?.(doc)}
                    >
                      <div className='d-flex align-items-center gap-2'>
                        {isImageDoc(doc) ? <FaFileImage /> : <FaFilePdf />}
                        <span className='fw-semibold text-uppercase small'>
                          {doc.tipo === 'cuenta_cobro'
                            ? 'Cuenta'
                            : doc.tipo === 'soporte_pago'
                              ? 'Soporte'
                              : 'Documento'}
                        </span>
                      </div>
                      <div className='small text-truncate'>
                        {doc.nombre_original || 'Documento'}
                      </div>
                      <div className='small opacity-75'>
                        {doc.createdAt
                          ? new Date(doc.createdAt).toLocaleString('es-CO')
                          : ''}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className='small text-muted p-2'>
                  No hay documentos para mostrar.
                </div>
              )}
            </div>
          )}
        </div>

        <div className='col-12 col-lg-8'>
          {selectedDoc ? (
            <div
              style={{
                height: Math.max(520, window.innerHeight - 280),
                background: '#0f172a',
                borderRadius: 10,
                padding: 8,
              }}
            >
              {preview.loading && (
                <div className='h-100 d-flex align-items-center justify-content-center text-muted'>
                  Cargando vista previa...
                </div>
              )}

              {!preview.loading && preview.error && (
                <div className='h-100 d-flex align-items-center justify-content-center text-danger'>
                  {preview.error}
                </div>
              )}

              {!preview.loading &&
                !preview.error &&
                preview.url &&
                preview.tipo !== 'imagen' && (
                  <iframe
                    src={preview.url}
                    title={selectedDoc.nombre_original || 'Vista previa PDF'}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 0,
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  />
                )}

              {!preview.loading &&
                !preview.error &&
                preview.url &&
                preview.tipo === 'imagen' && (
                  <img
                    src={preview.url}
                    alt={selectedDoc.nombre_original || 'Imagen'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  />
                )}

              {!preview.loading &&
                !preview.error &&
                !preview.url &&
                preview.tipo === 'otro' && (
                  <div className='h-100 d-flex align-items-center justify-content-center text-muted'>
                    Este tipo de archivo no tiene previsualización.
                  </div>
                )}
            </div>
          ) : (
            <div className='text-muted small p-2'>
              Selecciona un archivo para ver.
            </div>
          )}
        </div>
      </div>
    </AntdModal>
  )
}
