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
import { usePermisos } from '../../../hooks/usePermisos'
import './Inventario.css'

const InventarioGeneral = () => {
  const [dataOriginal, setDataOriginal] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [tipoSeleccionado, setTipoSeleccionado] = useState('todos')
  const [tiposDisponibles, setTiposDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  const { tienePermiso } = usePermisos()

  const puedeVerTipo = tipo => {
    if (tipo === 'RS') return tienePermiso('productosRS')
    if (tipo === 'Bodega') return tienePermiso('productosBodega')
    return true
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getInventarioCompleto()
        const agrupado = agruparPorProducto(data)
        setDataOriginal(agrupado)

        const tiposUnicos = Array.from(
          new Set(data.map(item => item.Producto?.Tipo))
        ).filter(Boolean)
        setTiposDisponibles(['todos', ...tiposUnicos])
      } catch (error) {
        console.error('Error cargando inventario general:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const agruparPorProducto = data => {
    const mapa = {}

    for (const item of data) {
      const key = item.id_producto
      if (!mapa[key]) {
        mapa[key] = {
          id_producto: item.Producto.Id_producto,
          nombre_producto: item.Producto.Nombre,
          unidad: item.Producto.Unidad_de_medida,
          tipo: item.Producto.Tipo,
          cantidad: 0,
          ultima_fecha: item.LoteProducto?.Fecha_registro || null,
        }
      }

      mapa[key].cantidad += item.Cantidad

      const nuevaFecha = item.LoteProducto?.Fecha_registro
      if (nuevaFecha) {
        const actual = new Date(mapa[key].ultima_fecha)
        const nueva = new Date(nuevaFecha)
        if (nueva > actual) {
          mapa[key].ultima_fecha = nuevaFecha
        }
      }
    }

    return Object.values(mapa).map(item => ({
      ...item,
      cantidad: Number(item.cantidad),
      ultima_fecha: item.ultima_fecha
        ? new Date(item.ultima_fecha).toLocaleDateString('es-CO')
        : 'N/A',
    }))
  }

  const filteredData = useMemo(() => {
    let filtrado = dataOriginal

    // 🛑 Filtrar primero por permisos
    filtrado = filtrado.filter(obj => puedeVerTipo(obj.tipo))

    // 🎯 Luego por tipo seleccionado
    if (tipoSeleccionado !== 'todos') {
      filtrado = filtrado.filter(obj => obj.tipo === tipoSeleccionado)
    }

    // 🔍 Y finalmente filtro global por texto
    if (globalFilter) {
      filtrado = filtrado.filter(obj =>
        Object.values(obj).some(value =>
          String(value).toLowerCase().includes(globalFilter.toLowerCase())
        )
      )
    }

    return filtrado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOriginal, globalFilter, tipoSeleccionado])

  const totalCantidad = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.cantidad, 0)
  }, [filteredData])

  const columns = useMemo(
    () => [
      { accessorKey: 'id_producto', header: 'Código Producto' },
      { accessorKey: 'nombre_producto', header: 'Nombre Producto' },
      { accessorKey: 'unidad', header: 'Unidad' },
      {
        accessorKey: 'cantidad',
        header: 'Cantidad Total',
        sortingFn: 'basic',
      },
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
    utils.book_append_sheet(workbook, worksheet, 'Inventario General')
    writeFile(workbook, 'InventarioGeneral.xlsx')
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

      <div className='filtro-radio-tipo'>
        {tiposDisponibles.map(tipo => (
          <label key={tipo}>
            <input
              type='radio'
              name='tipo'
              value={tipo}
              checked={tipoSeleccionado === tipo}
              onChange={() => setTipoSeleccionado(tipo)}
            />
            <span>{tipo === 'todos' ? 'Todos' : tipo}</span>
          </label>
        ))}
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
          Total: {totalCantidad.toLocaleString()} Cantidad
        </span>
      </div>

      <div className='tabla-productos'>
        {loading ? (
          <p>Cargando inventario...</p>
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

export default InventarioGeneral
