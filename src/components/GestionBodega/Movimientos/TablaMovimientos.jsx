import { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiSortUp, BiSortDown } from 'react-icons/bi'
import { utils, writeFile } from 'xlsx'
import {
  getHistorialPorLoteYProducto,
  fetchEvidenciaBlob,
} from './Movimientos.service'
import { usePermisos } from '../../../hooks/usePermisos'
import FiltrosMovimientos from './FiltrosMovimientos'
import { FaFilePdf, FaImage, FaTimes } from 'react-icons/fa'
import './Movimientos.css'

const tiposDisponibles = ['entrada', 'salida', 'transformacion']

const TablaMovimientos = () => {
  // eslint-disable-next-line no-unused-vars
  const [movimientos, setMovimientos] = useState([])
  const [movimientosPermitidos, setMovimientosPermitidos] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  const [tiposSeleccionados, setTiposSeleccionados] = useState([
    ...tiposDisponibles,
  ])
  const [tipoProductoFiltro, setTipoProductoFiltro] = useState('todos')
  const [clienteFiltro, setClienteFiltro] = useState('todos')
  const [proveedorFiltro, setProveedorFiltro] = useState('todos')
  const [clientesDisponibles, setClientesDisponibles] = useState([])
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([])
  const [archivoUrl, setArchivoUrl] = useState('')
  const [esPdf, setEsPdf] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)

  const { tienePermiso } = usePermisos()

  const normalizar = str =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getHistorialPorLoteYProducto('', '')
        setMovimientos(data)

        const filtrados = data.filter(item => {
          const tipo = item?.LoteProducto?.Producto?.Tipo?.toLowerCase?.()
          if (tipo === 'rs' && !tienePermiso('productosRS')) return false
          if (tipo === 'bodega' && !tienePermiso('productosBodega'))
            return false
          return true
        })

        setMovimientosPermitidos(filtrados)

        const clientesUnicos = Array.from(
          new Set(
            filtrados.map(m => m?.LoteProducto?.id_Cliente).filter(Boolean)
          )
        ).sort()

        const proveedoresUnicos = Array.from(
          new Set(
            filtrados.map(m => m?.LoteProducto?.id_proveedor).filter(Boolean)
          )
        ).sort()

        setClientesDisponibles(clientesUnicos)
        setProveedoresDisponibles(proveedoresUnicos)
      } catch (error) {
        console.error('Error al cargar movimientos:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTipoChange = tipo => {
    if (tipo === 'todos') {
      setTiposSeleccionados(
        tiposSeleccionados.length === tiposDisponibles.length
          ? []
          : [...tiposDisponibles]
      )
    } else {
      setTiposSeleccionados(prev =>
        prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
      )
    }
  }

  const porTipo = useMemo(() => {
    return movimientosPermitidos
      .filter(
        item =>
          item?.Movimiento_tipo &&
          tiposSeleccionados.includes(normalizar(item.Movimiento_tipo))
      )
      .filter(item => {
        const tipoProducto = item?.LoteProducto?.Producto?.Tipo?.toLowerCase?.()
        if (tipoProductoFiltro === 'todos') return true
        return tipoProducto === tipoProductoFiltro
      })
      .filter(item => {
        if (clienteFiltro === 'todos') return true
        return item?.LoteProducto?.id_Cliente === clienteFiltro
      })
      .filter(item => {
        if (proveedorFiltro === 'todos') return true
        return item?.LoteProducto?.id_proveedor === proveedorFiltro
      })
  }, [
    movimientosPermitidos,
    tiposSeleccionados,
    tipoProductoFiltro,
    clienteFiltro,
    proveedorFiltro,
  ])

  const filteredData = useMemo(() => {
    if (!globalFilter) return porTipo
    const filtro = globalFilter.toLowerCase()
    return porTipo.filter(item => {
      const texto = [
        item.id_historial,
        item.Movimiento_tipo,
        item?.operacionRef?.id_operacion, // incluir operación en búsqueda
        item?.LoteProducto?.id_lote,
        item?.LoteProducto?.Producto?.Nombre,
        item.Cantidad,
        item.id_bodega_origen,
        item.id_bodega_destino,
      ]
        .map(val => String(val || '').toLowerCase())
        .join(' ')
      return texto.includes(filtro)
    })
  }, [porTipo, globalFilter])

  const handleArchivoClick = async filename => {
    if (!filename) return
    try {
      const url = await fetchEvidenciaBlob(filename)
      setArchivoUrl(url)
      setEsPdf(filename.toLowerCase().endsWith('.pdf'))
      setMostrarModal(true)
    } catch (error) {
      console.error('Error al obtener archivo:', error)
    }
  }

  const cerrarModal = () => {
    setMostrarModal(false)
    setArchivoUrl('')
    setEsPdf(false)
  }

  const columns = useMemo(
    () => [
      { accessorKey: 'id_historial', header: 'ID' },
      { accessorKey: 'Movimiento_tipo', header: 'Tipo' },
      {
        accessorKey: 'LoteProducto.id_lote',
        header: 'Lote',
        cell: info => info.row.original.LoteProducto?.id_lote || 'N/A',
      },
      {
        accessorKey: 'Producto.Nombre',
        header: 'Producto',
        cell: info => info.row.original.LoteProducto?.Producto?.Nombre || 'N/A',
      },
      {
        accessorKey: 'LoteProducto.id_Cliente',
        header: 'Cliente (ID)',
        cell: info =>
          info.row.original.LoteProducto?.id_Cliente || 'No disponible',
      },
      {
        accessorKey: 'LoteProducto.id_proveedor',
        header: 'Proveedor (ID)',
        cell: info =>
          info.row.original.LoteProducto?.id_proveedor || 'No disponible',
      },
      { accessorKey: 'Cantidad', header: 'Cantidad' },
      {
        accessorKey: 'Fecha_movimiento',
        header: 'Fecha',
        cell: info => new Date(info.getValue()).toLocaleDateString('es-CO'),
      },
      { accessorKey: 'id_bodega_origen', header: 'Bodega Origen' },
      { accessorKey: 'id_bodega_destino', header: 'Bodega Destino' },

      // --- Operación antes de Documento
      {
        id: 'operacion',
        header: 'Operación (ID)',
        accessorFn: row => row?.operacionRef?.id_operacion || null,
        cell: info => info.getValue() || 'N/A',
        sortingFn: 'alphanumeric',
      },

      {
        id: 'documento',
        header: 'Documento (PDF)',
        cell: info => {
          const filename = info.row.original.documento_pdf
          return filename ? (
            <button
              className='btn-evidencia'
              onClick={() => handleArchivoClick(filename)}
            >
              <FaFilePdf />
            </button>
          ) : (
            <span style={{ display: 'block', textAlign: 'center' }}>-</span>
          )
        },
      },
      {
        id: 'evidencia',
        header: 'Evidencia (Imagen)',
        cell: info => {
          const filename = info.row.original.evidencia
          return filename ? (
            <button
              className='btn-evidencia'
              onClick={() => handleArchivoClick(filename)}
            >
              <FaImage />
            </button>
          ) : (
            <span style={{ display: 'block', textAlign: 'center' }}>-</span>
          )
        },
      },
      {
        accessorKey: 'Comentario',
        header: 'Comentario',
        cell: info => info.row.original.Comentario || 'No disponible',
      },
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
    const excelData = filteredData.map(mov => ({
      ID: mov.id_historial,
      Tipo: mov.Movimiento_tipo,
      Operación: mov?.operacionRef?.id_operacion || '',
      Lote: mov.LoteProducto?.id_lote || '',
      Producto: mov.LoteProducto?.Producto?.Nombre || '',
      Cliente: mov.LoteProducto?.id_Cliente || 'No disponible',
      Proveedor: mov.LoteProducto?.id_proveedor || 'No disponible',
      Cantidad: mov.Cantidad,
      Fecha: new Date(mov.Fecha_movimiento).toLocaleDateString('es-CO'),
      Bodega_Origen: mov.id_bodega_origen,
      Bodega_Destino: mov.id_bodega_destino,
    }))
    const worksheet = utils.json_to_sheet(excelData)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Movimientos')
    writeFile(workbook, 'Movimientos.xlsx')
  }

  return (
    <div className='producto-container'>
      <FiltrosMovimientos
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        tiposSeleccionados={tiposSeleccionados}
        handleTipoChange={handleTipoChange}
        tipoProductoFiltro={tipoProductoFiltro}
        setTipoProductoFiltro={setTipoProductoFiltro}
        clienteFiltro={clienteFiltro}
        setClienteFiltro={setClienteFiltro}
        proveedorFiltro={proveedorFiltro}
        setProveedorFiltro={setProveedorFiltro}
        clientesDisponibles={clientesDisponibles}
        proveedoresDisponibles={proveedoresDisponibles}
        onExportExcel={exportToExcel}
        total={filteredData.length}
      />

      <div className='tabla-productos'>
        {loading ? (
          <p>Cargando movimientos...</p>
        ) : (
          <div className='tabla-scroll'>
            <table className='tabla-fija'>
              {/* 👇 colgroup: fija anchos de columnas para que thead/tbody no se desalineen */}
              <colgroup>
                <col style={{ width: '90px' }} /> {/* ID */}
                <col style={{ width: '120px' }} /> {/* Tipo */}
                <col style={{ width: '120px' }} /> {/* Lote */}
                <col style={{ width: '240px' }} /> {/* Producto */}
                <col style={{ width: '140px' }} /> {/* Cliente */}
                <col style={{ width: '140px' }} /> {/* Proveedor */}
                <col style={{ width: '110px' }} /> {/* Cantidad */}
                <col style={{ width: '130px' }} /> {/* Fecha */}
                <col style={{ width: '150px' }} /> {/* Bodega Origen */}
                <col style={{ width: '150px' }} /> {/* Bodega Destino */}
                <col style={{ width: '140px' }} /> {/* Operación (ID) */}
                <col style={{ width: '110px' }} /> {/* Documento */}
                <col style={{ width: '110px' }} /> {/* Evidencia */}
                <col style={{ width: '260px' }} /> {/* Comentario */}
              </colgroup>

              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        <div
                          onClick={header.column.getToggleSortingHandler()}
                          className={
                            header.column.getCanSort() ? 'th-sortable' : ''
                          }
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
          </div>
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

      {mostrarModal && (
        <div className='modal-evidencia' onClick={cerrarModal}>
          <div className='modal-contenido' onClick={e => e.stopPropagation()}>
            <button className='btn-cerrar' onClick={cerrarModal}>
              <FaTimes />
            </button>
            {esPdf ? (
              <iframe src={archivoUrl} title='Documento PDF' />
            ) : (
              <img src={archivoUrl} alt='Evidencia' />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TablaMovimientos
