import { useEffect, useState, useMemo } from 'react'
import Modal from 'react-modal'
import {
  getLotes,
  getLotesDisponibles,
  getProductosDisponibles,
} from './Lotes_service.js' // 👈 import catálogo
import EditarRegistro from './EditarRegistro'
import { utils, writeFile } from 'xlsx'
import FormLote from './FormLote'
import './Lotes.css'
import { FaFileExcel } from 'react-icons/fa'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const Lotes = () => {
  const [lotesData, setLotesData] = useState([])
  const [lotesComentarios, setLotesComentarios] = useState({})
  const [loading, setLoading] = useState(true)

  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  // Removed unused state: isEditarModalOpen, loteSeleccionado

  const [isEditarRegistroOpen, setIsEditarRegistroOpen] = useState(false)
  const [registroAEditar, setRegistroAEditar] = useState(null)

  const [globalFilter, setGlobalFilter] = useState('')

  // 👇 catálogo productos en mapa id->nombre
  const [productNameById, setProductNameById] = useState({})

  const { tienePermiso } = usePermisos()
  const permisoLotesProveedor = tienePermiso('lotesProveedor')
  const permisoLotesCliente = tienePermiso('lotesCliente')

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
      fetchProductoMap() // 👈 cargar nombres
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisoLotesProveedor, permisoLotesCliente])

  const fetchProductoMap = async () => {
    try {
      const data = await getProductosDisponibles()
      // data: [{ Id_producto, Nombre, ... }]
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

  const filteredLotes = useMemo(() => {
    let list = lotesData.filter(item => !isNoAplica(item.id_lote))

    if (permisoLotesProveedor && !permisoLotesCliente)
      list = list.filter(i => i.Proveedor !== null)
    if (permisoLotesCliente && !permisoLotesProveedor)
      list = list.filter(i => i.Cliente !== null)
    if (permisoLotesProveedor && permisoLotesCliente)
      list = list.filter(i => i.Proveedor !== null || i.Cliente !== null)

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
  const formatDate = d => new Date(d).toLocaleString()
  const pesoTotal = r =>
    r.PesoUnitarioKg == null
      ? null
      : Number(r.PesoUnitarioKg) * Number(r.Cantidad || 0)

  const exportToExcel = () => {
    const filasPlanas = filteredLotes.map(r => ({
      Lote: r.id_lote,
      Producto: `${r.id_producto} — ${
        productNameById[String(r.id_producto)] || r.Nombre || ''
      }`, // 👈 id + nombre
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

  const openEditarRegistro = registro => {
    setRegistroAEditar(registro)
    setIsEditarRegistroOpen(true)
  }
  const closeEditarRegistro = () => {
    setRegistroAEditar(null)
    setIsEditarRegistroOpen(false)
  }

  const rowKey = (r, i) =>
    r.id_lote_producto ||
    r.Id_lote_producto ||
    r.id ||
    `${r.id_lote}-${r.id_producto}-${i}`

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
        <FormLote
          onSuccess={() => {
            setIsAgregarModalOpen(false)
            fetchLotes()
          }}
        />
      </Modal>

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

      {/* Toolbar */}
      <div className='lotes-container container mt-4'>
        <div className='d-flex flex-wrap align-items-center gap-2 mb-3'>
          <h2 className='m-0 me-auto'>Lotes</h2>
          <div className='flex-grow-1 d-flex justify-content-center'>
            <input
              type='text'
              className='form-control buscador-pequeno w-75'
              placeholder='Buscar lote, producto, cliente, proveedor...'
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
          <div className='d-flex gap-2'>
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
                      <div className='w-100 d-flex flex-column flex-md-row align-items-md-center gap-2'>
                        <span className='badge rounded-pill text-bg-primary px-3 py-2'>
                          Lote: {idLote}
                        </span>
                        <span className='text-muted small flex-grow-1'>
                          Comentario: {comentario}
                        </span>
                        <span className='text-muted small'>
                          Fecha: {fechaGrupo}
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
                                      </div>{' '}
                                      {/* 👈 nombre debajo */}
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
                                    {pTotal == null
                                      ? '—'
                                      : formatNum(pTotal, 3)}
                                  </td>
                                  <td>{terceroBadge}</td>
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
