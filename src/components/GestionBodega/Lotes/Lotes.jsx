import { useEffect, useState, useMemo } from 'react'
import Modal from 'react-modal'
import { getLotes, getLotesDisponibles } from './Lotes_service.js'
import { utils, writeFile } from 'xlsx'
import FormLote from './FormLote'
import FormEditarLote from './FormEditarLote'
import './Lotes.css'
import { FaFileExcel } from 'react-icons/fa'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const Lotes = () => {
  const [lotesData, setLotesData] = useState([])
  const [lotesComentarios, setLotesComentarios] = useState({})
  const [loading, setLoading] = useState(true)
  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isEditarModalOpen, setIsEditarModalOpen] = useState(false)
  const [loteSeleccionado, setLoteSeleccionado] = useState(null)
  const [globalFilter, setGlobalFilter] = useState('')

  const { tienePermiso } = usePermisos()
  const permisoLotesProveedor = tienePermiso('lotesProveedor')
  const permisoLotesCliente = tienePermiso('lotesCliente')

  // Helper: ocultar lote "No Aplica" (case-insensitive, con trims)
  const isNoAplica = id =>
    String(id || '')
      .trim()
      .toLowerCase() === 'no aplica'

  useEffect(() => {
    if (permisoLotesProveedor || permisoLotesCliente) {
      fetchLotes()
    }
  }, [permisoLotesProveedor, permisoLotesCliente])

  const fetchLotes = async () => {
    try {
      setLoading(true)
      const [productos, lotes] = await Promise.all([
        getLotes(),
        getLotesDisponibles(),
      ])

      // Mapa de comentarios por lote (sin "No Aplica")
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

  // Filtro por permisos + búsqueda + excluir "No Aplica"
  const filteredLotes = useMemo(() => {
    let list = lotesData.filter(item => !isNoAplica(item.id_lote))

    if (permisoLotesProveedor && !permisoLotesCliente) {
      list = list.filter(item => item.Proveedor !== null)
    }
    if (permisoLotesCliente && !permisoLotesProveedor) {
      list = list.filter(item => item.Cliente !== null)
    }
    if (permisoLotesProveedor && permisoLotesCliente) {
      list = list.filter(
        item => item.Proveedor !== null || item.Cliente !== null
      )
    }

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
    return list
  }, [lotesData, globalFilter, permisoLotesProveedor, permisoLotesCliente])

  // Agrupar por lote y ordenar por fecha mínima del grupo
  const lotesAgrupadosOrdenados = useMemo(() => {
    const agrupados = {}
    for (const item of filteredLotes) {
      const { id_lote } = item
      if (!agrupados[id_lote]) agrupados[id_lote] = []
      agrupados[id_lote].push(item)
    }
    return Object.entries(agrupados).sort((a, b) => {
      const fechaA = Math.min(
        ...a[1].map(r => new Date(r.Fecha_registro).getTime())
      )
      const fechaB = Math.min(
        ...b[1].map(r => new Date(r.Fecha_registro).getTime())
      )
      return fechaA - fechaB
    })
  }, [filteredLotes])

  // Helpers visuales
  const formatNum = (n, digits = 3) => {
    if (n == null || n === '') return ''
    const x = Number(n)
    if (Number.isNaN(x)) return String(n)
    return x.toLocaleString(undefined, { maximumFractionDigits: digits })
  }
  const formatDate = d => new Date(d).toLocaleString()
  const pesoTotal = r =>
    r.PesoUnitarioKg == null
      ? null
      : Number(r.PesoUnitarioKg) * Number(r.Cantidad || 0)

  // Excel (excluye "No Aplica")
  const exportToExcel = () => {
    const filasPlanas = filteredLotes.map(r => ({
      Lote: r.id_lote,
      Producto: r.id_producto,
      Cantidad: r.Cantidad,
      'Peso x Unidad (Kg)':
        r.PesoUnitarioKg == null ? '' : Number(r.PesoUnitarioKg),
      'Peso Total (Kg)': pesoTotal(r) == null ? '' : pesoTotal(r),
      Tipo: r.Proveedor ? 'Proveedor' : 'Cliente',
      Nombre: r.Proveedor?.Nombre || r.Cliente?.Nombre || 'N/A',
      Comentarios: lotesComentarios[r.id_lote] || '',
      Fecha: formatDate(r.Fecha_registro),
    }))
    const hoja = utils.json_to_sheet(filasPlanas)
    const libro = utils.book_new()
    utils.book_append_sheet(libro, hoja, 'Lotes')
    writeFile(libro, 'Lotes.xlsx')
  }

  const handleCerrarEditarModal = () => {
    setLoteSeleccionado(null)
    setIsEditarModalOpen(false)
  }
  const handleSuccessEditar = () => {
    handleCerrarEditarModal()
    fetchLotes()
  }
  const handleSuccessAgregar = () => {
    setIsAgregarModalOpen(false)
    fetchLotes()
  }

  return (
    <>
      {/* Modales */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={() => setIsAgregarModalOpen(false)}
        contentLabel='Agregar Lote'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2 className='mb-4'>Agregar Lote</h2>
        <FormLote onSuccess={handleSuccessAgregar} />
      </Modal>

      <Modal
        isOpen={isEditarModalOpen}
        onRequestClose={handleCerrarEditarModal}
        contentLabel='Editar Lote'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2 className='mb-4'>Editar Lote</h2>
        {loteSeleccionado && (
          <FormEditarLote
            lote={loteSeleccionado}
            onSuccess={handleSuccessEditar}
          />
        )}
      </Modal>

      <div className='lotes-container container mt-4'>
        {/* Toolbar */}
        <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3'>
          <h2 className='m-0'>Lotes</h2>
          <div className='d-flex gap-2 ms-auto'>
            <input
              type='text'
              className='form-control buscador-pequeno'
              placeholder='Buscar lote, producto, cliente, proveedor...'
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <button
              className='btn-excel'
              onClick={exportToExcel}
              title='Exportar a Excel'
            >
              <FaFileExcel size={24} />
            </button>
            <button
              className='btn-agregar-lote'
              onClick={() => setIsAgregarModalOpen(true)}
              disabled={!permisoLotesProveedor && !permisoLotesCliente}
            >
              Agregar Lote
            </button>
          </div>
        </div>

        {loading ? (
          <p>Cargando lotes...</p>
        ) : !permisoLotesProveedor && !permisoLotesCliente ? (
          <p>No tiene permisos para ver los lotes</p>
        ) : (
          <div className='accordion' id='lotesAccordion'>
            {lotesAgrupadosOrdenados.map(([idLote, registros], index) => {
              // fecha mínima del grupo
              const fechaGrupo = formatDate(
                Math.min(
                  ...registros.map(r => new Date(r.Fecha_registro).getTime())
                )
              )
              const comentario = lotesComentarios[idLote] || 'Sin comentarios'

              return (
                <div className='accordion-item' key={idLote}>
                  <h2 className='accordion-header' id={`heading-${index}`}>
                    <button
                      className='accordion-button collapsed'
                      type='button'
                      data-bs-toggle='collapse'
                      data-bs-target={`#collapse-${index}`}
                      aria-expanded='false'
                      aria-controls={`collapse-${index}`}
                    >
                      {/* Encabezado enriquecido */}
                      <div className='w-100 d-flex flex-column flex-md-row align-items-md-center gap-2'>
                        <span className='badge rounded-pill text-bg-primary px-3 py-2'>
                          Lote: {idLote}
                        </span>
                        <span className='text-muted small flex-grow-1'>
                          Comentario: {comentario}
                        </span>
                        <span className='text-muted small'>🗓 {fechaGrupo}</span>
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
                      {/* Comentario destacado en el cuerpo también, por si hace falta */}
                      <p className='text-muted mb-2 d-none d-md-block'>
                        <strong>Comentario del lote:</strong> {comentario}
                      </p>

                      {/* Tabla (desktop) */}
                      <div className='d-none d-md-block'>
                        <table className='table table-bordered table-sm text-center align-middle'>
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th>Peso U. (Kg)</th>
                              <th>Peso Total (Kg)</th>
                              <th>Cliente / Proveedor</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...registros]
                              .sort(
                                (a, b) =>
                                  new Date(a.Fecha_registro) -
                                  new Date(b.Fecha_registro)
                              )
                              .map((r, i) => {
                                const pTotal = pesoTotal(r)
                                const terceroBadge = r.Proveedor?.Nombre ? (
                                  <span className='badge bg-warning text-dark'>
                                    Proveedor: {r.Proveedor.Nombre}
                                  </span>
                                ) : r.Cliente?.Nombre ? (
                                  <span className='badge bg-primary'>
                                    Cliente: {r.Cliente.Nombre}
                                  </span>
                                ) : (
                                  'N/A'
                                )
                                return (
                                  <tr key={i}>
                                    <td className='text-break'>
                                      {r.id_producto}
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
                                      {pTotal == null
                                        ? '—'
                                        : formatNum(pTotal, 3)}
                                    </td>
                                    <td>{terceroBadge}</td>
                                    <td>—</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>

                      {/* Cards (móvil) */}
                      <div className='d-md-none'>
                        {[...registros]
                          .sort(
                            (a, b) =>
                              new Date(a.Fecha_registro) -
                              new Date(b.Fecha_registro)
                          )
                          .map((r, i) => {
                            const pTotal = pesoTotal(r)
                            return (
                              <div key={i} className='card mb-2 shadow-sm'>
                                <div className='card-body'>
                                  <div className='d-flex justify-content-between'>
                                    <strong className='text-break'>
                                      {r.id_producto}
                                    </strong>
                                    <small className='text-muted'>
                                      {formatDate(r.Fecha_registro)}
                                    </small>
                                  </div>
                                  <div className='mt-2 d-flex flex-wrap gap-2'>
                                    <span className='badge text-bg-light'>
                                      Cant: {formatNum(r.Cantidad, 2)}
                                    </span>
                                    {r.PesoUnitarioKg == null ? (
                                      <span className='badge text-bg-secondary'>
                                        Sin peso
                                      </span>
                                    ) : (
                                      <>
                                        <span className='badge text-bg-success'>
                                          U: {formatNum(r.PesoUnitarioKg, 3)} Kg
                                        </span>
                                        <span className='badge text-bg-info'>
                                          Tot: {formatNum(pTotal, 3)} Kg
                                        </span>
                                      </>
                                    )}
                                    {r.Proveedor?.Nombre && (
                                      <span className='badge bg-warning text-dark'>
                                        Prov: {r.Proveedor.Nombre}
                                      </span>
                                    )}
                                    {r.Cliente?.Nombre && (
                                      <span className='badge bg-primary'>
                                        Cli: {r.Cliente.Nombre}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
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
