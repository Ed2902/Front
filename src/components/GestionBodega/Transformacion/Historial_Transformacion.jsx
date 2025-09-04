// src/components/Inventario/Transformaciones/HistorialTransformacion.jsx

import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiSortUp, BiSortDown } from 'react-icons/bi'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'

import {
  getHistorialTransformaciones,
  getProductos,
  getLoteProducto,
} from './TransformacionService'
import { usePermisos } from '../../../hooks/usePermisos'
import VisorEvidencia from './VisorEvidencia'

const fmtFecha = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const HistorialTransformacion = () => {
  const { tienePermiso } = usePermisos()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'orden_fecha', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const [productosData, transformaciones, lotesData] = await Promise.all([
          getProductos(),
          getHistorialTransformaciones(),
          getLoteProducto(),
        ])

        const canRS = tienePermiso('productosRS')
        const canBodega = tienePermiso('productosBodega')

        const lpToLote = new Map(
          (lotesData || []).map(lp => [String(lp.id_lote_producto), lp.id_lote])
        )

        const normalizados = (transformaciones || [])
          .filter(it => {
            const prod = (productosData || []).find(
              p => String(p.Id_producto) === String(it.id_producto)
            )
            if (!prod) return false
            return (
              (prod.Tipo === 'RS' && canRS) ||
              (prod.Tipo === 'Bodega' && canBodega)
            )
          })
          .map(it => {
            const loteResuelto =
              lpToLote.get(String(it.id_lote_producto_origen)) ??
              it.id_lote_producto_origen

            const consumida = Number(it.cantidad_consumada ?? 0)
            const generada = Number(it.cantidad_generada ?? 0)
            const merma = consumida - generada

            const fechaSalidaTS = it.fecha_salida
              ? new Date(it.fecha_salida).getTime()
              : 0
            const fechaIngresoTS = it.fecha_ingreso
              ? new Date(it.fecha_ingreso).getTime()
              : 0
            const ordenFecha = Math.max(fechaSalidaTS, fechaIngresoTS)

            return {
              ...it,
              lote: loteResuelto,
              merma,
              fecha_ingreso_txt: fmtFecha(it.fecha_ingreso),
              fecha_salida_txt: fmtFecha(it.fecha_salida),
              orden_fecha: ordenFecha,
            }
          })

        normalizados.sort((a, b) => b.orden_fecha - a.orden_fecha)

        if (mounted) setRows(normalizados)
      } catch (e) {
        console.error('Error cargando historial:', e?.message || e)
        if (mounted) setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [tienePermiso])

  const filteredData = useMemo(() => {
    if (!globalFilter) return rows
    const q = globalFilter.toLowerCase()
    return rows.filter(r =>
      Object.values(r).some(v =>
        String(v ?? '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [rows, globalFilter])

  const columns = useMemo(
    () => [
      { accessorKey: 'lote', header: 'Lote' },
      { accessorKey: 'id_producto', header: 'Producto Origen' },
      { accessorKey: 'id_producto_new', header: 'Producto Nuevo' },
      { accessorKey: 'tipos_transformacion', header: 'Tipo' },
      { accessorKey: 'cantidad_consumada', header: 'Consumido' },
      { accessorKey: 'cantidad_generada', header: 'Generado' },
      {
        accessorKey: 'merma',
        header: 'Merma',
        cell: info => {
          const v = Number(info.getValue() ?? 0)
          if (isNaN(v)) return ''
          return (
            <span
              className={v > 0 ? 'fw-bold text-danger' : 'fw-bold text-success'}
            >
              {v}
            </span>
          )
        },
      },
      {
        accessorKey: 'fecha_ingreso',
        header: 'Fecha Ingreso',
        cell: info => fmtFecha(info.getValue()),
      },
      {
        accessorKey: 'fecha_salida',
        header: 'Fecha Salida',
        cell: info => fmtFecha(info.getValue()),
      },
      { accessorKey: 'operacion', header: 'Operación' },
      { accessorKey: 'id_personal', header: 'Personal' },
      {
        accessorKey: 'orden_fecha',
        id: 'orden_fecha',
        header: 'orden_fecha',
        enableSorting: true,
        cell: () => null,
        meta: { hidden: true },
      },
      {
        id: 'evidencia',
        header: 'Evidencia',
        cell: ({ row }) => {
          const evidencia = row.original.evidencia
          return evidencia ? <VisorEvidencia filename={evidencia} /> : '—'
        },
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
    const data = filteredData.map(r => ({
      Lote: r.lote,
      Producto_Origen: r.id_producto,
      Producto_Nuevo: r.id_producto_new,
      Tipo: r.tipos_transformacion,
      Consumido: r.cantidad_consumada,
      Generado: r.cantidad_generada,
      Merma: r.merma,
      Fecha_Ingreso: fmtFecha(r.fecha_ingreso),
      Fecha_Salida: fmtFecha(r.fecha_salida),
      Operacion: r.operacion ?? '',
      Personal: r.id_personal,
      Evidencia: r.evidencia,
    }))
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'HistorialTransformacion')
    writeFile(wb, 'Historial_Transformacion.xlsx')
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h5 className='m-0'>Historial de Transformaciones</h5>
        <button className='btn btn-success' onClick={exportToExcel}>
          <FaFileExcel className='me-2' /> Exportar a Excel
        </button>
      </div>

      <input
        type='text'
        className='form-control-sm mb-3 d-block mx-auto border-0 border-bottom'
        placeholder='Buscar en toda la tabla...'
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
      />

      <div className='table-responsive' style={{ overflowX: 'auto' }}>
        <table className='table table-bordered table-striped align-middle text-center'>
          <thead className='table-light'>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  if (header.column.columnDef.meta?.hidden) return null
                  return (
                    <th
                      key={header.id}
                      style={{ whiteSpace: 'nowrap' }}
                      className='text-center'
                    >
                      <div
                        className='d-flex align-items-center justify-content-center'
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
                        {{
                          asc: <BiSortUp className='ms-1' />,
                          desc: <BiSortDown className='ms-1' />,
                        }[header.column.getIsSorted()] ?? null}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  if (cell.column.columnDef.meta?.hidden) return null
                  return (
                    <td key={cell.id} className='text-center'>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className='text-center text-muted py-4'
                >
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className='d-flex justify-content-center align-items-center mt-3 gap-3'>
        <button
          className='btn btn-outline-secondary'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ◀ Anterior
        </button>
        <span>
          Página {pagination.pageIndex + 1} de {table.getPageCount()}
        </span>
        <button
          className='btn btn-outline-secondary'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente ▶
        </button>
      </div>
    </div>
  )
}

export default HistorialTransformacion
