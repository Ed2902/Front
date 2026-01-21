// src/components/GestionBodega/Lotes/Lotes.jsx
import { useEffect, useState, useMemo, useCallback } from 'react'
import Modal from 'react-modal'
import {
  getLotes,
  getLotesDisponibles,
  getProductosDisponibles,
  getInventarioResumen,
} from './Lotes_service.js'
import EditarRegistro from './EditarRegistro'
import FormLote from './FormLote'
import './Lotes.css'
import { usePermisos } from '../../../hooks/usePermisos'
import FormatoEquivalenteModal from './FormatoEquivalenteModal'

Modal.setAppElement('#root')

// Mini componente para dibujar un punto de estado centrado
const Dot = ({ color = 'var(--bs-secondary)' }) => (
  <span
    className='d-inline-block rounded-circle align-middle'
    style={{
      width: 9,
      height: 9,
      backgroundColor: color,
      verticalAlign: 'middle',
    }}
  />
)

const Lotes = () => {
  const [lotesData, setLotesData] = useState([])
  const [lotesComentarios, setLotesComentarios] = useState({})
  const [loading, setLoading] = useState(true)

  // Modales
  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isEditarRegistroOpen, setIsEditarRegistroOpen] = useState(false)
  const [registroAEditar, setRegistroAEditar] = useState(null)

  // Modal Formato equivalente
  const [isFormatoModalOpen, setIsFormatoModalOpen] = useState(false)
  const [loteTargetId, setLoteTargetId] = useState(null)
  const [loteTargetRegs, setLoteTargetRegs] = useState([])

  // Modal Orden de Remisión
  const [isRemisionModalOpen, setIsRemisionModalOpen] = useState(false)
  const [remisionLoteId, setRemisionLoteId] = useState(null)

  const [globalFilter, setGlobalFilter] = useState('')

  // Catálogo productos id -> nombre
  const [productNameById, setProductNameById] = useState({})

  // Resumen de inventario
  const [inventarioResumen, setInventarioResumen] = useState([])

  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState('todos') // todos | nuevo | operando | cerrado
  const [tipoFiltro, setTipoFiltro] = useState('todos') // todos | rs | bodega

  const { tienePermiso } = usePermisos()
  const permisoLotesProveedor = tienePermiso('lotesProveedor')
  const permisoLotesCliente = tienePermiso('lotesCliente')
  const permisoFormatoEquivalente = tienePermiso('formatoEquivalente')

  const isNoAplica = id =>
    String(id || '')
      .trim()
      .toLowerCase() === 'no aplica'

  const getIdNum = id => {
    const s = String(id || '')
    const matches = s.match(/\d+/g)
    if (!matches || matches.length === 0) return null
    return parseInt(matches[matches.length - 1], 10)
  }

  useEffect(() => {
    if (permisoLotesProveedor || permisoLotesCliente) {
      fetchLotes()
      fetchProductoMap()
      fetchInventarioResumen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisoLotesProveedor, permisoLotesCliente])

  const fetchProductoMap = async () => {
    try {
      const data = await getProductosDisponibles()
      const map = Object.fromEntries(
        (data || []).map(p => [String(p.Id_producto), p.Nombre])
      )
      setProductNameById(map)
    } catch (err) {
      console.error(
        'Error cargando catálogo de productos:',
        err?.message || err
      )
      setProductNameById({})
    }
  }

  const fetchInventarioResumen = async () => {
    try {
      const data = await getInventarioResumen()
      setInventarioResumen(data || [])
    } catch (error) {
      console.error(
        'Error al obtener inventario resumen:',
        error?.message || error
      )
      setInventarioResumen([])
    }
  }

  const fetchLotes = async () => {
    try {
      setLoading(true)
      const [productos, lotes] = await Promise.all([
        getLotes(),
        getLotesDisponibles(),
      ])

      const comentariosMap = {}
      for (const lote of lotes) {
        if (isNoAplica(lote.Id_lote)) continue
        comentariosMap[lote.Id_lote] = lote.Comentarios || ''
      }
      setLotesData(productos)
      setLotesComentarios(comentariosMap)
    } catch (error) {
      console.error('Error al obtener los lotes:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  // ====== ESTADO DEL LOTE (etiqueta compacta con punto a la derecha) ======
  const getEstadoLote = useCallback(
    idLote => {
      const registros = inventarioResumen.filter(r => r.Id_lote === idLote)

      if (registros.length === 0) {
        return {
          key: 'nuevo',
          etiqueta: 'Nuevo',
          dotColor: 'var(--bs-primary)', // azul
          btnBgClass: 'bg-primary-subtle',
          borderClass: 'border-primary',
        }
      }

      const todasCero = registros.every(
        r => Number(r.Cantidad_Inventario) === 0
      )
      if (todasCero) {
        return {
          key: 'cerrado',
          etiqueta: 'Cerrado',
          dotColor: 'var(--bs-danger)', // rojo
          btnBgClass: 'bg-danger-subtle',
          borderClass: 'border-danger',
        }
      }

      return {
        key: 'operando',
        etiqueta: 'Operando',
        dotColor: 'var(--bs-warning)', // amarillo
        btnBgClass: 'bg-warning-subtle',
        borderClass: 'border-warning',
      }
    },
    [inventarioResumen]
  )

  // ====== Tipo de lote por id_lote (rs | bodega) sin mezclas ======
  // rs: tiene al menos un Proveedor y ninguno con Cliente
  // bodega: tiene al menos un Cliente y ninguno con Proveedor
  const tipoPorLote = useMemo(() => {
    const acc = new Map()
    for (const r of lotesData) {
      const id = r.id_lote
      if (isNoAplica(id)) continue
      const hasProv = !!r?.Proveedor
      const hasCli = !!r?.Cliente
      const prev = acc.get(id) || { anyProv: false, anyCli: false }
      acc.set(id, {
        anyProv: prev.anyProv || hasProv,
        anyCli: prev.anyCli || hasCli,
      })
    }
    // convertimos a un map de id -> 'rs' | 'bodega' | 'mixto' | 'desconocido'
    const out = new Map()
    for (const [id, flags] of acc.entries()) {
      if (flags.anyProv && !flags.anyCli) out.set(id, 'rs')
      else if (flags.anyCli && !flags.anyProv) out.set(id, 'bodega')
      else if (flags.anyCli && flags.anyProv) out.set(id, 'mixto')
      else out.set(id, 'desconocido')
    }
    return out
  }, [lotesData])

  // Filtro base (permisos + búsqueda + tipo) y luego filtro por estado
  const filteredLotes = useMemo(() => {
    let list = lotesData.filter(item => !isNoAplica(item.id_lote))

    // permisos
    if (permisoLotesProveedor && !permisoLotesCliente)
      list = list.filter(i => i.Proveedor !== null)
    if (permisoLotesCliente && !permisoLotesProveedor)
      list = list.filter(i => i.Cliente !== null)
    if (permisoLotesProveedor && permisoLotesCliente)
      list = list.filter(i => i.Proveedor !== null || i.Cliente !== null)

    // búsqueda global
    if (globalFilter) {
      const gf = globalFilter.toLowerCase()
      list = list.filter(
        item =>
          Object.values(item).some(v => String(v).toLowerCase().includes(gf)) ||
          String(item?.Proveedor?.Nombre || '')
            .toLowerCase()
            .includes(gf) ||
          String(item?.Cliente?.Nombre || '')
            .toLowerCase()
            .includes(gf)
      )
    }

    // filtro por TIPO (lote completo, sin mezclas)
    if (tipoFiltro !== 'todos') {
      const allowed = new Set(
        [...tipoPorLote.entries()]
          .filter(([, tipo]) => tipo === tipoFiltro)
          .map(([id]) => id)
      )
      list = list.filter(i => allowed.has(i.id_lote))
    } else {
      // si quieres ocultar explícitamente los mixtos cuando está en "todos", descomenta:
      // const notMixed = new Set(
      //   [...tipoPorLote.entries()]
      //     .filter(([, tipo]) => tipo === 'rs' || tipo === 'bodega')
      //     .map(([id]) => id)
      // )
      // list = list.filter(i => notMixed.has(i.id_lote))
    }

    // filtro por ESTADO (usa inventarioResumen)
    if (estadoFiltro !== 'todos') {
      list = list.filter(i => getEstadoLote(i.id_lote).key === estadoFiltro)
    }

    return list
  }, [
    lotesData,
    globalFilter,
    permisoLotesProveedor,
    permisoLotesCliente,
    estadoFiltro,
    tipoFiltro,
    tipoPorLote, // ✅ dependencia para el filtro de tipo
    getEstadoLote, // ✅ dependencia correcta para ESLint
  ])

  const lotesAgrupadosOrdenados = useMemo(() => {
    const agrupados = {}
    for (const item of filteredLotes) {
      const { id_lote } = item
      if (!agrupados[id_lote]) agrupados[id_lote] = []
      agrupados[id_lote].push(item)
    }
    return Object.entries(agrupados).sort((a, b) => {
      const [idA, regsA] = a
      const [idB, regsB] = b
      const nA = getIdNum(idA)
      const nB = getIdNum(idB)
      if (nA != null && nB != null && !Number.isNaN(nA) && !Number.isNaN(nB)) {
        return nB - nA // DESC por número de ID
      }
      const maxA = Math.max(
        ...regsA.map(r => new Date(r.Fecha_registro).getTime())
      )
      const maxB = Math.max(
        ...regsB.map(r => new Date(r.Fecha_registro).getTime())
      )
      return maxB - maxA
    })
  }, [filteredLotes])

  const formatNum = (n, digits = 3) => {
    if (n == null || n === '') return ''
    const x = Number(n)
    if (Number.isNaN(x)) return String(n)
    return x.toLocaleString(undefined, { maximumFractionDigits: digits })
  }
  const pesoTotal = r =>
    r.PesoUnitarioKg == null
      ? null
      : Number(r.PesoUnitarioKg) * Number(r.Cantidad || 0)

  const openEditarRegistro = registro => {
    setRegistroAEditar(registro)
    setIsEditarRegistroOpen(true)
  }
  const closeEditarRegistro = () => {
    setRegistroAEditar(null)
    setIsEditarRegistroOpen(false)
  }

  // Abrir / cerrar Formato equivalente
  const openFormatoModal = (idLote, regsOrdenados) => {
    if (!permisoFormatoEquivalente) return
    setLoteTargetId(idLote)
    setLoteTargetRegs(regsOrdenados)
    setIsFormatoModalOpen(true)
  }
  const closeFormatoModal = () => {
    setIsFormatoModalOpen(false)
    setLoteTargetId(null)
    setLoteTargetRegs([])
  }

  // Abrir / cerrar Remisión
  const openRemisionModal = idLote => {
    setRemisionLoteId(idLote)
    setIsRemisionModalOpen(true)
  }
  const closeRemisionModal = () => {
    setIsRemisionModalOpen(false)
    setRemisionLoteId(null)
  }

  const rowKey = (r, i) =>
    r.id_lote_producto ||
    r.Id_lote_producto ||
    r.id ||
    `${r.id_lote}-${r.id_producto}-${i}`

  // Obtener tercero del lote (uno solo por lote)
  const getTerceroDelLote = registros => {
    const prov = registros.find(r => r.Proveedor?.Nombre)?.Proveedor?.Nombre
    const cli = registros.find(r => r.Cliente?.Nombre)?.Cliente?.Nombre
    return { proveedor: prov || null, cliente: cli || null }
  }

  return (
    <>
      {/* Modal: Agregar Lote */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={() => setIsAgregarModalOpen(false)}
        contentLabel='Agregar Lote'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2 className='mb-4'>Agregar Lote</h2>
        <FormLote
          onSuccess={() => {
            setIsAgregarModalOpen(false)
            fetchLotes()
          }}
        />
      </Modal>

      {/* Modal: Editar registro */}
      <Modal
        isOpen={isEditarRegistroOpen}
        onRequestClose={closeEditarRegistro}
        contentLabel='Editar Registro'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h3 className='mb-3'>Editar producto del lote</h3>
        {registroAEditar && (
          <EditarRegistro
            registro={registroAEditar}
            onCancel={closeEditarRegistro}
            onSuccess={() => {
              closeEditarRegistro()
              fetchLotes()
            }}
          />
        )}
      </Modal>

      {/* Modal: Formato equivalente */}
      {permisoFormatoEquivalente && (
        <FormatoEquivalenteModal
          isOpen={isFormatoModalOpen}
          onClose={closeFormatoModal}
          idLote={loteTargetId}
          registros={loteTargetRegs}
          productNameById={productNameById}
        />
      )}

      {/* Modal: Orden de Remisión (placeholder) */}
      <Modal
        isOpen={isRemisionModalOpen}
        onRequestClose={closeRemisionModal}
        contentLabel='Orden de Remisión'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h3 className='mb-3'>Orden de Remisión — Lote {remisionLoteId}</h3>
        <p>Hola Estará lista pronto</p>
        <div className='text-end'>
          <button className='btn btn-secondary' onClick={closeRemisionModal}>
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Toolbar */}
      <div className='lotes-container container mt-4'>
        <div className='d-flex flex-wrap align-items-center gap-3 mb-3'>
          <h2 className='m-0 me-auto'>Lotes</h2>

          {/* Filtro por tipo (RS / Bodega) */}
          <div
            className='btn-group'
            role='group'
            aria-label='Filtrar tipo de lote'
          >
            <button
              type='button'
              className={`btn btn-sm ${
                tipoFiltro === 'todos' ? 'btn-dark' : 'btn-outline-dark'
              }`}
              onClick={() => setTipoFiltro('todos')}
              title='Mostrar todos los lotes'
            >
              Todos
            </button>
            <button
              type='button'
              className={`btn btn-sm ${
                tipoFiltro === 'rs' ? 'btn-info' : 'btn-outline-info'
              }`}
              onClick={() => setTipoFiltro('rs')}
              title='Solo lotes con Proveedor (RS)'
            >
              RS
            </button>
            <button
              type='button'
              className={`btn btn-sm ${
                tipoFiltro === 'bodega' ? 'btn-success' : 'btn-outline-success'
              }`}
              onClick={() => setTipoFiltro('bodega')}
              title='Solo lotes con Cliente (Bodega)'
            >
              Bodega
            </button>
          </div>

          {/* Filtro por estado */}
          <div className='btn-group' role='group' aria-label='Filtrar estados'>
            <button
              type='button'
              className={`btn btn-sm ${
                estadoFiltro === 'todos' ? 'btn-dark' : 'btn-outline-dark'
              }`}
              onClick={() => setEstadoFiltro('todos')}
            >
              Todos
            </button>
            <button
              type='button'
              className={`btn btn-sm d-inline-flex align-items-center gap-2 ${
                estadoFiltro === 'nuevo' ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setEstadoFiltro('nuevo')}
            >
              <Dot color='var(--bs-primary)' />
              Nuevo
            </button>
            <button
              type='button'
              className={`btn btn-sm d-inline-flex align-items-center gap-2 ${
                estadoFiltro === 'operando'
                  ? 'btn-warning'
                  : 'btn-outline-warning'
              }`}
              onClick={() => setEstadoFiltro('operando')}
            >
              <Dot color='var(--bs-warning)' />
              Operando
            </button>
            <button
              type='button'
              className={`btn btn-sm d-inline-flex align-items-center gap-2 ${
                estadoFiltro === 'cerrado' ? 'btn-danger' : 'btn-outline-danger'
              }`}
              onClick={() => setEstadoFiltro('cerrado')}
            >
              <Dot color='var(--bs-danger)' />
              Cerrado
            </button>
          </div>

          {/* Buscador */}
          <div className='flex-grow-1 d-flex justify-content-center'>
            <input
              type='text'
              className='form-control buscador-pequeno w-75'
              placeholder='Buscar lote, producto...'
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>

          {/* Botón agregar */}
          <div className='d-flex gap-2'>
            <button
              className='btn-agregar-lote'
              onClick={() => setIsAgregarModalOpen(true)}
            >
              Agregar Lote
            </button>
          </div>
        </div>

        {loading ? (
          <p>Cargando lotes...</p>
        ) : (
          <div className='accordion' id='lotesAccordion'>
            {lotesAgrupadosOrdenados.map(([idLote, registros], index) => {
              const fechaGrupo = new Date(
                Math.max(
                  ...registros.map(r => new Date(r.Fecha_registro).getTime())
                )
              ).toLocaleString()
              const comentario = lotesComentarios[idLote] || 'Sin comentarios'

              const regsOrdenados = [...registros].sort(
                (a, b) =>
                  new Date(a.Fecha_registro) - new Date(b.Fecha_registro)
              )

              // Estado visual del lote (para color de header/borde)
              const estado = getEstadoLote(idLote)
              // Tercero del lote (único)
              const { proveedor, cliente } = getTerceroDelLote(regsOrdenados)

              return (
                <div className='accordion-item' key={idLote}>
                  <h2 className='accordion-header' id={`heading-${index}`}>
                    <button
                      className={`accordion-button collapsed ${estado.btnBgClass} border-start border-4 ${estado.borderClass}`}
                      type='button'
                      data-bs-toggle='collapse'
                      data-bs-target={`#collapse-${index}`}
                      aria-expanded='false'
                      aria-controls={`collapse-${index}`}
                    >
                      <div className='w-100 d-flex flex-column flex-md-row align-items-md-center gap-2'>
                        <span className='badge rounded-pill text-bg-primary px-3 py-2'>
                          Lote: {idLote}
                        </span>

                        {/* Tercero (único por lote) */}
                        {proveedor && (
                          <span className='badge bg-warning text-dark'>
                            Proveedor: {proveedor}
                          </span>
                        )}
                        {!proveedor && cliente && (
                          <span className='badge bg-primary'>
                            Cliente: {cliente}
                          </span>
                        )}

                        <span className='text-muted small flex-grow-1'>
                          Comentario: {comentario}
                        </span>
                        <span className='text-muted small'>
                          Fecha: {fechaGrupo}
                        </span>

                        {/* Estado compacto a la derecha */}
                        <span
                          className='ms-auto d-inline-flex align-items-center gap-2 small text-uppercase fw-semibold'
                          aria-label={`Estado: ${estado.etiqueta}`}
                        >
                          <Dot color={estado.dotColor} />
                          {estado.etiqueta}
                        </span>
                      </div>
                    </button>
                  </h2>

                  <div
                    id={`collapse-${index}`}
                    className='accordion-collapse collapse'
                    aria-labelledby={`heading-${index}`}
                    data-bs-parent='#lotesAccordion'
                  >
                    <div className='accordion-body'>
                      {/* Acciones por lote (según tercero) */}
                      <div className='d-flex justify-content-end mb-2 gap-2'>
                        {permisoFormatoEquivalente && proveedor && (
                          <button
                            type='button'
                            className='btn btn-outline-primary btn-sm'
                            onClick={() =>
                              openFormatoModal(idLote, regsOrdenados)
                            }
                          >
                            Formato equivalente
                          </button>
                        )}

                        {cliente && (
                          <button
                            type='button'
                            className='btn btn-outline-success btn-sm'
                            onClick={() => openRemisionModal(idLote)}
                          >
                            Orden de remisión
                          </button>
                        )}
                      </div>

                      <table className='table table-bordered table-sm text-center align-middle'>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Peso U. (Kg)</th>
                            <th>Peso Total (Kg)</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regsOrdenados.map((r, i) => {
                            const pTotal = pesoTotal(r)
                            const nombre =
                              productNameById[String(r.id_producto)] ||
                              r.Nombre ||
                              ''
                            return (
                              <tr key={rowKey(r, i)}>
                                <td className='text-break'>
                                  <div className='text-start'>
                                    <div className='fw-semibold'>
                                      {r.id_producto}
                                    </div>
                                    <div className='text-muted small'>
                                      {nombre}
                                    </div>
                                  </div>
                                </td>
                                <td>{formatNum(r.Cantidad, 2)}</td>
                                <td>
                                  {r.PesoUnitarioKg == null ? (
                                    <span className='badge text-bg-secondary'>
                                      Sin peso
                                    </span>
                                  ) : (
                                    <span className='badge text-bg-success'>
                                      {formatNum(r.PesoUnitarioKg, 3)}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {pTotal == null ? '—' : formatNum(pTotal, 3)}
                                </td>
                                <td className='text-nowrap'>
                                  <button
                                    type='button'
                                    className='btn btn-outline-secondary btn-sm'
                                    onClick={() => openEditarRegistro(r)}
                                    title={`Editar ${r.id_producto}`}
                                  >
                                    Editar
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

export default Lotes
