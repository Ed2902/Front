import { useEffect, useMemo, useState, useContext, useCallback } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button, Spinner, Modal, Badge, Table } from 'react-bootstrap'
import { Modal as AntdModal, message } from 'antd'
import * as XLSX from 'xlsx'
import './FactCompraTable.css'

import { FaPlus, FaMoneyBillWave } from 'react-icons/fa'

import AuthContext from '../../../context/AuthContext'
import {
  listarFactVenta,
  actualizarFactVenta,
  eliminarFactVenta,
} from './FactVenta.service'

// ✅ CAMBIO: componentes de VENTA
import FormVenta from './FormVenta'
import FormAbonoVenta from './FormAbonoVenta'

// ✅ NUEVO: visor/descargador seguro (token + VITE_API_URL_4)
import SecureArchivo from './SecureArchivo'

const ESTADOS = ['BORRADOR', 'PENDIENTE', 'PAGADA', 'VENCIDA', 'ANULADA']
const LIMIT = 50

// ---------- utils ----------
const toDateInputUTC = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const toISODateUTC = yyyyMmDd => {
  if (!yyyyMmDd) return ''
  const d = new Date(`${yyyyMmDd}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

const todayISO00UTC = () => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

const daysRemainingUTC = isoVenc => {
  if (!isoVenc) return ''
  const v = new Date(isoVenc)
  if (Number.isNaN(v.getTime())) return ''
  const today = new Date()
  v.setUTCHours(0, 0, 0, 0)
  today.setUTCHours(0, 0, 0, 0)
  return Math.round((v - today) / (1000 * 60 * 60 * 24))
}

const riskClass = n => {
  if (n === '' || n === null || n === undefined) return ''
  const v = Number(n)
  if (Number.isNaN(v)) return ''
  if (v < 0) return 'risk-overdue'
  if (v <= 3) return 'risk-high'
  if (v <= 7) return 'risk-medium'
  return 'risk-low'
}

const sumAbonos = (abonos = [], key) =>
  Array.isArray(abonos)
    ? abonos.reduce((acc, a) => acc + (Number(a?.[key]) || 0), 0)
    : 0

const normalizeListResponse = res => {
  if (Array.isArray(res)) return { rows: res, pagination: null }
  if (res?.data && Array.isArray(res.data))
    return { rows: res.data, pagination: res.pagination ?? null }
  if (res?.ok && Array.isArray(res.data))
    return { rows: res.data, pagination: res.pagination ?? null }
  return { rows: [], pagination: res?.pagination ?? null }
}

const estadoBadgeVariant = estado => {
  switch (estado) {
    case 'PAGADA':
      return 'success'
    case 'VENCIDA':
      return 'danger'
    case 'PENDIENTE':
      return 'warning'
    case 'ANULADA':
      return 'secondary'
    case 'BORRADOR':
      return 'info'
    default:
      return 'light'
  }
}

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const fmtUSD = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtNUM = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 2,
})

const asNumber = v => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  const cleaned = s
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

// ✅ Confirmación UI (no usar alert del navegador)
const confirmUI = ({
  title = '¿Estás seguro?',
  content = 'Confirma para continuar.',
  okText = 'Sí',
  cancelText = 'No',
} = {}) =>
  new Promise(resolve => {
    AntdModal.confirm({
      title,
      content,
      okText,
      cancelText,
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })

const consecNumber = v => {
  const s = String(v ?? '')
  const matches = s.match(/\d+/g)
  if (!matches || matches.length === 0) return 0
  const last = matches[matches.length - 1]
  const n = Number(last)
  return Number.isFinite(n) ? n : 0
}

// ---------- cells ----------
function TextEditableCell({ getValue, row, column, table }) {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const editable = table.options.meta?.isEditable?.(column.id) ?? false
  const inputType = table.options.meta?.getInputType?.(column.id) ?? 'text'

  useEffect(() => {
    setValue(initialValue ?? '')
    setDirty(false)
  }, [initialValue])

  if (!editable)
    return <div className='excel-readonly'>{String(initialValue ?? '')}</div>

  const onSave = async () => {
    const header = column?.columnDef?.header
    const label = typeof header === 'string' ? header : column.id
    const id = row?.original?.consecutivo || row?.original?._id || ''

    const ok = await (table.options.meta?.confirm?.({
      title: '¿Guardar cambio?',
      content: `${id ? `${id} · ` : ''}${label}: "${String(
        initialValue ?? ''
      )}" → "${String(value ?? '')}"`,
    }) ?? Promise.resolve(true))

    if (!ok) return

    try {
      setSaving(true)
      await table.options.meta?.commitCell?.(row.index, column.id, value)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='excel-cellwrap'>
      <input
        className='excel-cell'
        type={inputType}
        value={value ?? ''}
        onChange={e => {
          setValue(e.target.value)
          setDirty(true)
        }}
      />
      {dirty && (
        <div className='excel-cellactions' aria-hidden='true'>
          <button
            type='button'
            className='excel-ok'
            onClick={onSave}
            disabled={saving}
            title='Guardar'
          >
            ✓
          </button>
          <button
            type='button'
            className='excel-cancel'
            onClick={() => {
              setValue(initialValue ?? '')
              setDirty(false)
            }}
            disabled={saving}
            title='Cancelar'
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function EstadoSelectCell({ getValue, row, column, table }) {
  const initialValue = (getValue() ?? '').toString()
  const [value, setValue] = useState(initialValue)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const editable = table.options.meta?.isEditable?.(column.id) ?? false

  useEffect(() => {
    setValue(initialValue)
    setDirty(false)
  }, [initialValue])

  if (!editable) {
    return (
      <div className='excel-readonly'>
        <Badge bg={estadoBadgeVariant(initialValue)} className='estado-badge'>
          {initialValue || '-'}
        </Badge>
      </div>
    )
  }

  const onSave = async () => {
    const id = row?.original?.consecutivo || row?.original?._id || ''
    const ok = await (table.options.meta?.confirm?.({
      title: '¿Guardar cambio de estado?',
      content: `${id ? `${id} · ` : ''}Estado: "${String(
        initialValue || '-'
      )}" → "${String(value || '-')}"`,
    }) ?? Promise.resolve(true))

    if (!ok) return

    try {
      setSaving(true)
      await table.options.meta?.commitCell?.(row.index, column.id, value)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='excel-cellwrap'>
      <select
        className='excel-select'
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setDirty(true)
        }}
      >
        {ESTADOS.map(op => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      {dirty && (
        <div className='excel-cellactions' aria-hidden='true'>
          <button
            type='button'
            className='excel-ok'
            onClick={onSave}
            disabled={saving}
            title='Guardar'
          >
            ✓
          </button>
          <button
            type='button'
            className='excel-cancel'
            onClick={() => {
              setValue(initialValue)
              setDirty(false)
            }}
            disabled={saving}
            title='Cancelar'
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Abonos Modal (READ ONLY) ----------
function AbonosReadOnly({ abonos, onOpenFiles }) {
  const list = Array.isArray(abonos) ? abonos : []

  return (
    <div className='abonos-ro'>
      <div className='abonos-ro-head'>
        <div>
          <div className='abonos-ro-title'>Detalle de abonos</div>
          <div className='abonos-ro-subtitle'>
            Solo lectura · {list.length} registro(s)
          </div>
        </div>
      </div>

      <div className='abonos-ro-tablewrap'>
        <Table responsive hover size='sm' className='abonos-ro-table'>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha pago</th>
              <th className='text-end'>Monto COP</th>
              <th className='text-end'>Monto USD</th>
              <th>Soportes</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className='text-muted py-4 text-center'>
                  Sin abonos
                </td>
              </tr>
            )}

            {list.map((a, i) => (
              <tr key={i}>
                <td className='text-muted'>{i + 1}</td>
                <td>{toDateInputUTC(a?.fecha_pago) || '-'}</td>
                <td className='text-end'>
                  {fmtCOP.format(asNumber(a?.monto_cop))}
                </td>
                <td className='text-end'>
                  {fmtUSD.format(asNumber(a?.monto_usd))}
                </td>
                <td className='text-end'>
                  {fmtNUM.format(asNumber(a?.trm_pago))}
                </td>
                <td>
                  <button
                    type='button'
                    className='excel-viewbtn'
                    title={(a?.soportes_pago || []).join('\n')}
                    onClick={() =>
                      onOpenFiles?.(
                        `Soportes abono #${i + 1}`,
                        Array.isArray(a?.soportes_pago) ? a.soportes_pago : []
                      )
                    }
                    disabled={
                      !Array.isArray(a?.soportes_pago) ||
                      a.soportes_pago.length === 0
                    }
                  >
                    Ver (
                    {Array.isArray(a?.soportes_pago)
                      ? a.soportes_pago.length
                      : 0}
                    )
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

// ---------- main ----------
export default function FactCompraTable() {
  const { token, loading: authLoading } = useContext(AuthContext)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState([])

  // table state
  // ✅ por defecto: consecutivo (ID) mayor arriba (FT-010 > FT-007)
  const [sorting, setSorting] = useState([{ id: 'consecutivo', desc: true }])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [columnOrder, setColumnOrder] = useState([])

  // modal abonos
  const [showAbonosModal, setShowAbonosModal] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState(null)

  const openAbonos = useCallback(factura => {
    setSelectedFactura(factura)
    setShowAbonosModal(true)
  }, [])

  const closeAbonos = useCallback(() => {
    setShowAbonosModal(false)
    setSelectedFactura(null)
  }, [])

  // ✅ modal crear
  const [showCrearModal, setShowCrearModal] = useState(false)
  const openCrear = useCallback(() => setShowCrearModal(true), [])
  const closeCrear = useCallback(() => setShowCrearModal(false), [])

  // ✅ modal hacer abono (se abre desde la fila)
  const [showHacerAbonoModal, setShowHacerAbonoModal] = useState(false)
  const openHacerAbono = useCallback(factura => {
    setSelectedFactura(factura)
    setShowHacerAbonoModal(true)
  }, [])
  const closeHacerAbono = useCallback(() => {
    setShowHacerAbonoModal(false)
    setSelectedFactura(null)
  }, [])

  // ✅ modal archivos (soportes/docs/abonos)
  const [showFilesModal, setShowFilesModal] = useState(false)
  const [filesTitle, setFilesTitle] = useState('Archivos')
  const [filesList, setFilesList] = useState([])

  const openFilesModal = useCallback((title, files) => {
    setFilesTitle(title || 'Archivos')
    setFilesList(Array.isArray(files) ? files : [])
    setShowFilesModal(true)
  }, [])

  const closeFilesModal = useCallback(() => {
    setShowFilesModal(false)
    setFilesTitle('Archivos')
    setFilesList([])
  }, [])

  const onEliminar = useCallback(
    async factura => {
      if (!factura?._id) return
      const idLabel = factura?.consecutivo || factura?._id

      const ok = await confirmUI({
        title: '¿Enviar a papelera?',
        content: `Vas a eliminar ${idLabel}. ¿Deseas continuar?`,
        okText: 'Sí, eliminar',
        cancelText: 'No',
      })
      if (!ok) return

      try {
        await eliminarFactVenta(factura._id, token)
        message.success('Enviado a papelera')
        setData(old => old.filter(r => r._id !== factura._id))
      } catch (e) {
        message.error(e?.message || 'No se pudo eliminar')
      }
    },
    [token]
  )

  const columns = useMemo(() => {
    const LINEAS = [
      { value: 'Harvest', label: 'Harvest', cls: 'linea-harvest' },
      { value: 'Fastway', label: 'Fastway', cls: 'linea-fastway' },
      { value: 'Greenway', label: 'Greeway', cls: 'linea-greenway' },
      { value: 'Compras Gen', label: 'Compras Gen', cls: 'linea-compras' },
    ]

    function LineaSelectCell({ getValue, row, column, table }) {
      const initialValue = getValue() ?? ''
      const [value, setValue] = useState(initialValue)
      const [dirty, setDirty] = useState(false)
      const [saving, setSaving] = useState(false)

      const editable = table.options.meta?.isEditable?.(column.id) ?? false

      useEffect(() => {
        setValue(initialValue)
        setDirty(false)
      }, [initialValue])

      const selected = LINEAS.find(l => l.value === value)

      if (!editable) {
        return (
          <div className={`excel-readonly ${selected?.cls || ''}`}>
            {value || '-'}
          </div>
        )
      }

      const onSave = async () => {
        const id = row?.original?.consecutivo || row?.original?._id || ''
        const ok = await (table.options.meta?.confirm?.({
          title: '¿Guardar cambio?',
          content: `${id ? `${id} · ` : ''}Línea: "${String(
            initialValue || '-'
          )}" → "${String(value || '-')}"`,
        }) ?? Promise.resolve(true))

        if (!ok) return

        try {
          setSaving(true)
          await table.options.meta?.commitCell?.(row.index, column.id, value)
          setDirty(false)
        } finally {
          setSaving(false)
        }
      }

      return (
        <div className='excel-cellwrap'>
          <select
            className={`excel-select ${selected?.cls || ''}`}
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setDirty(true)
            }}
          >
            {LINEAS.map(l => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          {dirty && (
            <div className='excel-cellactions'>
              <button className='excel-ok' onClick={onSave} disabled={saving}>
                ✓
              </button>
              <button
                className='excel-cancel'
                onClick={() => {
                  setValue(initialValue)
                  setDirty(false)
                }}
                disabled={saving}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )
    }

    return [
      {
        id: 'consecutivo',
        accessorKey: 'consecutivo',
        header: 'ID',
        cell: ({ getValue }) => (
          <div className='excel-readonly'>{String(getValue() ?? '')}</div>
        ),
        meta: { cls: 'col-xs' },
      },
      {
        id: 'cliente',
        accessorKey: 'cliente',
        header: 'Cliente',
        cell: TextEditableCell,
        meta: { cls: 'col-lg' },
      },
      {
        id: 'linea',
        accessorKey: 'linea',
        header: 'Línea',
        cell: LineaSelectCell,
        meta: { cls: 'col-linea' },
      },
      {
        id: 'factura',
        accessorKey: 'factura',
        header: 'Factura',
        cell: TextEditableCell,
        meta: { cls: 'col-linea' },
      },
      {
        id: 'createdAt',
        header: 'Creación',
        accessorFn: r => toDateInputUTC(r?.createdAt),
        cell: ({ getValue }) => (
          <div className='excel-readonly'>{String(getValue() ?? '')}</div>
        ),
        meta: { cls: 'col-sm' },
      },
      {
        id: 'fecha',
        header: 'Fecha',
        accessorFn: r => toDateInputUTC(r?.fecha),
        cell: TextEditableCell,
        meta: { cls: 'col-sm' },
      },
      {
        id: 'fecha_vencimiento',
        header: 'Venc.',
        accessorFn: r => toDateInputUTC(r?.fecha_vencimiento),
        cell: TextEditableCell,
        meta: { cls: 'col-sm' },
      },
      {
        id: 'dias_credito',
        accessorKey: 'dias_credito',
        header: 'Créd.',
        cell: TextEditableCell,
        meta: { cls: 'col-xs' },
      },
      {
        id: 'dias_restantes',
        header: 'Restan',
        accessorFn: r => daysRemainingUTC(r?.fecha_vencimiento),
        cell: ({ row, getValue }) => {
          const estado = (row.original?.estado || '').toUpperCase()
          const v = getValue()
          if (estado === 'PAGADA') {
            return <div className='excel-readonly excel-center paid-ok'>👌</div>
          }
          return (
            <div className={`excel-readonly excel-center ${riskClass(v)}`}>
              {String(v ?? '')}
            </div>
          )
        },
        meta: { cls: 'col-xs' },
      },
      {
        id: 'estado',
        accessorKey: 'estado',
        header: 'Estado',
        cell: EstadoSelectCell,
        meta: { cls: 'col-sm' },
      },
      {
        id: 'fecha_pago',
        header: 'Fecha pago',
        accessorFn: r => toDateInputUTC(r?.fecha_pago),
        cell: ({ getValue }) => (
          <div className='excel-readonly'>{String(getValue() ?? '')}</div>
        ),
        meta: { cls: 'col-sm' },
      },
      {
        id: 'valor_cop',
        accessorKey: 'valor_cop',
        header: 'Valor COP',
        cell: TextEditableCell,
        meta: { cls: 'col-sm' },
      },
      {
        id: 'abono_cop_total',
        header: 'Abono COP',
        accessorFn: r => sumAbonos(r?.abonos, 'monto_cop'),
        cell: ({ getValue }) => (
          <div className='excel-readonly excel-right'>
            {fmtCOP.format(asNumber(getValue()))}
          </div>
        ),
        meta: { cls: 'col-sm' },
      },
      {
        id: 'saldo_cop',
        accessorKey: 'saldo_cop',
        header: 'Saldo COP',
        cell: ({ getValue }) => (
          <div className='excel-readonly excel-right'>
            {fmtCOP.format(asNumber(getValue()))}
          </div>
        ),
        meta: { cls: 'col-sm' },
      },
      {
        id: 'valor_usd',
        accessorKey: 'valor_usd',
        header: 'Valor USD',
        cell: TextEditableCell,
        meta: { cls: 'col-xs' },
      },
      {
        id: 'abono_usd_total',
        header: 'Abono USD',
        accessorFn: r => sumAbonos(r?.abonos, 'monto_usd'),
        cell: ({ getValue }) => (
          <div className='excel-readonly excel-right'>
            {fmtUSD.format(asNumber(getValue()))}
          </div>
        ),
        meta: { cls: 'col-xs' },
      },
      {
        id: 'saldo_usd',
        accessorKey: 'saldo_usd',
        header: 'Saldo USD',
        cell: ({ getValue }) => (
          <div className='excel-readonly excel-right'>
            {fmtUSD.format(asNumber(getValue()))}
          </div>
        ),
        meta: { cls: 'col-xs' },
      },
      {
        id: 'abonos_btn',
        header: 'Abonos',
        accessorFn: r => (Array.isArray(r?.abonos) ? r.abonos.length : 0),
        cell: ({ row, getValue }) => {
          const n = Number(getValue() || 0)
          return (
            <Button
              size='sm'
              variant={n > 0 ? 'outline-primary' : 'outline-secondary'}
              className='btn-abonos'
              onClick={() => openAbonos(row.original)}
              disabled={n === 0}
            >
              Ver ({n})
            </Button>
          )
        },
        meta: { cls: 'col-xs' },
      },
      {
        id: 'trm_factura',
        accessorKey: 'trm_factura',
        header: 'TRM',
        cell: TextEditableCell,
        meta: { cls: 'col-xs' },
      },
      {
        id: 'do',
        accessorKey: 'do',
        header: 'D.O',
        cell: TextEditableCell,
        meta: { cls: 'col-sm' },
      },
      {
        id: 'detalles',
        accessorKey: 'detalles',
        header: 'Detalles',
        cell: TextEditableCell,
        meta: { cls: 'col-xl' },
      },
      {
        id: 'soportes_pago',
        header: 'Soportes',
        accessorFn: r =>
          Array.isArray(r?.soportes_pago) ? r.soportes_pago : [],
        cell: ({ getValue }) => {
          const arr = getValue() || []
          return (
            <button
              type='button'
              className='excel-viewbtn'
              title={arr.join('\n')}
              onClick={() => openFilesModal('Soportes', arr)}
              disabled={!arr.length}
            >
              Ver ({arr.length})
            </button>
          )
        },
        meta: { cls: 'col-xs' },
      },
      {
        id: 'docs',
        header: 'Docs',
        accessorFn: r => (Array.isArray(r?.docs) ? r.docs : []),
        cell: ({ getValue }) => {
          const arr = getValue() || []
          return (
            <button
              type='button'
              className='excel-viewbtn'
              title={arr.join('\n')}
              onClick={() => openFilesModal('Docs', arr)}
              disabled={!arr.length}
            >
              Ver ({arr.length})
            </button>
          )
        },
        meta: { cls: 'col-xs' },
      },

      // ✅ Acciones (Abono + Papelera) al final
      {
        id: '__actions',
        header: '',
        cell: ({ row }) => (
          <div className='excel-row-actions'>
            <button
              type='button'
              className='excel-iconbtn excel-iconbtn-abono'
              title='Hacer abono'
              onClick={() => openHacerAbono(row.original)}
            >
              <FaMoneyBillWave />
            </button>

            <button
              type='button'
              className='excel-iconbtn'
              title='Papelera'
              onClick={() => onEliminar(row.original)}
            >
              🗑️
            </button>
          </div>
        ),
        meta: { cls: 'col-xxs' },
      },
    ]
  }, [openAbonos, openFilesModal, openHacerAbono, onEliminar])

  useEffect(() => {
    setColumnOrder(old => (old.length ? old : columns.map(c => c.id)))
  }, [columns])

  const isEditable = colId => {
    if (colId.startsWith('extra:')) return true
    const blocked = new Set([
      'consecutivo',
      'createdAt',
      'fecha_pago',
      'dias_restantes',
      'abono_cop_total',
      'abono_usd_total',
      'saldo_cop',
      'saldo_usd',
      'abonos_btn',
      'soportes_pago',
      'docs',
      '__actions',
    ])
    return !blocked.has(colId)
  }

  const getInputType = colId => {
    if (colId === 'fecha' || colId === 'fecha_vencimiento') return 'date'
    if (
      ['dias_credito', 'valor_cop', 'valor_usd', 'trm_factura'].includes(colId)
    )
      return 'number'
    return 'text'
  }

  const cargar = async () => {
    try {
      setLoading(true)
      setError('')

      if (authLoading) return
      if (!token) {
        setData([])
        setTotalPages(1)
        return
      }

      const res = await listarFactVenta({ page, limit: LIMIT }, token)
      const { rows, pagination } = normalizeListResponse(res)

      const mapFromBackend = item => ({
        ...item,
        linea: item?.linea ?? '',
        fecha: item?.fecha ?? '',
        fecha_vencimiento: item?.fecha_vencimiento ?? '',
        fecha_pago: item?.fecha_pago ?? '',
        extras:
          item?.extras && typeof item.extras === 'object' ? item.extras : {},
        soportes_pago: Array.isArray(item?.soportes_pago)
          ? item.soportes_pago
          : [],
        docs: Array.isArray(item?.docs) ? item.docs : [],
        abonos: Array.isArray(item?.abonos) ? item.abonos : [],
      })

      // ✅ default: consecutivo mayor arriba
      const mapped = rows.map(mapFromBackend)
      mapped.sort(
        (a, b) => consecNumber(b?.consecutivo) - consecNumber(a?.consecutivo)
      )
      setData(mapped)
      setTotalPages(Number(pagination?.totalPages || 1))
    } catch (e) {
      setError(e?.message || 'Error cargando facturas de compra')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, authLoading])

  const commitCell = async (rowIndex, columnId, value) => {
    const row = data[rowIndex]
    if (!row?._id) return

    const fd = new FormData()

    // extras
    if (columnId.startsWith('extra:')) {
      const key = columnId.replace('extra:', '')
      const newExtras = { ...(row.extras || {}), [key]: value }
      fd.append('extras', JSON.stringify(newExtras))

      setData(old =>
        old.map((r, i) => (i === rowIndex ? { ...r, extras: newExtras } : r))
      )
      await actualizarFactVenta(row._id, fd, token)
      return
    }

    // fechas editables
    if (columnId === 'fecha' || columnId === 'fecha_vencimiento') {
      const iso = toISODateUTC(value)
      fd.append(columnId, iso)

      setData(old =>
        old.map((r, i) => (i === rowIndex ? { ...r, [columnId]: iso } : r))
      )
      await actualizarFactVenta(row._id, fd, token)
      await cargar()
      return
    }

    // ✅ estado: si pasa a PAGADA, setea fecha_pago = hoy (UTC 00:00)
    if (columnId === 'estado') {
      const newEstado = String(value || '').toUpperCase()
      fd.append('estado', newEstado)

      let newFechaPago = row?.fecha_pago
      if (newEstado === 'PAGADA') {
        newFechaPago = todayISO00UTC()
        fd.append('fecha_pago', newFechaPago)
      }

      setData(old =>
        old.map((r, i) =>
          i === rowIndex
            ? { ...r, estado: newEstado, fecha_pago: newFechaPago }
            : r
        )
      )

      await actualizarFactVenta(row._id, fd, token)
      await cargar()
      return
    }

    // normales (incluye linea)
    fd.append(columnId, value)
    setData(old =>
      old.map((r, i) => (i === rowIndex ? { ...r, [columnId]: value } : r))
    )
    await actualizarFactVenta(row._id, fd, token)
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { isEditable, getInputType, commitCell, confirm: confirmUI },
  })

  const onDragStart = useCallback((e, colId) => {
    e.dataTransfer.setData('text/plain', colId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragOver = useCallback(e => e.preventDefault(), [])

  const onDrop = useCallback((e, targetColId) => {
    e.preventDefault()
    const draggedColId = e.dataTransfer.getData('text/plain')
    if (!draggedColId || draggedColId === targetColId) return
    setColumnOrder(old => {
      const next = [...old]
      const from = next.indexOf(draggedColId)
      const to = next.indexOf(targetColId)
      if (from === -1 || to === -1) return old
      next.splice(from, 1)
      next.splice(to, 0, draggedColId)
      return next
    })
  }, [])

  const descargarExcel = () => {
    const visibleCols = table.getVisibleLeafColumns()

    const rows = table.getRowModel().rows.map(r => {
      const obj = {}
      visibleCols.forEach(c => {
        const h = c.columnDef.header
        const header =
          typeof h === 'string' ? h : c.id === 'consecutivo' ? 'ID' : c.id
        obj[header] = r.getValue(c.id)
      })
      return obj
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas')
    XLSX.writeFile(
      wb,
      `facturas_compra_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  const colSpan = table.getVisibleLeafColumns().length || 1

  return (
    <div className='excel-wrap'>
      <div className='excel-topbar'>
        <div className='excel-note'>
          Facturas compra {loading ? ' · Cargando…' : ''}{' '}
          {error ? ` · ${error}` : ''}
        </div>

        <div className='excel-actions'>
          <Button variant='success' className='btn-crear' onClick={openCrear}>
            <FaPlus /> Crear
          </Button>

          {/* ✅ QUITADO: botón global "Hacer abono" */}

          <Button size='sm' variant='outline-success' onClick={descargarExcel}>
            Descargar Excel
          </Button>
        </div>
      </div>

      <div className='excel-scroll'>
        <table className='excel-table'>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const colId = header.column.id
                  const cls = header.column.columnDef?.meta?.cls || 'col-md'
                  return (
                    <th
                      key={header.id}
                      className={`excel-th ${cls}`}
                      draggable
                      onDragStart={e => onDragStart(e, colId)}
                      onDragOver={onDragOver}
                      onDrop={e => onDrop(e, colId)}
                      title='Arrastra para mover la columna. Click ordena.'
                    >
                      <div
                        className='excel-th-inner'
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className='excel-th-label'>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </span>
                        <span className='excel-sort'>
                          {header.column.getIsSorted() === 'asc' ? '↑' : ''}
                          {header.column.getIsSorted() === 'desc' ? '↓' : ''}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className='excel-tr'>
                {row.getVisibleCells().map(cell => {
                  const cls = cell.column.columnDef?.meta?.cls || 'col-md'
                  return (
                    <td key={cell.id} className={`excel-td ${cls}`}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {!loading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td className='excel-empty' colSpan={colSpan}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && (
          <div className='excel-loading'>
            <Spinner animation='border' size='sm' className='me-2' /> Cargando…
          </div>
        )}
      </div>

      <div className='excel-footer'>
        <div className='excel-footer-left'>
          <span className='text-muted'>
            Página {page} de {totalPages} · {LIMIT} por página
          </span>
        </div>
        <div className='excel-footer-right'>
          <Button
            size='sm'
            variant='outline-secondary'
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ← Anterior
          </Button>
          <Button
            size='sm'
            variant='outline-secondary'
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Siguiente →
          </Button>
        </div>
      </div>

      {/* ✅ Modal Crear */}
      <Modal
        show={showCrearModal}
        onHide={closeCrear}
        centered
        size='xl'
        dialogClassName='modal-crear-compra'
        contentClassName='modal-crear-compra-content'
      >
        <Modal.Body className='modal-crear-compra-body'>
          <div className='container-fluid modal-crear-compra-container'>
            <FormVenta
              token={token}
              onCancel={closeCrear}
              onCreated={async () => {
                closeCrear()
                await cargar()
              }}
            />
          </div>
        </Modal.Body>
      </Modal>

      {/* Modal Abonos */}
      <Modal
        show={showAbonosModal}
        onHide={closeAbonos}
        size='lg'
        centered
        dialogClassName='abonos-modal'
      >
        <Modal.Body className='abonos-modal-body'>
          <div className='abonos-card'>
            <AbonosReadOnly
              abonos={selectedFactura?.abonos || []}
              onOpenFiles={openFilesModal}
            />
          </div>
        </Modal.Body>
      </Modal>

      {/* ✅ Modal Hacer Abono */}
      <Modal
        show={showHacerAbonoModal}
        onHide={closeHacerAbono}
        centered
        dialogClassName='modal-hacer-abono'
      >
        <Modal.Body style={{ padding: 0 }}>
          {selectedFactura && (
            <FormAbonoVenta
              facturaId={selectedFactura._id}
              factura={selectedFactura}
              abonoIndex={0}
              onSuccess={async () => {
                closeHacerAbono()
                await cargar()
              }}
            />
          )}
        </Modal.Body>
      </Modal>

      {/* ✅ Modal Archivos */}
      <Modal show={showFilesModal} onHide={closeFilesModal} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 14, fontWeight: 800 }}>
            {filesTitle}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!filesList.length && <div className='text-muted'>Sin archivos</div>}

          {!!filesList.length && (
            <div className='d-flex flex-column gap-2'>
              {filesList.map((ruta, idx) => {
                const nombre =
                  (ruta || '').split('/').pop() || `archivo_${idx + 1}`

                return (
                  <div
                    key={`${ruta}-${idx}`}
                    className='d-flex align-items-center justify-content-between gap-2'
                  >
                    <div
                      className='text-truncate'
                      style={{ maxWidth: '55%' }}
                      title={nombre}
                    >
                      {idx + 1}. {nombre}
                    </div>

                    <SecureArchivo rutaRelativa={ruta} nombreArchivo={nombre} />
                  </div>
                )
              })}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}
