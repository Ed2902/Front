import { useState, useEffect, useMemo } from 'react'
import Modal from 'react-modal'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { BiEditAlt } from 'react-icons/bi'
import { utils, writeFile } from 'xlsx'
import { getProductos } from './Producto_service'
import FormProducto from './form_Producto'
import FormEditarProducto from './FormEditarProducto'
import { usePermisos } from '../../../hooks/usePermisos'

// 👇 ya lo tenías
Modal.setAppElement('#root')

const Producto = () => {
  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isEditarModalOpen, setIsEditarModalOpen] = useState(false)
  const [productos, setProductos] = useState([])
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')

  const { tienePermiso } = usePermisos()

  useEffect(() => {
    fetchProductos()
  }, [])

  const fetchProductos = async () => {
    try {
      setLoading(true)
      const data = await getProductos()
      setProductos(data)
    } catch (error) {
      console.error('Error cargando productos:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProductos = useMemo(() => {
    const filtradosPorPermiso = (productos || []).filter(producto => {
      if (producto?.Tipo === 'RS' && !tienePermiso('productosRS')) return false
      if (producto?.Tipo === 'Bodega' && !tienePermiso('productosBodega'))
        return false
      return true
    })

    if (!globalFilter?.trim()) return filtradosPorPermiso

    const q = globalFilter.trim().toLowerCase()
    return filtradosPorPermiso.filter(producto =>
      Object.values(producto ?? {}).some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [productos, globalFilter, tienePermiso])

  const handleAgregarProducto = () => setIsAgregarModalOpen(true)
  const handleCerrarAgregarModal = () => setIsAgregarModalOpen(false)

  const handleEditar = producto => {
    setProductoSeleccionado(producto)
    setIsEditarModalOpen(true)
  }
  const handleCerrarEditarModal = () => {
    setProductoSeleccionado(null)
    setIsEditarModalOpen(false)
  }
  const handleSuccessEditar = () => {
    handleCerrarEditarModal()
    fetchProductos()
  }

  const exportToExcel = () => {
    // 🔁 Mantenemos tu lógica original: exporta TODO 'productos'
    const worksheet = utils.json_to_sheet(productos || [])
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Productos')
    writeFile(workbook, 'Productos.xlsx')
  }

  // ===== Columnas DataTable (equivalentes a tus accessorKey) =====
  const columns = useMemo(
    () => [
      {
        name: 'ID Producto',
        selector: r => r?.Id_producto,
        sortable: true,
        width: '160px',
      },
      {
        name: 'Nombre',
        selector: r => r?.Nombre,
        sortable: true,
        grow: 3,
        wrap: true,
      },
      {
        name: 'Referencia',
        selector: r => r?.Referencia,
        sortable: true,
        width: '160px',
        wrap: true,
      },
      { name: 'Tipo', selector: r => r?.Tipo, sortable: true, width: '120px' },
      {
        name: 'Alto',
        selector: r => r?.Alto,
        sortable: true,
        right: true,
        width: '110px',
      },
      {
        name: 'Ancho',
        selector: r => r?.Ancho,
        sortable: true,
        right: true,
        width: '110px',
      },
      {
        name: 'Largo',
        selector: r => r?.Largo,
        sortable: true,
        right: true,
        width: '110px',
      },
      {
        name: 'Unidad',
        selector: r => r?.Unidad_de_medida,
        sortable: true,
        width: '130px',
      },
      {
        name: 'Editar',
        width: '110px',
        sortable: false,
        cell: row => (
          <button
            className='btn btn-sm btn-outline-primary'
            onClick={() => handleEditar(row)}
            title='Editar'
          >
            <BiEditAlt size={16} />
          </button>
        ),
        ignoreRowClick: true,
        allowOverflow: true,
        button: true,
      },
    ],
    [] // no depende de props/estado
  )

  // ===== Estilos DataTable (sin CSS propio) =====
  const customStyles = {
    headCells: {
      style: {
        fontWeight: 600,
        whiteSpace: 'normal',
        lineHeight: '1.1',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
      },
    },
    rows: { style: { minHeight: '44px' } },
  }

  // ===== SubHeader: buscador + export + agregar =====
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 360 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='ID, nombre, referencia…'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-2'>
        <button className='btn btn-sm btn-success' onClick={exportToExcel}>
          <FaFileExcel className='me-1' /> Exportar
        </button>

        {(tienePermiso('productosRS') || tienePermiso('productosBodega')) && (
          <button
            className='btn btn-sm btn-primary'
            onClick={handleAgregarProducto}
          >
            Agregar producto
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Modal Agregar */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={handleCerrarAgregarModal}
        contentLabel='Agregar Producto'
        className='modal-content' // si no tienes estilos, seguirá funcionando sin problema
        overlayClassName='modal-overlay'
      >
        <h5 className='mb-3'>Agregar producto</h5>
        <FormProducto
          onSuccess={() => {
            handleCerrarAgregarModal()
            fetchProductos()
          }}
        />
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={isEditarModalOpen}
        onRequestClose={handleCerrarEditarModal}
        contentLabel='Editar Producto'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h5 className='mb-3'>Editar producto</h5>
        {productoSeleccionado && (
          <FormEditarProducto
            producto={productoSeleccionado}
            onSuccess={handleSuccessEditar}
          />
        )}
      </Modal>

      {/* Contenedor con Bootstrap, sin CSS propio */}
      <div className='card'>
        <div className='card-header d-flex align-items-center'>
          <strong>Productos</strong>
        </div>

        <div className='card-body'>
          <DataTable
            columns={columns}
            data={filteredProductos}
            progressPending={loading}
            pagination
            paginationPerPage={30}
            paginationRowsPerPageOptions={[30, 50, 100]}
            highlightOnHover
            dense
            responsive
            customStyles={customStyles}
            subHeader
            subHeaderComponent={SubHeader}
            persistTableHead
            noDataComponent={
              <div className='text-muted small py-3'>Sin datos.</div>
            }
          />
        </div>
      </div>
    </>
  )
}

export default Producto
