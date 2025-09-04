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

  // Usar el hook de permisos
  const { tienePermiso } = usePermisos()

  const permisoLotesProveedor = tienePermiso('lotesProveedor')
  const permisoLotesCliente = tienePermiso('lotesCliente')

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

      const comentariosMap = {}
      for (const lote of lotes) {
        comentariosMap[lote.Id_lote] = lote.Comentarios || ''
      }

      setLotesData(productos)
      setLotesComentarios(comentariosMap)
    } catch (error) {
      console.error('Error al obtener los lotes:', error.message)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar lotes basados en el permiso del usuario
  const filteredLotes = useMemo(() => {
    let lotesFiltrados = lotesData

    // Si tiene permiso de proveedor, filtrar solo los que tienen proveedor
    if (permisoLotesProveedor && !permisoLotesCliente) {
      lotesFiltrados = lotesFiltrados.filter(item => item.Proveedor !== null)
    }

    // Si tiene permiso de cliente, filtrar solo los que tienen cliente
    if (permisoLotesCliente && !permisoLotesProveedor) {
      lotesFiltrados = lotesFiltrados.filter(item => item.Cliente !== null)
    }

    // Si tiene ambos permisos, filtrar los que tengan proveedor o cliente
    if (permisoLotesProveedor && permisoLotesCliente) {
      lotesFiltrados = lotesFiltrados.filter(
        item => item.Proveedor !== null || item.Cliente !== null
      )
    }

    // Filtro global de búsqueda
    if (globalFilter) {
      lotesFiltrados = lotesFiltrados.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(globalFilter.toLowerCase())
        )
      )
    }

    return lotesFiltrados
  }, [lotesData, globalFilter, permisoLotesProveedor, permisoLotesCliente])

  const lotesAgrupadosOrdenados = useMemo(() => {
    const agrupados = {}
    for (const item of filteredLotes) {
      const { id_lote } = item
      if (!agrupados[id_lote]) agrupados[id_lote] = []
      agrupados[id_lote].push(item)
    }

    return Object.entries(agrupados).sort((a, b) => {
      const fechaA = Math.min(
        ...a[1].map(item => new Date(item.Fecha_registro).getTime())
      )
      const fechaB = Math.min(
        ...b[1].map(item => new Date(item.Fecha_registro).getTime())
      )
      return fechaA - fechaB
    })
  }, [filteredLotes])

  const exportToExcel = () => {
    const filasPlanas = filteredLotes.map(r => ({
      Lote: r.id_lote,
      Producto: r.id_producto,
      Cantidad: r.Cantidad,
      Tipo: r.Proveedor ? 'Proveedor' : 'Cliente',
      Nombre: r.Proveedor?.Nombre || r.Cliente?.Nombre || 'N/A',
      Comentarios: lotesComentarios[r.id_lote] || '',
      Fecha: new Date(r.Fecha_registro).toLocaleString(),
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
        <div className='lotes-header d-flex justify-content-between align-items-center mb-3'>
          <h2 className='m-0'>Lotes</h2>
          <div className='d-flex gap-2'>
            <button className='btn-excel' onClick={exportToExcel}>
              <FaFileExcel size={32} />
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

        <div className='mb-3'>
          <input
            type='text'
            className='form-control buscador-pequeno'
            placeholder='Buscar lote, producto, cliente, proveedor...'
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Cargando lotes...</p>
        ) : !permisoLotesProveedor && !permisoLotesCliente ? (
          <p>No tiene permisos para ver los lotes</p>
        ) : (
          <div className='accordion' id='lotesAccordion'>
            {lotesAgrupadosOrdenados.map(([idLote, registros], index) => (
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
                    Lote: {idLote}
                  </button>
                </h2>
                <div
                  id={`collapse-${index}`}
                  className='accordion-collapse collapse'
                  aria-labelledby={`heading-${index}`}
                  data-bs-parent='#lotesAccordion'
                >
                  <div className='accordion-body'>
                    {/* Comentario del lote */}
                    <p className='text-muted mb-2'>
                      <strong>Comentario del lote:</strong>{' '}
                      {lotesComentarios[idLote] || 'Sin comentarios'}
                    </p>

                    <table className='table table-bordered table-sm text-center'>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Cliente / Proveedor</th>
                          <th>Fecha de Registro</th>
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
                          .map((r, i) => (
                            <tr key={i}>
                              <td>{r.id_producto}</td>
                              <td>{r.Cantidad}</td>
                              <td>
                                {r.Proveedor?.Nombre && (
                                  <span className='badge bg-warning text-dark'>
                                    Proveedor: {r.Proveedor.Nombre}
                                  </span>
                                )}
                                {r.Cliente?.Nombre && (
                                  <span className='badge bg-primary ms-1'>
                                    Cliente: {r.Cliente.Nombre}
                                  </span>
                                )}
                                {!r.Cliente && !r.Proveedor && 'N/A'}
                              </td>
                              <td>
                                {new Date(r.Fecha_registro).toLocaleString()}
                              </td>
                              <td>—</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default Lotes
