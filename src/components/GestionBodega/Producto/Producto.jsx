import { useState, useEffect, useMemo } from 'react'
import Modal from 'react-modal'
import { FaFileExcel } from 'react-icons/fa'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiEditAlt, BiSortUp, BiSortDown } from 'react-icons/bi'
import { getProductos } from './Producto_service'
import { utils, writeFile } from 'xlsx'
import './Producto.css'

import FormProducto from './form_Producto'
import FormEditarProducto from './FormEditarProducto'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const Producto = () => {
  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isEditarModalOpen, setIsEditarModalOpen] = useState(false)
  const [productos, setProductos] = useState([])
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 30,
  })

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
      console.error('Error cargando productos:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProductos = useMemo(() => {
    const filtradosPorPermiso = productos.filter(producto => {
      if (producto.Tipo === 'RS' && !tienePermiso('productosRS')) return false
      if (producto.Tipo === 'Bodega' && !tienePermiso('productosBodega'))
        return false
      return true
    })

    if (!globalFilter) return filtradosPorPermiso

    return filtradosPorPermiso.filter(producto =>
      Object.values(producto).some(value =>
        String(value).toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [productos, globalFilter, tienePermiso])

  const columns = useMemo(
    () => [
      { accessorKey: 'Id_producto', header: 'ID Producto' },
      { accessorKey: 'Nombre', header: 'Nombre' },
      { accessorKey: 'Referencia', header: 'Referencia' },
      { accessorKey: 'Tipo', header: 'Tipo' },
      { accessorKey: 'Alto', header: 'Alto' },
      { accessorKey: 'Ancho', header: 'Ancho' },
      { accessorKey: 'Largo', header: 'Largo' },
      { accessorKey: 'Unidad_de_medida', header: 'Unidad' },
      {
        id: 'acciones',
        header: 'Editar',
        cell: ({ row }) => (
          <div className='acciones'>
            <button
              className='btn-editar'
              onClick={() => handleEditar(row.original)}
            >
              <BiEditAlt size={18} />
            </button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredProductos,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
    pageCount: Math.ceil(filteredProductos.length / pagination.pageSize),
  })

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
    const worksheet = utils.json_to_sheet(productos)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Productos')
    writeFile(workbook, 'Productos.xlsx')
  }

  return (
    <>
      {/* Modal Agregar */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={handleCerrarAgregarModal}
        contentLabel='Agregar Producto'
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2 className='mb-4'>Agregar Producto</h2>
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
        <h2 className='mb-4'>Editar Producto</h2>
        {productoSeleccionado && (
          <FormEditarProducto
            producto={productoSeleccionado}
            onSuccess={handleSuccessEditar}
          />
        )}
      </Modal>

      <div className='producto-container'>
        <div className='producto-header'>
          <div className='izquierda'>
            <button className='btn-excel' onClick={exportToExcel}>
              <FaFileExcel size={32} />
            </button>
          </div>

          <div className='derecha'>
            {(tienePermiso('productosRS') ||
              tienePermiso('productosBodega')) && (
              <button className='btn-agregar' onClick={handleAgregarProducto}>
                Agregar Producto
              </button>
            )}
          </div>
        </div>

        <div className='producto-busqueda'>
          <input
            type='text'
            placeholder='Buscar...'
            className='form-control buscador-pequeno'
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>

        <div className='tabla-productos'>
          {loading ? (
            <p>Cargando productos...</p>
          ) : (
            <table>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        <div
                          style={{
                            cursor: header.column.getCanSort()
                              ? 'pointer'
                              : 'default',
                          }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() === 'asc' && (
                            <BiSortUp />
                          )}
                          {header.column.getIsSorted() === 'desc' && (
                            <BiSortDown />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className='paginacion'>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ◀ Anterior
          </button>
          <span>
            Página {pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente ▶
          </button>
        </div>
      </div>
    </>
  )
}

export default Producto
