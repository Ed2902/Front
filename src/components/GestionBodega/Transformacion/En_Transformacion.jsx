import { useEffect, useState, useMemo } from 'react'
import Modal from 'react-modal'
import { FaFileExcel } from 'react-icons/fa'
import { BiSortUp, BiSortDown } from 'react-icons/bi'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { utils, writeFile } from 'xlsx'
import { getTransformaciones } from './TransformacionService'
import PintarTransformacion from './pintarTransformacion'
import './Transformacion.css'
import FormTransformacion from '../Inventario/FormTransformacion'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const EnTransformacion = () => {
  const { tienePermiso } = usePermisos() // Usamos el hook para obtener los permisos
  const [transformaciones, setTransformaciones] = useState([]) // Almacenamos las transformaciones
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 30,
  })
  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isCerrarModalOpen, setIsCerrarModalOpen] = useState(false)
  const [transformacionSeleccionada, setTransformacionSeleccionada] =
    useState(null)

  // Caché para evitar hacer consultas múltiples
  const [cachedData, setCachedData] = useState(null)

  // Cargar transformaciones con el filtro basado en permisos
  useEffect(() => {
    const fetchData = async () => {
      // Si los datos ya están en caché, no volver a consultar
      if (cachedData) {
        setTransformaciones(cachedData)
        setLoading(false)
        return
      }

      try {
        const permisos = {
          verProductosRS: tienePermiso('productosRS'),
          verProductosBodega: tienePermiso('productosBodega'),
        }

        const filteredTransformaciones = await getTransformaciones(permisos)
        setTransformaciones(filteredTransformaciones)
        setCachedData(filteredTransformaciones) // Guardar en caché para futuras consultas
      } catch (error) {
        console.error('Error al cargar transformaciones:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [tienePermiso, cachedData]) // Solo se actualiza si los permisos cambian o si no hay datos en caché

  // Formateo de fecha
  const formatFecha = fecha => {
    if (!fecha) return ''
    const date = new Date(fecha)
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  // Filtro global
  const filteredData = useMemo(() => {
    if (!globalFilter) return transformaciones
    return transformaciones.filter(item =>
      [
        item.Producto?.Nombre,
        item.LoteProducto?.Lote?.Id_lote,
        item.Personal?.Nombre,
      ]
        .join(' ')
        .toLowerCase()
        .includes(globalFilter.toLowerCase())
    )
  }, [transformaciones, globalFilter])

  // Definición de columnas para la tabla
  const columns = useMemo(
    () => [
      {
        accessorKey: 'Lote',
        header: 'Lote',
        cell: ({ row }) => row.original.LoteProducto?.Lote?.Id_lote || '—',
      },
      {
        accessorKey: 'LoteProducto',
        header: 'Lote Producto',
        cell: ({ row }) => row.original.LoteProducto?.Id_lote_producto || '—',
      },
      {
        accessorKey: 'Producto',
        header: 'Producto',
        cell: ({ row }) => row.original.Producto?.Nombre || '—',
      },
      {
        accessorKey: 'Cantidad',
        header: 'Cantidad',
        cell: ({ row }) => row.original.Cantidad,
      },
      {
        accessorKey: 'Fecha',
        header: 'Fecha Movimiento',
        cell: ({ row }) =>
          formatFecha(row.original.HistorialIngresoSalida?.Fecha_movimiento),
      },
      {
        accessorKey: 'Personal',
        header: 'Personal',
        cell: ({ row }) => row.original.Personal?.Nombre || '—',
      },
      {
        accessorKey: 'Estado',
        header: 'Estado',
        cell: ({ row }) => {
          const estado = row.original.Estado
          return (
            <span className={`badge ${estado?.toLowerCase() || ''}`}>
              {estado}
            </span>
          )
        },
      },
      {
        id: 'accion',
        header: 'Acción',
        cell: ({ row }) => {
          const isCerrado = row.original.Estado === 'Cerrado'
          return (
            <button
              className='btn-accion'
              disabled={isCerrado}
              onClick={() => {
                setTransformacionSeleccionada(row.original)
                setIsCerrarModalOpen(true)
              }}
            >
              Cerrar
            </button>
          )
        },
      },
    ],
    []
  )

  // Configuración de la tabla
  const table = useReactTable({
    data: filteredData,
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
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  })

  // Exportar datos a Excel
  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      Lote: item.LoteProducto?.Lote?.Id_lote || '',
      LoteProducto: item.LoteProducto?.Id_lote_producto || '',
      Producto: item.Producto?.Nombre || '',
      Cantidad: item.Cantidad,
      Fecha: formatFecha(item.HistorialIngresoSalida?.Fecha_movimiento),
      Personal: item.Personal?.Nombre || '',
      Estado: item.Estado,
    }))
    const worksheet = utils.json_to_sheet(exportData)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Transformaciones')
    writeFile(workbook, 'Transformaciones.xlsx')
  }

  return (
    <div className='producto-container'>
      <div className='producto-header'>
        <div className='izquierda'>
          <button className='btn-excel' onClick={exportToExcel}>
            <FaFileExcel size={32} />
          </button>
        </div>
        <div className='derecha'>
          <button
            className='btn-agregarform btn-sm px-3'
            style={{ backgroundColor: '#00ba59', fontSize: '0.85rem' }}
            onClick={() => setIsAgregarModalOpen(true)}
          >
            Agregar Transformación
          </button>
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
          <p>Cargando transformaciones...</p>
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
                        {header.column.getIsSorted() === 'asc' && <BiSortUp />}
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

      {/* MODAL AGREGAR */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={() => setIsAgregarModalOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <FormTransformacion
          onSuccess={() => {
            setIsAgregarModalOpen(false)
          }}
          onClose={() => setIsAgregarModalOpen(false)}
        />
      </Modal>

      {/* MODAL CERRAR */}
      <Modal
        isOpen={isCerrarModalOpen}
        onRequestClose={() => setIsCerrarModalOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <PintarTransformacion transformacionData={transformacionSeleccionada} />
      </Modal>
    </div>
  )
}

export default EnTransformacion
