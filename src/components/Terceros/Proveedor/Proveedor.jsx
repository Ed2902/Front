import React, { useEffect, useMemo, useState, useCallback } from 'react'
import FormProveedor from './FormProveedor'
import FormEditarProveedor from './FormEditarProveedor'
import SecureArchivo from '../SecureArchivo'
import {
  getProveedores,
  getDocumentosProveedor,
  actualizarProveedorActivo,
} from './Proveedor_service'
import './Proveedor.css'

const Proveedor = () => {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)

  // paginación
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })

  // buscador + filtros
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS')
  const [tipoFiltro, setTipoFiltro] = useState('TODOS')

  // documentos por proveedor (cache estable)
  const [docsByProveedor, setDocsByProveedor] = useState({})
  const [docsLoading, setDocsLoading] = useState({})
  const [docsError, setDocsError] = useState({})

  // modales forms
  const [modalVisible, setModalVisible] = useState(false)
  const [modalAgregarVisible, setModalAgregarVisible] = useState(false)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null)

  const fetchProveedores = useCallback(async () => {
    try {
      setLoading(true)

      // getProveedores retorna { data, meta }
      const payload = await getProveedores({ page, limit })

      setProveedores(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || { page, limit, total: 0, totalPages: 1 })
    } catch (err) {
      console.error('Error al cargar proveedores:', err)
      setProveedores([])
      setMeta({ page, limit, total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    fetchProveedores()
  }, [fetchProveedores])

  const filteredProveedores = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    const tipoFiltroNorm = (tipoFiltro || 'TODOS').toUpperCase()

    return proveedores.filter(p => {
      const isActivo = Boolean(p?.Activo)
      const tipo = (p?.Tipo_proveedor || '').toUpperCase()

      // filtro estado
      if (estadoFiltro === 'ACTIVOS' && !isActivo) return false
      if (estadoFiltro === 'INACTIVOS' && isActivo) return false

      // filtro tipo
      if (tipoFiltroNorm !== 'TODOS' && tipo !== tipoFiltroNorm) return false

      // filtro texto
      if (!q) return true

      const valores = [
        p?.id_proveedor,
        p?.Nombre,
        p?.Correo,
        p?.Telefono,
        p?.Tipo_proveedor,
        p?.Direccion,
        p?.Contacto,
      ]
        .filter(Boolean)
        .map(v => String(v).toLowerCase())

      return valores.some(v => v.includes(q))
    })
  }, [proveedores, globalFilter, estadoFiltro, tipoFiltro])

  const loadDocsForProveedor = async idProveedor => {
    if (Array.isArray(docsByProveedor[idProveedor])) return
    if (docsLoading[idProveedor]) return

    try {
      setDocsLoading(prev => ({ ...prev, [idProveedor]: true }))
      setDocsError(prev => ({ ...prev, [idProveedor]: false }))

      const archivos = await getDocumentosProveedor(idProveedor) // array
      setDocsByProveedor(prev => ({
        ...prev,
        [idProveedor]: Array.isArray(archivos) ? archivos : [],
      }))
    } catch (e) {
      console.error('Error al obtener documentos proveedor:', e)
      setDocsError(prev => ({ ...prev, [idProveedor]: true }))
    } finally {
      setDocsLoading(prev => ({ ...prev, [idProveedor]: false }))
    }
  }

  const toggleActivo = async (proveedor, nuevoEstado) => {
    const ok = window.confirm(
      `¿Seguro que deseas ${
        nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR'
      } el proveedor ${proveedor.Nombre} (${proveedor.id_proveedor})?`
    )
    if (!ok) return

    try {
      await actualizarProveedorActivo(proveedor.id_proveedor, nuevoEstado)
      await fetchProveedores()
    } catch (e) {
      console.error('Error cambiando estado del proveedor:', e)
      alert('No se pudo actualizar el estado. Revisa consola.')
    }
  }

  const formatearNombre = nombre => {
    if (!nombre) return ''
    const partes = nombre.split('-')
    if (partes.length > 1) {
      const tipo = partes[0].replace(/_/g, ' ')
      const resto = partes
        .slice(1)
        .join('-')
        .replace(/\.(pdf|docx)$/i, '')
      return `${tipo.toUpperCase()} (${resto})`
    }
    return nombre
  }

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h2 className='mb-0'>Proveedores Registrados</h2>
        <button
          className='btn-agregarform'
          onClick={() => setModalAgregarVisible(true)}
        >
          Agregar Proveedor
        </button>
      </div>

      {/* buscador + filtros */}
      <div className='row g-2 mb-3'>
        <div className='col-12 col-lg-6'>
          <input
            type='text'
            className='form-control buscador-pequeno'
            placeholder='Buscar por nombre, correo, ID, tipo, dirección o contacto'
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>

        <div className='col-12 col-md-6 col-lg-3'>
          <select
            className='form-select'
            value={estadoFiltro}
            onChange={e => {
              setEstadoFiltro(e.target.value)
              setPage(1)
            }}
          >
            <option value='TODOS'>Todos (Estado)</option>
            <option value='ACTIVOS'>Solo activos</option>
            <option value='INACTIVOS'>Solo inactivos</option>
          </select>
        </div>

        <div className='col-12 col-md-6 col-lg-3'>
          <select
            className='form-select'
            value={tipoFiltro}
            onChange={e => {
              setTipoFiltro(e.target.value)
              setPage(1)
            }}
          >
            <option value='TODOS'>Todos (Tipo)</option>
            <option value='RS'>Solo RS</option>
            <option value='Logistica internacional'>
              Logistica internacional
            </option>
            <option value='Bodega'>Solo Bodega</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Cargando proveedores...</p>
      ) : (
        <div className='accordion' id='proveedoresAccordion'>
          {filteredProveedores.length === 0 ? (
            <p className='text-muted'>No hay proveedores para mostrar.</p>
          ) : (
            filteredProveedores.map((p, index) => {
              const isActivo = Boolean(p?.Activo)
              const tipo = (p?.Tipo_proveedor || '').toUpperCase()

              return (
                <div className='accordion-item' key={p.id_proveedor}>
                  <h2 className='accordion-header' id={`heading-${index}`}>
                    <button
                      className={`accordion-button collapsed ${
                        !isActivo ? 'text-danger' : ''
                      }`}
                      type='button'
                      data-bs-toggle='collapse'
                      data-bs-target={`#collapse-${index}`}
                      aria-expanded='false'
                      aria-controls={`collapse-${index}`}
                      onClick={() => loadDocsForProveedor(p.id_proveedor)}
                    >
                      {p.Nombre}{' '}
                      <span className='ms-2 text-muted'>
                        ({p.id_proveedor}) {tipo ? `- ${tipo}` : ''}
                      </span>
                      <span
                        className={`ms-3 badge ${
                          isActivo ? 'bg-success' : 'bg-danger'
                        }`}
                      >
                        {isActivo ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </h2>

                  <div
                    id={`collapse-${index}`}
                    className='accordion-collapse collapse'
                    aria-labelledby={`heading-${index}`}
                    data-bs-parent='#proveedoresAccordion'
                  >
                    <div className='accordion-body'>
                      <p>
                        <strong>Correo:</strong> {p.Correo}
                      </p>
                      <p>
                        <strong>Teléfono:</strong> {p.Telefono}
                      </p>
                      <p>
                        <strong>Tipo:</strong> {p.Tipo_proveedor || '—'}
                      </p>
                      <p>
                        <strong>Dirección:</strong> {p.Direccion || '—'}
                      </p>
                      <p>
                        <strong>Contacto:</strong> {p.Contacto || '—'}
                      </p>

                      <p>
                        <strong>Fecha Registro:</strong>{' '}
                        {p.Fecha_registro
                          ? new Date(p.Fecha_registro).toLocaleDateString()
                          : '—'}
                      </p>

                      {!isActivo && p.Fecha_desactivacion && (
                        <p className='text-danger'>
                          <strong>Desactivado el:</strong>{' '}
                          {new Date(p.Fecha_desactivacion).toLocaleDateString()}
                        </p>
                      )}

                      {p.Fecha_actualizacion && (
                        <p>
                          <strong>Última actualización:</strong>{' '}
                          {new Date(p.Fecha_actualizacion).toLocaleString()}
                        </p>
                      )}

                      <hr />

                      <div className='d-flex justify-content-between align-items-center mb-2'>
                        <h6 className='mb-0'>📄 Documentos:</h6>

                        <div className='d-flex align-items-center gap-3'>
                          {/* switch sin modal */}
                          <div className='form-check form-switch m-0'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              role='switch'
                              id={`switch-activo-${p.id_proveedor}`}
                              checked={isActivo}
                              onChange={e => {
                                const nuevoEstado = e.target.checked
                                e.target.checked = !nuevoEstado // revert visual
                                toggleActivo(p, nuevoEstado)
                              }}
                            />
                            <label
                              className='form-check-label'
                              htmlFor={`switch-activo-${p.id_proveedor}`}
                            >
                              {isActivo ? 'Activo' : 'Inactivo'}
                            </label>
                          </div>

                          <button
                            className='btn-agregarform'
                            onClick={() => {
                              setProveedorSeleccionado(p)
                              setModalVisible(true)
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      </div>

                      {/* SecureArchivo */}
                      {docsLoading[p.id_proveedor] ? (
                        <p className='text-muted'>Cargando documentos...</p>
                      ) : docsError[p.id_proveedor] ? (
                        <div className='d-flex align-items-center gap-2'>
                          <span className='text-danger'>
                            Error cargando documentos.
                          </span>
                          <button
                            className='btn btn-outline-secondary btn-sm'
                            onClick={() => {
                              setDocsByProveedor(prev => {
                                const copy = { ...prev }
                                delete copy[p.id_proveedor]
                                return copy
                              })
                              loadDocsForProveedor(p.id_proveedor)
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : Array.isArray(docsByProveedor[p.id_proveedor]) &&
                        docsByProveedor[p.id_proveedor].length > 0 ? (
                        <div className='grid-documentos'>
                          {docsByProveedor[p.id_proveedor].map((doc, i) => (
                            <div className='card-doc' key={`${doc?.url || i}`}>
                              <div className='nombre-doc'>
                                {formatearNombre(doc?.nombre || 'Documento')}
                              </div>

                              <div className='mt-2'>
                                <SecureArchivo
                                  rutaRelativa={doc?.url}
                                  nombreArchivo={doc?.nombre}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className='text-muted'>
                          No hay documentos disponibles.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ✅ PAGINACIÓN AL FINAL */}
      <div className='d-flex flex-wrap gap-2 align-items-center mt-3'>
        <button
          className='btn btn-outline-secondary btn-sm'
          disabled={meta.page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          ◀ Anterior
        </button>

        <span className='text-muted'>
          Página {meta.page} de {meta.totalPages} — Total: {meta.total}
        </span>

        <button
          className='btn btn-outline-secondary btn-sm'
          disabled={meta.page >= meta.totalPages}
          onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
        >
          Siguiente ▶
        </button>

        <div className='ms-auto d-flex align-items-center gap-2'>
          <label className='text-muted mb-0'>Por página</label>
          <select
            className='form-select form-select-sm'
            style={{ width: 90 }}
            value={limit}
            onChange={e => {
              setLimit(Number(e.target.value))
              setPage(1)
            }}
          >
            {[10, 20, 50, 100].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* modal editar */}
      {modalVisible && proveedorSeleccionado && (
        <div className='modal-backdrop' onClick={() => setModalVisible(false)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormEditarProveedor
              proveedor={proveedorSeleccionado}
              onClose={() => {
                setModalVisible(false)
                setProveedorSeleccionado(null)
              }}
              onSuccess={fetchProveedores}
            />
          </div>
        </div>
      )}

      {/* modal agregar */}
      {modalAgregarVisible && (
        <div
          className='modal-backdrop'
          onClick={() => setModalAgregarVisible(false)}
        >
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormProveedor
              onClose={() => setModalAgregarVisible(false)}
              onSuccess={fetchProveedores}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Proveedor
