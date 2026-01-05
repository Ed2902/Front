import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getClientes,
  getDocumentosCliente,
  actualizarClienteActivo,
} from './Cliente_service'
import './Cliente.css'
import FormCliente from './FormCliente'
import FormEditarCliente from './FormEditarCliente'
import SecureArchivo from '../SecureArchivo'

const Cliente = () => {
  const [clientes, setClientes] = useState([])
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

  // buscador + filtro estado
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS') // TODOS | ACTIVOS | INACTIVOS

  // documentos por cliente
  const [docsByClient, setDocsByClient] = useState({})
  const [docsLoading, setDocsLoading] = useState({})
  const [docsError, setDocsError] = useState({})

  // modales
  const [modalVisible, setModalVisible] = useState(false)
  const [modalAgregarVisible, setModalAgregarVisible] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getClientes({ page, limit }) // { data, meta }
      setClientes(result?.data || [])
      setMeta(result?.meta || { page, limit, total: 0, totalPages: 1 })
    } catch (error) {
      console.error('Error al obtener clientes:', error)
      setClientes([])
      setMeta({ page, limit, total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  const filteredClientes = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()

    return clientes.filter(c => {
      // filtro por estado
      const isActivo = Boolean(c?.Activo)
      if (estadoFiltro === 'ACTIVOS' && !isActivo) return false
      if (estadoFiltro === 'INACTIVOS' && isActivo) return false

      if (!q) return true

      const valores = [c?.id_Cliente, c?.Nombre, c?.Correo, c?.Celular]
        .filter(Boolean)
        .map(v => String(v).toLowerCase())

      return valores.some(v => v.includes(q))
    })
  }, [clientes, globalFilter, estadoFiltro])

  const loadDocsForClient = async idCliente => {
    if (Array.isArray(docsByClient[idCliente])) return
    if (docsLoading[idCliente]) return

    try {
      setDocsLoading(prev => ({ ...prev, [idCliente]: true }))
      setDocsError(prev => ({ ...prev, [idCliente]: false }))

      const archivos = await getDocumentosCliente(idCliente)
      setDocsByClient(prev => ({
        ...prev,
        [idCliente]: Array.isArray(archivos) ? archivos : [],
      }))
    } catch (e) {
      console.error('Error al obtener documentos cliente:', e)
      setDocsError(prev => ({ ...prev, [idCliente]: true }))
    } finally {
      setDocsLoading(prev => ({ ...prev, [idCliente]: false }))
    }
  }

  const toggleActivo = async (cliente, nuevoEstado) => {
    const ok = window.confirm(
      `¿Seguro que deseas ${
        nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR'
      } el cliente ${cliente.Nombre} (${cliente.id_Cliente})?`
    )
    if (!ok) return

    try {
      await actualizarClienteActivo(cliente.id_Cliente, nuevoEstado)
      await fetchClientes()
    } catch (e) {
      console.error('Error cambiando estado del cliente:', e)
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
        <h2 className='mb-0'>Clientes Registrados</h2>
        <button
          className='btn-agregarform'
          onClick={() => setModalAgregarVisible(true)}
        >
          Agregar Cliente
        </button>
      </div>

      {/* buscador + filtro estado */}
      <div className='row g-2 mb-3'>
        <div className='col-12 col-md-8'>
          <input
            type='text'
            className='form-control buscador-pequeno'
            placeholder='Buscar por nombre, correo, celular o ID'
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>

        <div className='col-12 col-md-4'>
          <select
            className='form-select'
            value={estadoFiltro}
            onChange={e => {
              setEstadoFiltro(e.target.value)
              setPage(1)
            }}
          >
            <option value='TODOS'>Todos</option>
            <option value='ACTIVOS'>Solo activos</option>
            <option value='INACTIVOS'>Solo inactivos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Cargando clientes...</p>
      ) : (
        <div className='accordion' id='clientesAccordion'>
          {filteredClientes.length === 0 ? (
            <p className='text-muted'>No hay clientes para mostrar.</p>
          ) : (
            filteredClientes.map((cliente, index) => {
              const isActivo = Boolean(cliente?.Activo)
              return (
                <div className='accordion-item' key={cliente.id_Cliente}>
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
                      onClick={() => loadDocsForClient(cliente.id_Cliente)}
                    >
                      {cliente.Nombre}{' '}
                      <span className='ms-2 text-muted'>
                        ({cliente.id_Cliente})
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
                    data-bs-parent='#clientesAccordion'
                  >
                    <div className='accordion-body'>
                      <p>
                        <strong>Correo:</strong> {cliente.Correo}
                      </p>
                      <p>
                        <strong>Celular:</strong> {cliente.Celular}
                      </p>

                      <p>
                        <strong>Fecha Registro:</strong>{' '}
                        {cliente.Fecha_registro
                          ? new Date(
                              cliente.Fecha_registro
                            ).toLocaleDateString()
                          : '—'}
                      </p>

                      {!isActivo && cliente.Fecha_desactivacion && (
                        <p className='text-danger'>
                          <strong>Desactivado el:</strong>{' '}
                          {new Date(
                            cliente.Fecha_desactivacion
                          ).toLocaleDateString()}
                        </p>
                      )}

                      {cliente.Fecha_actualizacion && (
                        <p>
                          <strong>Última actualización:</strong>{' '}
                          {new Date(
                            cliente.Fecha_actualizacion
                          ).toLocaleString()}
                        </p>
                      )}

                      <hr />

                      <div className='d-flex justify-content-between align-items-center mb-2'>
                        <h6 className='mb-0'>📄 Documentos:</h6>

                        <div className='d-flex align-items-center gap-3'>
                          {/* Switch sin modal */}
                          <div className='form-check form-switch m-0'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              role='switch'
                              id={`switch-activo-${cliente.id_Cliente}`}
                              checked={isActivo}
                              onChange={e => {
                                const nuevoEstado = e.target.checked
                                e.target.checked = !nuevoEstado // revert visual
                                toggleActivo(cliente, nuevoEstado)
                              }}
                            />
                            <label
                              className='form-check-label'
                              htmlFor={`switch-activo-${cliente.id_Cliente}`}
                            >
                              {isActivo ? 'Activo' : 'Inactivo'}
                            </label>
                          </div>

                          <button
                            className='btn-agregarform'
                            onClick={() => {
                              setClienteSeleccionado(cliente)
                              setModalVisible(true)
                            }}
                          >
                            Actualizar
                          </button>
                        </div>
                      </div>

                      {docsLoading[cliente.id_Cliente] ? (
                        <p className='text-muted'>Cargando documentos...</p>
                      ) : docsError[cliente.id_Cliente] ? (
                        <div className='d-flex align-items-center gap-2'>
                          <span className='text-danger'>
                            Error cargando documentos.
                          </span>
                          <button
                            className='btn btn-outline-secondary btn-sm'
                            onClick={() => {
                              setDocsByClient(prev => {
                                const copy = { ...prev }
                                delete copy[cliente.id_Cliente]
                                return copy
                              })
                              loadDocsForClient(cliente.id_Cliente)
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : Array.isArray(docsByClient[cliente.id_Cliente]) &&
                        docsByClient[cliente.id_Cliente].length > 0 ? (
                        <div className='grid-documentos'>
                          {docsByClient[cliente.id_Cliente].map((doc, i) => (
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

      {/* ✅ PAGINACIÓN AL FINAL (como pediste) */}
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
      {modalVisible && clienteSeleccionado && (
        <div className='modal-backdrop' onClick={() => setModalVisible(false)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormEditarCliente
              cliente={clienteSeleccionado}
              onClose={() => {
                setModalVisible(false)
                setClienteSeleccionado(null)
              }}
              onSuccess={fetchClientes}
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
            <FormCliente
              onClose={() => setModalAgregarVisible(false)}
              onSuccess={fetchClientes}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Cliente
