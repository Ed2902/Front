import { useEffect, useMemo, useState, useCallback } from 'react'
import { Table } from 'antd'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioResumen } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'

// Formateo local
const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

// Parser robusto "es-CO"
const toNumberCO = v => {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.')
    const n = parseFloat(s)
    return Number.isNaN(n) ? 0 : n
  }
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

// Unidades
const isUnidad = u => /(unidad|unid|uds?)/i.test((u || '').trim())

const InventarioGeneral = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtros UI (cabecera)
  const [globalFilter, setGlobalFilter] = useState('')
  const [tiposDisponibles, setTiposDisponibles] = useState(['todos'])
  const [bodegasDisponibles, setBodegasDisponibles] = useState(['todas'])
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState([
    'todas',
  ])

  const [tipoSeleccionado, setTipoSeleccionado] = useState('todos')
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState('todas')
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState('todas')

  const { tienePermiso } = usePermisos()
  const puedeVerTipo = useCallback(
    tipo => {
      if (tipo === 'RS') return tienePermiso('productosRS')
      if (tipo === 'Bodega') return tienePermiso('productosBodega')
      return true
    },
    [tienePermiso]
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await getInventarioResumen()
        const normalizados = (Array.isArray(data) ? data : []).map(it => {
          const id_producto = it?.Id_producto ?? it?.id_producto ?? ''
          const nombre_producto =
            it?.Nombre_Producto ??
            it?.Producto?.Nombre ??
            it?.ProductoNombre ??
            ''
          const tipo = it?.Tipo ?? it?.Producto?.Tipo ?? ''
          const unidad =
            it?.Unidad_de_medida ??
            it?.Producto?.Unidad_de_medida ??
            it?.Unidad ??
            ''

          // Bodega y Ubicación (nombre visible o id)
          const id_bodega =
            it?.id_bodega ??
            it?.Id_bodega ??
            it?.Bodega?.Id ??
            it?.BodegaId ??
            ''
          const bodegaNombre =
            it?.Bodega?.Nombre ?? it?.BodegaNombre ?? it?.Bodega ?? ''
          const bodegaDisplay = bodegaNombre || id_bodega

          const id_ubicacion =
            it?.id_ubicacion ??
            it?.Id_ubicacion ??
            it?.Ubicacion?.Id ??
            it?.UbicacionId ??
            ''
          const ubicacionNombre =
            it?.Ubicacion?.Nombre ??
            it?.UbicacionNombre ??
            it?.Ubicacion ??
            it?.ubicacion ??
            ''
          const ubicacionDisplay = ubicacionNombre || id_ubicacion

          const id_lote = it?.Id_lote ?? it?.id_lote ?? ''

          // Cantidad
          const cantidad =
            toNumberCO(it?.Cantidad_Inventario ?? it?.Cantidad) ||
            toNumberCO(it?.Cantidad_Lote) ||
            0

          // Peso Unitario Kg y kilos por fila
          const _pu = toNumberCO(it?.PesoUnitarioKg)
          const pesoUnitarioKg = _pu > 0 ? _pu : null
          const pesoTotalKg =
            pesoUnitarioKg != null && pesoUnitarioKg > 0
              ? cantidad * pesoUnitarioKg
              : cantidad

          // Fecha
          const fechaUlt =
            it?.Fecha_ultimo_registro ?? it?.Fecha_ultimo_registri ?? null
          const fecha_ts = fechaUlt ? new Date(fechaUlt).getTime() : 0

          return {
            key: `${id_producto}-${id_lote}-${id_bodega}-${id_ubicacion}`,
            id_producto,
            nombre_producto,
            tipo,
            unidad,
            id_bodega,
            bodega: bodegaNombre,
            bodegaDisplay,
            id_ubicacion,
            ubicacion: ubicacionNombre,
            ubicacionDisplay,
            id_lote,
            cantidad,
            pesoUnitarioKg,
            pesoTotalKg,
            fecha_ts,
            fecha_fmt: fechaUlt
              ? new Date(fechaUlt).toLocaleDateString('es-CO')
              : 'N/A',
          }
        })

        // Catálogos para filtros
        const tiposUI = [
          'todos',
          ...Array.from(new Set(normalizados.map(r => r.tipo).filter(Boolean))),
        ]
        const bodegasUI = [
          'todas',
          ...Array.from(
            new Set(normalizados.map(r => r.bodegaDisplay).filter(Boolean))
          ),
        ]
        const ubicacionesUI = [
          'todas',
          ...Array.from(
            new Set(normalizados.map(r => r.ubicacionDisplay).filter(Boolean))
          ),
        ]

        if (!cancelled) {
          setRows(normalizados)
          setTiposDisponibles(tiposUI)
          setBodegasDisponibles(bodegasUI)
          setUbicacionesDisponibles(ubicacionesUI)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudo cargar el inventario.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Filtro (cabecera) + excluir cantidad = 0
  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    return rows
      .filter(r => toNumberCO(r.cantidad) > 0)
      .filter(r => puedeVerTipo(r.tipo))
      .filter(r =>
        tipoSeleccionado === 'todos' ? true : r.tipo === tipoSeleccionado
      )
      .filter(r =>
        bodegaSeleccionada === 'todas'
          ? true
          : r.bodegaDisplay === bodegaSeleccionada
      )
      .filter(r =>
        ubicacionSeleccionada === 'todas'
          ? true
          : r.ubicacionDisplay === ubicacionSeleccionada
      )
      .filter(r => {
        if (!q) return true
        return (
          String(r.id_producto).toLowerCase().includes(q) ||
          String(r.nombre_producto).toLowerCase().includes(q) ||
          String(r.unidad).toLowerCase().includes(q) ||
          String(r.tipo).toLowerCase().includes(q) ||
          String(r.id_lote).toLowerCase().includes(q) ||
          String(r.bodegaDisplay).toLowerCase().includes(q) ||
          String(r.ubicacionDisplay).toLowerCase().includes(q)
        )
      })
  }, [
    rows,
    globalFilter,
    tipoSeleccionado,
    bodegaSeleccionada,
    ubicacionSeleccionada,
    puedeVerTipo,
  ])

  // Totales
  const totalUnidades = useMemo(
    () =>
      filtered
        .filter(r => isUnidad(r.unidad))
        .reduce((s, r) => s + (toNumberCO(r.cantidad) || 0), 0),
    [filtered]
  )
  const totalKilos = useMemo(
    () => filtered.reduce((s, r) => s + (toNumberCO(r.pesoTotalKg) || 0), 0),
    [filtered]
  )

  // Exportar
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Inventario por lote (resumen backend)'],
      [
        'Filtros',
        `Tipo=${tipoSeleccionado}`,
        `Bodega=${bodegaSeleccionada}`,
        `Ubicación=${ubicacionSeleccionada}`,
        `Buscar="${globalFilter}"`,
      ],
      [
        'Totales',
        `Unidades=${numberCO(totalUnidades, 2)}`,
        `Kilos=${numberCO(totalKilos, 2)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        'Código Producto': r.id_producto,
        'Nombre Producto': r.nombre_producto,
        Tipo: r.tipo,
        Unidad: r.unidad,
        'Bodega (mostrar)': r.bodegaDisplay || '',
        'ID Bodega': r.id_bodega || '',
        'Ubicación (mostrar)': r.ubicacionDisplay || '',
        'ID Ubicación': r.id_ubicacion || '',
        'ID Lote': r.id_lote,
        Cantidad: toNumberCO(r.cantidad),
        'Peso unitario (kg)':
          r.pesoUnitarioKg != null ? toNumberCO(r.pesoUnitarioKg) : 0,
        'Medida en kilos (kg)': toNumberCO(r.pesoTotalKg) || 0,
        'Último ingreso': r.fecha_fmt,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Inventario por lote')
    writeFile(wb, 'InventarioPorLote.xlsx')
  }

  // Columnas Antd (Código y Nombre fijos) + SORTER + FILTERS
  const columns = useMemo(() => {
    // helpers
    const strSort = (a, b, k) =>
      String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'es', {
        numeric: true,
        sensitivity: 'base',
      })
    const numSort = (a, b, k) => toNumberCO(a[k]) - toNumberCO(b[k])

    return [
      {
        title: 'Código',
        dataIndex: 'id_producto',
        key: 'id_producto',
        width: 140,
        fixed: 'left',
        sorter: (a, b) => strSort(a, b, 'id_producto'),
        sortDirections: ['ascend', 'descend'],
      },
      {
        title: 'Nombre',
        dataIndex: 'nombre_producto',
        key: 'nombre_producto',
        width: 420,
        fixed: 'left',
        ellipsis: true,
        sorter: (a, b) => strSort(a, b, 'nombre_producto'),
        sortDirections: ['ascend', 'descend'],
      },
      {
        title: 'Tipo',
        dataIndex: 'tipo',
        key: 'tipo',
        width: 110,
        sorter: (a, b) => strSort(a, b, 'tipo'),
        filters: tiposDisponibles
          .filter(t => t !== 'todos')
          .map(t => ({ text: t, value: t })),
        onFilter: (value, record) => record.tipo === value,
      },
      {
        title: 'Unidad',
        dataIndex: 'unidad',
        key: 'unidad',
        width: 110,
        sorter: (a, b) => strSort(a, b, 'unidad'),
      },
      {
        title: 'Bodega',
        dataIndex: 'bodegaDisplay',
        key: 'bodegaDisplay',
        width: 120,
        sorter: (a, b) => strSort(a, b, 'bodegaDisplay'),
        filters: bodegasDisponibles
          .filter(b => b !== 'todas')
          .map(b => ({ text: b, value: b })),
        onFilter: (value, record) => record.bodegaDisplay === value,
      },
      {
        title: 'Ubicación',
        dataIndex: 'ubicacionDisplay',
        key: 'ubicacionDisplay',
        width: 120,
        sorter: (a, b) => strSort(a, b, 'ubicacionDisplay'),
        filters: ubicacionesDisponibles
          .filter(u => u !== 'todas')
          .map(u => ({ text: u, value: u })),
        onFilter: (value, record) => record.ubicacionDisplay === value,
      },
      {
        title: 'Lote',
        dataIndex: 'id_lote',
        key: 'id_lote',
        width: 120,
        sorter: (a, b) => strSort(a, b, 'id_lote'),
      },
      {
        title: 'Cantidad',
        dataIndex: 'cantidad',
        key: 'cantidad',
        width: 140,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'cantidad'),
        render: v => (
          <span className='text-end'>{numberCO(toNumberCO(v), 2)}</span>
        ),
      },
      {
        title: 'Peso unitario (kg)',
        dataIndex: 'pesoUnitarioKg',
        key: 'pesoUnitarioKg',
        width: 160,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'pesoUnitarioKg'),
        render: v =>
          v != null ? (
            <span className='text-end'>{numberCO(toNumberCO(v), 2)}</span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'Medida en kilos (kg)',
        dataIndex: 'pesoTotalKg',
        key: 'pesoTotalKg',
        width: 180,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'pesoTotalKg'),
        render: v =>
          toNumberCO(v) > 0 ? (
            <span className='fw-semibold text-end'>
              {numberCO(toNumberCO(v), 2)}
            </span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'Último ingreso',
        dataIndex: 'fecha_fmt',
        key: 'fecha_fmt',
        width: 140,
        sorter: (a, b) => (a.fecha_ts || 0) - (b.fecha_ts || 0),
      },
    ]
  }, [tiposDisponibles, bodegasDisponibles, ubicacionesDisponibles])

  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 380 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Código, nombre, tipo, bodega, ubicación o lote…'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

      {/* Tipo (radios) */}
      <div className='d-flex align-items-center flex-wrap gap-2'>
        {tiposDisponibles.map(t => (
          <label key={t} className='form-check form-check-inline m-0'>
            <input
              type='radio'
              className='form-check-input'
              name='tipo'
              value={t}
              checked={tipoSeleccionado === t}
              onChange={() => setTipoSeleccionado(t)}
            />
            <span className='ms-1'>{t === 'todos' ? 'Todos' : t}</span>
          </label>
        ))}
      </div>

      {/* Bodega (select) */}
      <div className='ms-2'>
        <div className='input-group'>
          <span className='input-group-text'>Bodega</span>
          <select
            className='form-select'
            value={bodegaSeleccionada}
            onChange={e => setBodegaSeleccionada(e.target.value)}
          >
            {bodegasDisponibles.map(b => (
              <option key={b} value={b}>
                {b === 'todas' ? 'Todas' : b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ubicación (select) */}
      <div>
        <div className='input-group'>
          <span className='input-group-text'>Ubicación</span>
          <select
            className='form-select'
            value={ubicacionSeleccionada}
            onChange={e => setUbicacionSeleccionada(e.target.value)}
          >
            {ubicacionesDisponibles.map(u => (
              <option key={u} value={u}>
                {u === 'todas' ? 'Todas' : u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className='ms-auto d-flex align-items-center gap-3'>
        <div className='text-muted small'>
          <strong>Total Unidades:</strong> {numberCO(totalUnidades, 2)}
          {'  ·  '}
          <strong>Total Kilos:</strong> {numberCO(totalKilos, 2)}
        </div>
        <button
          className='btn btn-sm btn-success'
          onClick={exportar}
          disabled={loading || filtered.length === 0}
        >
          <FaFileExcel className='me-1' /> Exportar
        </button>
      </div>
    </div>
  )

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Inventario por lote</strong>
          <div className='small text-muted'>
            Vista por Bodega / Ubicación / Lote
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        {/* SubHeader propio encima de la tabla */}
        <div className='mb-2'>{SubHeader}</div>

        <Table
          columns={columns}
          dataSource={filtered}
          loading={loading}
          // x dinámico para que el sticky + fixed funcionen siempre
          scroll={{ x: 'max-content', y: 520 }}
          sticky
          rowKey='key'
          size='middle'
          pagination={{
            pageSize: 30,
            showSizeChanger: true,
            pageSizeOptions: [30, 50, 100],
          }}
        />
      </div>
    </div>
  )
}

export default InventarioGeneral
