// src/components/Operaciones/Tabladeoperador.jsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { BiSortUp, BiSortDown } from 'react-icons/bi'
import { FaFileExcel } from 'react-icons/fa'
import Modal from 'react-modal'
import { utils, writeFile } from 'xlsx'
import {
  getOperaciones,
  iniciarOperacion,
  finalizarOperacion,
} from '../Tabladeoperacion/operacion_service'
import './Tabladeoperacion.css'
import AsignarCuadrilla from './asignarcuadrilla'
import AsignarPersonal from './asignarpersonal'
import AsignarServicios from './asignarservicios'

// 👇 Helpers compartidos (ajusta la ruta si pusiste el utils en otro sitio)
import {
  formatearFechaHora,
  formatDuration,
  calcularEstadoInventarioFila,
  getIdTipo,
  TIPOS_SECUNDARIOS,
} from '../Tabladeoperacion/inventario'

// 👇 Formularios de gestión de inventario
import FormIngreso from '../../GestionBodega/Inventario/FormIngreso'
import FormSalida from '../../GestionBodega/Inventario/FormSalida'
import FormTransformacion from '../../GestionBodega/Inventario/FormTransformacion'

Modal.setAppElement('#root')

// ---------- Panel de Confirmación (no modal) ----------
const ConfirmPanel = ({ open, mode, op, onConfirm, onCancel, loading }) => {
  if (!open || !op) return null

  const title = mode === 'start' ? 'Confirmar inicio' : 'Confirmar finalización'
  const desc =
    mode === 'start'
      ? `Vas a INICIAR la operación ${op.id_operacion}.`
      : `Vas a FINALIZAR la operación ${op.id_operacion}.`

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-title'
      aria-describedby='confirm-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !loading) onCancel?.()
      }}
    >
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
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
        <h6 id='confirm-title' className='mb-2'>
          {title}
        </h6>
        <p id='confirm-desc' className='mb-3 small text-muted'>
          {desc} Esta acción guardará fecha y hora.
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
            className={
              mode === 'start'
                ? 'btn btn-sm btn-success'
                : 'btn btn-sm btn-danger'
            }
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Resumen (columna derecha del modal Gestionar) ----------
const TablaResumenOperacion = ({ op }) => {
  if (!op) return null
  const productos = Array.isArray(op.productos) ? op.productos : []
  const servicios = Array.isArray(op.servicios) ? op.servicios : []
  const internos = Array.isArray(op.personalesInternos)
    ? op.personalesInternos
    : []
  const externos = Array.isArray(op.personalesExternos)
    ? op.personalesExternos
    : []

  return (
    <div className='card'>
      <div className='card-header py-2'>
        <strong>Resumen de operación</strong>
      </div>
      <div className='card-body p-2'>
        <div className='table-responsive'>
          <table className='table table-sm mb-2'>
            <tbody>
              <tr>
                <th className='w-50'>ID Operación</th>
                <td>{op.id_operacion}</td>
              </tr>
              <tr>
                <th>Tipo</th>
                <td>
                  {op.id_tipo_operacion}
                  {op.tipo_operacion ? ` (${op.tipo_operacion})` : ''}
                </td>
              </tr>
              <tr>
                <th>Lote</th>
                <td>{op.lote || '-'}</td>
              </tr>
              <tr>
                <th>Cliente</th>
                <td>{op.cliente || '-'}</td>
              </tr>
              <tr>
                <th>Operador</th>
                <td>{op.operador || '-'}</td>
              </tr>
              <tr>
                <th>Total Ítems</th>
                <td>{Number(op.cantidad_total_items ?? 0)}</td>
              </tr>
              <tr>
                <th>Estado Inventario</th>
                <td>{op.gestion_inventario || 'Sin estado'}</td>
              </tr>
              <tr>
                <th>Fecha Creación</th>
                <td>{op.fecha_creacion || '-'}</td>
              </tr>
              <tr>
                <th>Fecha Realización</th>
                <td>{op.fecha_realizacion || '-'}</td>
              </tr>
              <tr>
                <th>Fecha Fin</th>
                <td>{op.fecha_fin || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Productos</div>
          {productos.length ? (
            <ul className='mb-2 ps-3'>
              {productos.map((p, i) => (
                <li key={i}>
                  {p.id_producto} - {p.nombre} ({p.cantidad})
                </li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Servicios</div>
          {servicios.length ? (
            <ul className='mb-2 ps-3'>
              {servicios.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Personales Internos</div>
          {internos.length ? (
            <ul className='mb-0 ps-3'>
              {internos.map((p, i) => (
                <li key={i}>
                  {p.nombre} ({p.cargo})
                </li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-0'>
          <div className='small text-muted'>Personales Externos</div>
          {externos.length ? (
            <ul className='mb-0 ps-3'>
              {externos.map((p, i) => (
                <li key={i}>{p.nombre}</li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Renderizador de formulario por tipo ----------
const RenderForm = ({ op, onDone }) => {
  if (!op) return null
  const tipo = getIdTipo(op)

  const handleSuccess = () => onDone?.()

  if (tipo === 'ENTRADA') {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Entrada</strong>
        </div>
        <div className='card-body'>
          <FormIngreso onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }

  if (tipo === 'SALIDA') {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Salida</strong>
        </div>
        <div className='card-body'>
          <FormSalida onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }

  if (TIPOS_SECUNDARIOS.has(tipo)) {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Gestión</strong>
        </div>
        <div className='card-body'>
          <FormTransformacion onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }

  return (
    <div className='alert alert-secondary'>
      Este modal no tiene formulario para el tipo{' '}
      <strong>
        {op.id_tipo_operacion}
        {op.tipo_operacion ? ` (${op.tipo_operacion})` : ''}
      </strong>
      .
    </div>
  )
}

// ---------- Component ----------
const Tabladeoperador = () => {
  const [operaciones, setOperaciones] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 })

  // Modales
  const [modalCuadrillaOpen, setModalCuadrillaOpen] = useState(false)
  const [modalPersonalOpen, setModalPersonalOpen] = useState(false)
  const [modalServicioOpen, setModalServicioOpen] = useState(false)
  const [modalGestionOpen, setModalGestionOpen] = useState(false)

  const [operacionSeleccionada, setOperacionSeleccionada] = useState(null)

  // Confirmación no modal
  const [confirmUI, setConfirmUI] = useState({
    open: false,
    mode: null, // 'start' | 'finish'
    op: null,
    loading: false,
  })

  // Tick cada segundo para cronómetros
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Carga de operaciones + cálculo de estado inventario
  const fetchOperaciones = useCallback(async () => {
    try {
      const dataProcesada = await getOperaciones()

      const operacionesParaTabla = dataProcesada.map(op => {
        // Normaliza Servicios a array de strings
        let serviciosNorm = []
        if (Array.isArray(op.Servicios)) {
          serviciosNorm = op.Servicios
        } else if (typeof op.Servicios === 'string') {
          try {
            const obj = JSON.parse(op.Servicios)
            if (obj && typeof obj === 'object') {
              serviciosNorm = Object.entries(obj)
                .filter(([, v]) => !!v)
                .map(([k]) => k)
            }
          } catch {
            /* noop */
          }
        }

        const fechaCreacionISO = op.fecha_creacion
          ? new Date(op.fecha_creacion).toISOString()
          : null

        return {
          id_operacion: op.id_operacion,
          id_tipo_operacion: op.id_tipo_operacion || '',
          tipo_operacion: op.TiposOperacion?.Nombre || '',
          TiposOperacion: { Nombre: op.TiposOperacion?.Nombre || '' },

          lote: op?.Lote?.id_lote || op.id_lote || '',
          cliente: op.Cliente?.Nombre || '',
          operador: op.operador?.nombre || '',
          gestion_inventario: op.Gestion_inventario,

          productos: Array.isArray(op.productos) ? op.productos : [],
          productos_ids: Array.isArray(op.productos_ids)
            ? op.productos_ids
            : [],
          productos_text: op.productos_text || '',
          cantidad_total_items: Number(op.cantidad_total_items ?? 0),

          fecha_creacion: formatearFechaHora(op.fecha_creacion),
          fecha_realizacion: formatearFechaHora(op.fecha_realizacion),
          fecha_fin: formatearFechaHora(op.fecha_fin),

          time_init: op.time_init ? new Date(op.time_init).toISOString() : null,
          time_end: op.time_end ? new Date(op.time_end).toISOString() : null,

          tiempo_operacion: op.tiempo_operacion || '',
          personalesInternos: op.personalesInternos || [],
          personalesExternos: op.personalesExternos || [],
          servicios: serviciosNorm,

          _createdAtMs: fechaCreacionISO
            ? new Date(fechaCreacionISO).getTime()
            : 0,
        }
      })

      // Orden: más reciente primero
      operacionesParaTabla.sort((a, b) => b._createdAtMs - a._createdAtMs)

      // Recalcular Estado Inventario comparando con movimientos
      const operacionesConEstado = await Promise.all(
        operacionesParaTabla.map(async fila => {
          const estado = await calcularEstadoInventarioFila(fila)
          return { ...fila, gestion_inventario: estado }
        })
      )

      setOperaciones(operacionesConEstado)
    } catch (err) {
      console.error('Error al obtener operaciones:', err.message)
    }
  }, [])

  useEffect(() => {
    fetchOperaciones()
  }, [fetchOperaciones])

  // Abridores de modales secundarios
  const handleOpenModalCuadrilla = useCallback(op => {
    setOperacionSeleccionada(op)
    setModalCuadrillaOpen(true)
  }, [])
  const handleOpenModalPersonal = useCallback(op => {
    setOperacionSeleccionada(op)
    setModalPersonalOpen(true)
  }, [])
  const handleOpenModalServicio = useCallback(op => {
    setOperacionSeleccionada(op)
    setModalServicioOpen(true)
  }, [])
  const handleCloseModalCuadrilla = () => setModalCuadrillaOpen(false)
  const handleCloseModalPersonal = () => setModalPersonalOpen(false)
  const handleCloseModalServicio = () => setModalServicioOpen(false)

  // Modal GESTIONAR (formularios) — se abre desde el botón de estado Pendiente/Parcial
  const openGestionModal = useCallback(op => {
    setOperacionSeleccionada(op)
    setModalGestionOpen(true)
  }, [])
  const closeGestionModal = () => {
    setModalGestionOpen(false)
    setOperacionSeleccionada(null)
  }

  // Confirmadores iniciar/finalizar
  const askStart = useCallback(op => {
    const started = !!op.time_init
    const finished = !!op.time_end
    if (!(!started && !finished)) return
    setConfirmUI({ open: true, mode: 'start', op, loading: false })
  }, [])
  const askFinish = useCallback(op => {
    const started = !!op.time_init
    const finished = !!op.time_end
    if (!(started && !finished)) return
    setConfirmUI({ open: true, mode: 'finish', op, loading: false })
  }, [])
  const closeConfirm = useCallback(() => {
    setConfirmUI({ open: false, mode: null, op: null, loading: false })
  }, [])
  const doConfirm = useCallback(async () => {
    if (!confirmUI.open || !confirmUI.op || !confirmUI.mode) return
    try {
      setConfirmUI(prev => ({ ...prev, loading: true }))
      if (confirmUI.mode === 'start') {
        await iniciarOperacion(confirmUI.op.id_operacion)
      } else {
        await finalizarOperacion(confirmUI.op.id_operacion)
      }
      await fetchOperaciones()
    } catch (err) {
      console.error(err)
      alert('Ocurrió un error procesando la operación.')
    } finally {
      closeConfirm()
    }
  }, [confirmUI, fetchOperaciones, closeConfirm])

  const filteredOperaciones = useMemo(() => {
    if (!globalFilter) return operaciones
    return operaciones.filter(op =>
      Object.values(op).some(value =>
        String(value).toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [operaciones, globalFilter])

  const columns = useMemo(
    () => [
      { accessorKey: 'id_operacion', header: 'ID Operación' },
      { accessorKey: 'tipo_operacion', header: 'Tipo Operación' },
      { accessorKey: 'lote', header: 'Lote' },
      { accessorKey: 'cliente', header: 'Cliente' },

      // Productos
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

      // Estado inventario (un solo botón que abre GESTIONAR)
      {
        accessorKey: 'gestion_inventario',
        header: 'Estado Inventario',
        cell: ({ row }) => {
          const estadoRaw = row.original.gestion_inventario || ''
          const estado = String(estadoRaw).toLowerCase()

          if (estado === 'pendiente') {
            return (
              <button
                className='btn btn-warning btn-sm'
                onClick={() => openGestionModal(row.original)}
                title='Gestionar inventario (Pendiente)'
              >
                Pendiente
              </button>
            )
          }
          if (estado === 'parcial') {
            return (
              <button
                className='btn btn-info btn-sm'
                onClick={() => openGestionModal(row.original)}
                title='Gestionar inventario (Parcial)'
              >
                Parcial
              </button>
            )
          }
          if (estado === 'completado') {
            return <span className='text-success fw-bold'>Completado</span>
          }
          return <span className='text-muted'>{estadoRaw || 'Sin estado'}</span>
        },
      },

      // Tiempo
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

          if (row.original.tiempo_operacion) {
            return <span>{row.original.tiempo_operacion}</span>
          }

          return <span className='text-muted'>N/A</span>
        },
      },

      // Listas varias
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

      // Acciones propias del operador
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => {
          const op = row.original
          return (
            <div className='d-flex flex-column gap-1'>
              <button
                className='btn btn-sm btn-info'
                onClick={() => handleOpenModalCuadrilla(op)}
              >
                Agregar Cuadrilla
              </button>
              <button
                className='btn btn-sm btn-secondary'
                onClick={() => handleOpenModalPersonal(op)}
              >
                Agregar Personal
              </button>
              <button
                className='btn btn-sm btn-warning'
                onClick={() => handleOpenModalServicio(op)}
              >
                Agregar Servicio
              </button>
            </div>
          )
        },
      },

      // Controles de estado (iniciar / terminar)
      {
        id: 'estado',
        header: 'Controles de Estado',
        cell: ({ row }) => {
          const op = row.original
          const started = !!op.time_init
          const finished = !!op.time_end
          const canStart = !started && !finished
          const canFinish = started && !finished

          return (
            <div className='d-flex flex-column gap-1'>
              <button
                className='btn btn-sm btn-success'
                onClick={() => askStart(op)}
                disabled={!canStart}
                title={
                  !canStart ? 'Ya iniciada o finalizada' : 'Iniciar operación'
                }
              >
                Iniciar
              </button>
              <button
                className='btn btn-sm btn-danger'
                onClick={() => askFinish(op)}
                disabled={!canFinish}
                title={
                  !canFinish
                    ? 'Debe estar iniciada y no finalizada'
                    : 'Finalizar operación'
                }
              >
                Terminar
              </button>
            </div>
          )
        },
      },
    ],
    [
      askStart,
      askFinish,
      handleOpenModalCuadrilla,
      handleOpenModalPersonal,
      handleOpenModalServicio,
      openGestionModal,
      nowTs,
    ]
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
        tipo_operacion: op.tipo_operacion,
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
    writeFile(workbook, 'OperacionesOperador.xlsx')
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-center mb-3'>
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

      {/* Panel de confirmación */}
      <ConfirmPanel
        open={confirmUI.open}
        mode={confirmUI.mode}
        op={confirmUI.op}
        loading={confirmUI.loading}
        onCancel={closeConfirm}
        onConfirm={doConfirm}
      />

      {/* Modal: Asignar Cuadrilla */}
      <Modal
        isOpen={modalCuadrillaOpen}
        onRequestClose={handleCloseModalCuadrilla}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <AsignarCuadrilla
          idOperacion={operacionSeleccionada?.id_operacion}
          onSuccess={() => {
            fetchOperaciones()
            handleCloseModalCuadrilla()
          }}
          onClose={handleCloseModalCuadrilla}
        />
      </Modal>

      {/* Modal: Agregar Personal */}
      <Modal
        isOpen={modalPersonalOpen}
        onRequestClose={handleCloseModalPersonal}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h4>Agregar Personal</h4>
        <p>Para operación: {operacionSeleccionada?.id_operacion}</p>

        <AsignarPersonal
          idOperacion={operacionSeleccionada?.id_operacion}
          onSuccess={() => {
            fetchOperaciones()
            handleCloseModalPersonal()
          }}
          onClose={handleCloseModalPersonal}
        />

        <button
          className='btn btn-secondary mt-3'
          onClick={handleCloseModalPersonal}
        >
          Cerrar
        </button>
      </Modal>

      {/* Modal: Agregar Servicio */}
      <Modal
        isOpen={modalServicioOpen}
        onRequestClose={handleCloseModalServicio}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h4>Asignar servicios</h4>
        <p>Para operación: {operacionSeleccionada?.id_operacion}</p>

        <AsignarServicios
          idOperacion={operacionSeleccionada?.id_operacion}
          serviciosIniciales={operacionSeleccionada?.Servicios}
          onSuccess={() => {
            fetchOperaciones()
            handleCloseModalServicio()
          }}
          onClose={handleCloseModalServicio}
        />

        <button
          className='btn btn-secondary mt-3'
          onClick={handleCloseModalServicio}
        >
          Cerrar
        </button>
      </Modal>

      {/* Modal: Gestionar Inventario (formularios) */}
      <Modal
        isOpen={modalGestionOpen}
        onRequestClose={closeGestionModal}
        contentLabel='Gestionar operación'
        className='custom-modal-xl'
        overlayClassName='custom-modal-overlay'
      >
        <h2 className='mb-3'>Gestionar Operación</h2>

        {operacionSeleccionada && (
          <div className='row g-3'>
            {/* Columna izquierda: formulario según el tipo */}
            <div className='col-12 col-xl-7'>
              <RenderForm
                op={operacionSeleccionada}
                onDone={() => {
                  fetchOperaciones()
                  closeGestionModal()
                }}
              />
            </div>

            {/* Columna derecha: Resumen */}
            <div className='col-12 col-xl-5'>
              <TablaResumenOperacion op={operacionSeleccionada} />
            </div>
          </div>
        )}

        <div className='d-flex justify-content-end mt-3'>
          <button className='btn btn-secondary' onClick={closeGestionModal}>
            Cerrar
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default Tabladeoperador
