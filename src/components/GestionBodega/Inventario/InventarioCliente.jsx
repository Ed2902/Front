import { useState, useEffect, useMemo } from 'react'
import { FaFileExcel } from 'react-icons/fa'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiSortUp, BiSortDown } from 'react-icons/bi'
import { utils, writeFile } from 'xlsx'
import { getInventarioCompleto } from './inventario_service'
import './Inventario.css'

const InventarioCliente = () => {
  const [dataOriginal, setDataOriginal] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getInventarioCompleto()
        const conCliente = data.filter(item => item.LoteProducto?.Cliente)
        const agrupado = agruparPorClienteProducto(conCliente)
        setDataOriginal(agrupado)
      } catch (error) {
        console.error('Error cargando inventario por cliente:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const agruparPorClienteProducto = data => {
    const mapa = {}

    for (const item of data) {
      const key = `${item.LoteProducto.Cliente.Nombre}|${item.Producto.Id_producto}`

      if (!mapa[key]) {
        mapa[key] = {
          cliente: item.LoteProducto.Cliente.Nombre,
          id_producto: item.Producto.Id_producto,
          nombre_producto: item.Producto.Nombre,
          unidad: item.Producto.Unidad_de_medida,
          cantidad: 0,
          lotes: new Set(),
          ultima_fecha: item.LoteProducto.Fecha_registro,
        }
      }

      mapa[key].cantidad += item.Cantidad
      mapa[key].lotes.add(item.id_lote_producto)

      const fechaActual = new Date(item.LoteProducto.Fecha_registro)
      const fechaGuardada = new Date(mapa[key].ultima_fecha)
      if (fechaActual > fechaGuardada) {
        mapa[key].ultima_fecha = item.LoteProducto.Fecha_registro
      }
    }

    return Object.values(mapa).map(item => ({
      ...item,
      cantidad: Number(item.cantidad),
      lotes: item.lotes.size,
      ultima_fecha: new Date(item.ultima_fecha).toLocaleDateString('es-CO'),
    }))
  }

  const filteredData = useMemo(() => {
    if (!globalFilter) return dataOriginal
    return dataOriginal.filter(obj =>
      Object.values(obj).some(value =>
        String(value).toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [dataOriginal, globalFilter])

  const totalCantidad = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.cantidad, 0)
  }, [filteredData])

  const columns = useMemo(
    () => [
      { accessorKey: 'cliente', header: 'Cliente' },
      { accessorKey: 'id_producto', header: 'Código Producto' },
      { accessorKey: 'nombre_producto', header: 'Nombre Producto' },
      { accessorKey: 'unidad', header: 'Unidad' },
      { accessorKey: 'cantidad', header: 'Cantidad Actual' },
      { accessorKey: 'lotes', header: 'N° Lotes' },
      { accessorKey: 'ultima_fecha', header: 'Última Entrada' },
    ],
    []
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  })

  const exportToExcel = () => {
    const worksheet = utils.json_to_sheet(filteredData)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Inventario por Cliente')
    writeFile(workbook, 'InventarioPorCliente.xlsx')
  }

  return (
    <div className='producto-container'>
      <div className='producto-header'>
        <div className='izquierda'>
          <button className='btn-excel' onClick={exportToExcel}>
            <FaFileExcel size={32} />
          </button>
        </div>
      </div>

      <div className='barra-busqueda-total'>
        <input
          type='text'
          placeholder='Buscar...'
          className='form-control buscador-pequeno'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
        <span className='total-cantidad'>
          Total: {totalCantidad.toLocaleString()} unidades
        </span>
      </div>

      <div className='tabla-productos'>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          <table>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      <div
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          cursor: header.column.getCanSort()
                            ? 'pointer'
                            : 'default',
                        }}
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
    </div>
  )
}

export default InventarioCliente
