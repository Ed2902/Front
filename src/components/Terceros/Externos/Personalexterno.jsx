// src/components/Terceros/Externos/Personalexterno.jsx

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

import FormPersonalExterno from './form_personalexterno'
import { getExternos, eliminarExterno } from './serviceexterno'

import './personalexterno.css' // opcional si quieres estilos propios

Modal.setAppElement('#root')

// ---------- Panel de confirmación centrado ----------
const ConfirmDeletePanel = ({ open, item, loading, onConfirm, onCancel }) => {
  if (!open || !item) return null
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-del-title'
      aria-describedby='confirm-del-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !loading) onCancel?.()
      }}
    >
      {/* Backdrop */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      {/* Card centrada */}
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 420px)',
        }}
      >
        <h6 id='confirm-del-title' className='mb-2'>
          Eliminar personal externo
        </h6>
        <p id='confirm-del-desc' className='mb-3 small text-muted'>
          ¿Seguro que deseas eliminar a{' '}
          <strong>
            {item.nombre} {item.apellidos}
          </strong>{' '}
          (<code>{item.id_externo}</code>)? Esta acción es irreversible.
        </p>
        <div className='d-flex gap-2 justify-content-end'>
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className='btn btn-sm btn-danger'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Componente principal ----------
const Personalexterno = () => {
  const [externos, setExternos] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  // Modales
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [externoEditar, setExternoEditar] = useState(null)

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)

  // Carga inicial
  const fetchExternos = useCallback(async () => {
    try {
      const data = await getExternos()

      // añadimos campo auxiliar para ordenar por número en id_externo (EX123 -> 123)
      const mapped = (data || []).map(e => ({
        ...e,
        _idNum: Number(String(e.id_externo || '').replace(/\D/g, '')) || 0,
      }))

      // orden descendente por número de ID (últimos arriba)
      mapped.sort((a, b) => b._idNum - a._idNum)

      setExternos(mapped)
    } catch (err) {
      console.error('Error al obtener personal externo:', err)
    }
  }, [])

  useEffect(() => {
    fetchExternos()
  }, [fetchExternos])

  // Abrir modales
  const openAdd = () => setIsAddOpen(true)
  const closeAdd = () => setIsAddOpen(false)

  const openEdit = item => {
    setExternoEditar(item)
    setIsEditOpen(true)
  }
  const closeEdit = () => {
    setExternoEditar(null)
    setIsEditOpen(false)
  }

  // Eliminar con confirmación
  const handleEliminar = item => {
    setConfirmTarget(item)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!confirmTarget) return
    try {
      setConfirmLoading(true)
      await eliminarExterno(confirmTarget.id_externo)
      setConfirmLoading(false)
      setConfirmOpen(false)
      setConfirmTarget(null)
      await fetchExternos()
      alert(`Eliminado: ${confirmTarget.id_externo}`)
    } catch (err) {
      console.error(err)
      setConfirmLoading(false)
      alert('No se pudo eliminar el registro')
    }
  }

  const cancelDelete = () => {
    if (confirmLoading) return
    setConfirmOpen(false)
    setConfirmTarget(null)
  }

  // Filtro global
  const filteredExternos = useMemo(() => {
    if (!globalFilter) return externos
    const q = globalFilter.toLowerCase()
    return externos.filter(e =>
      Object.values(e).some(v => String(v).toLowerCase().includes(q))
    )
  }, [externos, globalFilter])

  // Definición de columnas
  const columns = useMemo(
    () => [
      { accessorKey: 'id_externo', header: 'ID' },
      { accessorKey: 'nombre', header: 'Nombre' },
      { accessorKey: 'apellidos', header: 'Apellidos' },
      {
        accessorKey: 'edad',
        header: 'Edad',
        cell: ({ row }) =>
          (row.original.edad ?? '') || <span className='text-muted'>N/A</span>,
      },
      { accessorKey: 'eps', header: 'EPS' },
      { accessorKey: 'arl', header: 'ARL' },
      { accessorKey: 'telefono', header: 'Teléfono' },
      { accessorKey: 'cargo', header: 'Cargo' },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className='d-flex gap-2'>
            <button
              className='btn btn-outline-primary btn-sm'
              title='Editar'
              onClick={() => openEdit(row.original)}
            >
              <BiEditAlt />
            </button>
            <button
              className='btn btn-outline-danger btn-sm'
              title='Eliminar'
              onClick={() => handleEliminar(row.original)}
            >
              <BiTrash />
            </button>
          </div>
        ),
      },
    ],
    []
  )

  // React Table
  const table = useReactTable({
    data: filteredExternos,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
    pageCount: Math.ceil(filteredExternos.length / pagination.pageSize),
  })

  // Exportar
  const exportToExcel = () => {
    const worksheet = utils.json_to_sheet(externos)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'PersonalExterno')
    writeFile(workbook, 'PersonalExterno.xlsx')
  }

  return (
    <>
      {/* Confirmación eliminar */}
      <ConfirmDeletePanel
        open={confirmOpen}
        item={confirmTarget}
        loading={confirmLoading}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Modal Agregar */}
      <Modal
        isOpen={isAddOpen}
        onRequestClose={closeAdd}
        contentLabel='Agregar personal externo'
        className='custom-modal-wide'
        overlayClassName='custom-modal-overlay'
      >
        <div className='modal-body'>
          <FormPersonalExterno
            mode='create'
            initialData={null}
            onSuccess={() => {
              fetchExternos()
              closeAdd()
            }}
            onCancel={closeAdd}
          />
        </div>
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={isEditOpen}
        onRequestClose={closeEdit}
        contentLabel='Editar personal externo'
        className='custom-modal-wide'
        overlayClassName='custom-modal-overlay'
      >
        <div className='modal-body'>
          {externoEditar && (
            <FormPersonalExterno
              mode='edit'
              initialData={externoEditar}
              onSuccess={() => {
                fetchExternos()
                closeEdit()
              }}
              onCancel={closeEdit}
            />
          )}
        </div>
      </Modal>

      {/* Tabla */}
      <div className='container-fluid py-4'>
        <div className='d-flex justify-content-between align-items-center mb-3'>
          <button className='btn btn-success' onClick={exportToExcel}>
            <FaFileExcel className='me-2' /> Exportar a Excel
          </button>
          <button className='btn btn-primary' onClick={openAdd}>
            Agregar personal
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

export default Personalexterno
