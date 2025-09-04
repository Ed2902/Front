import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from 'react-modal'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiEditAlt, BiTrash, BiSortUp, BiSortDown } from 'react-icons/bi'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'

import ActualizarOperacion from './actulizaroperacion'
import FormOperacion from './form_operacion'
import { eliminarOperacion } from './operacion_service'

import { useOperaciones } from './useOperaciones'
import ConfirmDeletePanel from './ConfirmDeletePanel'
import ModalGestionOperacion from './ModalGestionOperacion'
import { formatDuration, requiereGestionInventario } from './inventario'

import './Tabladeoperacion.css'

Modal.setAppElement('#root')

const Tabladeoperacion = () => {
  const { operaciones, fetchOperaciones } = useOperaciones()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isEditarModalOpen, setIsEditarModalOpen] = useState(false)
  const [modalGestionOpen, setModalGestionOpen] = useState(false)

  const [operacionSeleccionada, setOperacionSeleccionada] = useState(null)
  const [operacionEditar, setOperacionEditar] = useState(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetchOperaciones()
  }, [fetchOperaciones])

  // ----- Gestionar -----
  const handleAbrirGestion = useCallback(op => {
    setOperacionSeleccionada(op)
    setModalGestionOpen(true)
  }, [])
  const handleCerrarGestion = useCallback(() => {
    setModalGestionOpen(false)
    setOperacionSeleccionada(null)
  }, [])

  // ----- Editar -----
  const handleEditar = useCallback(operacion => {
    const opForForm = {
      ...operacion,
      fecha_realizacion:
        operacion.fecha_realizacionISO || operacion.fecha_realizacion || null,
      fecha_fin: operacion.fecha_finISO || operacion.fecha_fin || null,
    }
    setOperacionEditar(opForForm)
    setIsEditarModalOpen(true)
  }, [])
  const handleCerrarEditar = useCallback(() => {
    setOperacionEditar(null)
    setIsEditarModalOpen(false)
  }, [])

  // ----- Eliminar -----
  const handleEliminar = useCallback(op => {
    setConfirmTarget(op)
    setConfirmOpen(true)
  }, [])
  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return
    try {
      setConfirmLoading(true)
      await eliminarOperacion(confirmTarget.id_operacion)
      setConfirmLoading(false)
      setConfirmOpen(false)
      setConfirmTarget(null)
      await fetchOperaciones()
      alert(`Operación ${confirmTarget.id_operacion} eliminada`)
    } catch (err) {
      console.error(err)
      setConfirmLoading(false)
      alert('No se pudo eliminar la operación')
    }
  }, [confirmTarget, fetchOperaciones])
  const cancelDelete = useCallback(() => {
    if (confirmLoading) return
    setConfirmOpen(false)
    setConfirmTarget(null)
  }, [confirmLoading])

  // ----- Filtro global -----
  const filteredOperaciones = useMemo(() => {
    if (!globalFilter) return operaciones
    return operaciones.filter(op =>
      Object.values(op).some(value =>
        String(value).toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [operaciones, globalFilter])

  // ----- Columnas -----
  const columns = useMemo(
    () => [
      { accessorKey: 'id_operacion', header: 'ID Operación' },
      {
        accessorKey: 'tipo_operacion_display',
        header: 'Tipo Operación',
        cell: ({ row }) => (
          <span>
            {row.original.id_tipo_operacion}
            {row.original.tipo_operacion
              ? ` (${row.original.tipo_operacion})`
              : ''}
          </span>
        ),
      },
      { accessorKey: 'lote', header: 'Lote' },
      { accessorKey: 'cliente', header: 'Cliente' },
      {
        id: 'productos',
        header: 'Productos',
        cell: ({ row }) => {
          const arr = row.original.productos || []
          if (arr.length > 0) {
            return (
              <ul className='mb-0 ps-3'>
                {arr.map((p, i) => (
                  <li key={i}>
                    {p.id_producto} - {p.nombre} ({p.cantidad})
                  </li>
                ))}
              </ul>
            )
          }
          return (
            <span className='text-muted'>
              {row.original.productos_text || 'N/A'}
            </span>
          )
        },
      },
      {
        accessorKey: 'cantidad_total_items',
        header: 'Total Ítems',
        cell: ({ row }) => Number(row.original.cantidad_total_items ?? 0),
      },
      { accessorKey: 'fecha_creacion', header: 'Fecha Creación' },
      { accessorKey: 'fecha_realizacion', header: 'Fecha Realización' },
      { accessorKey: 'fecha_fin', header: 'Fecha Fin' },
      { accessorKey: 'operador', header: 'Operador' },
      {
        accessorKey: 'gestion_inventario',
        header: 'Estado Inventario',
        cell: ({ row }) => {
          const op = row.original
          if (!requiereGestionInventario(op))
            return <span className='text-muted'>No aplica</span>
          const estado = String(op.gestion_inventario || '').toLowerCase()
          if (estado === 'pendiente') {
            return (
              <button
                className='btn btn-warning btn-sm'
                onClick={() => handleAbrirGestion(op)}
              >
                Pendiente
              </button>
            )
          }
          if (estado === 'parcial') {
            return (
              <button
                className='btn btn-info btn-sm'
                onClick={() => handleAbrirGestion(op)}
              >
                Parcial
              </button>
            )
          }
          if (estado === 'completado')
            return <span className='text-success fw-bold'>Completado</span>
          return (
            <span className='text-muted'>
              {op.gestion_inventario || 'Sin estado'}
            </span>
          )
        },
      },
      {
        id: 'tiempo_dinamico',
        header: 'Tiempo Operación',
        cell: ({ row }) => {
          const startIso = row.original.time_init
          const endIso = row.original.time_end
          if (startIso && !endIso) {
            const elapsed = nowTs - new Date(startIso).getTime()
            return (
              <span className='text-primary fw-semibold'>
                {formatDuration(elapsed)}
              </span>
            )
          }
          if (startIso && endIso) {
            const diff =
              new Date(endIso).getTime() - new Date(startIso).getTime()
            return <span>{formatDuration(diff)}</span>
          }
          if (row.original.tiempo_operacion)
            return <span>{row.original.tiempo_operacion}</span>
          return <span className='text-muted'>N/A</span>
        },
      },
      {
        accessorKey: 'servicios',
        header: 'Servicios',
        cell: ({ row }) =>
          row.original.servicios.length > 0 ? (
            <ul className='mb-0 ps-3'>
              {row.original.servicios.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <span className='text-muted'>N/A</span>
          ),
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className='d-flex gap-2'>
            <button
              className='btn btn-outline-secondary btn-sm'
              onClick={() => handleAbrirGestion(row.original)}
              title='Gestionar operación'
            >
              Gestionar
            </button>
            <button
              className='btn btn-outline-primary btn-sm'
              onClick={() => handleEditar(row.original)}
              title='Editar operación'
            >
              <BiEditAlt />
            </button>
            <button
              className='btn btn-outline-danger btn-sm'
              onClick={() => handleEliminar(row.original)}
              title='Eliminar operación'
            >
              <BiTrash />
            </button>
          </div>
        ),
      },
      {
        accessorKey: 'personalesInternos',
        header: 'Personales Internos',
        cell: ({ row }) =>
          row.original.personalesInternos.length > 0 ? (
            <ul className='mb-0 ps-3'>
              {row.original.personalesInternos.map((p, i) => (
                <li key={i}>
                  {p.nombre} ({p.cargo})
                </li>
              ))}
            </ul>
          ) : (
            <span className='text-muted'>N/A</span>
          ),
      },
      {
        accessorKey: 'personalesExternos',
        header: 'Personales Externos',
        cell: ({ row }) =>
          row.original.personalesExternos.length > 0 ? (
            <ul className='mb-0 ps-3'>
              {row.original.personalesExternos.map((p, i) => (
                <li key={i}>{p.nombre}</li>
              ))}
            </ul>
          ) : (
            <span className='text-muted'>N/A</span>
          ),
      },
    ],
    [nowTs, handleAbrirGestion, handleEditar, handleEliminar]
  )

  const table = useReactTable({
    data: filteredOperaciones,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
    pageCount: Math.ceil(filteredOperaciones.length / pagination.pageSize),
  })

  const exportToExcel = () => {
    const worksheet = utils.json_to_sheet(
      operaciones.map(op => ({
        id_operacion: op.id_operacion,
        tipo_operacion: `${op.id_tipo_operacion || ''}${
          op.tipo_operacion ? ` (${op.tipo_operacion})` : ''
        }`,
        lote: op.lote,
        cliente: op.cliente,
        operador: op.operador,
        productos: op.productos_text,
        total_items: op.cantidad_total_items,
        estado_inventario: op.gestion_inventario,
        fecha_creacion: op.fecha_creacion,
        fecha_realizacion: op.fecha_realizacion,
        fecha_fin: op.fecha_fin,
      }))
    )
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Operaciones')
    writeFile(workbook, 'Operaciones.xlsx')
  }

  const handleAgregar = () => setIsAgregarModalOpen(true)
  const handleCerrarAgregar = () => setIsAgregarModalOpen(false)

  return (
    <>
      <ConfirmDeletePanel
        open={confirmOpen}
        op={confirmTarget}
        loading={confirmLoading}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <ModalGestionOperacion
        isOpen={modalGestionOpen}
        onRequestClose={handleCerrarGestion}
        operacion={operacionSeleccionada}
        onActionSuccess={() => {
          fetchOperaciones()
          handleCerrarGestion()
        }}
      />

      {/* Modal agregar */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={handleCerrarAgregar}
        contentLabel='Agregar Operación'
        className='custom-modal-wide'
        overlayClassName='custom-modal-overlay'
      >
        <div className='modal-body'>
          <FormOperacion
            onSuccess={() => {
              fetchOperaciones()
              handleCerrarAgregar()
            }}
          />
        </div>
        <div className='modal-footer d-flex justify-content-end' />
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={isEditarModalOpen}
        onRequestClose={handleCerrarEditar}
        contentLabel='Editar operación'
        className='custom-modal-wide'
        overlayClassName='custom-modal-overlay'
      >
        {operacionEditar && (
          <ActualizarOperacion
            op={operacionEditar}
            onCancel={handleCerrarEditar}
            onSuccess={() => {
              fetchOperaciones()
              handleCerrarEditar()
            }}
          />
        )}
      </Modal>

      {/* Tabla principal */}
      <div className='container-fluid py-4'>
        <div className='d-flex justify-content-between align-items-center mb-3'>
          <button className='btn btn-success' onClick={exportToExcel}>
            <FaFileExcel className='me-2' /> Exportar a Excel
          </button>
          <button className='btn btn-primary' onClick={handleAgregar}>
            Agregar Operación
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
          <table className='table table-bordered table-striped align-middle'>
            <thead className='table-light'>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} style={{ whiteSpace: 'nowrap' }}>
                      <div
                        className='d-flex align-items-center'
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
    </>
  )
}

export default Tabladeoperacion
