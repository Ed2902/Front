import { useEffect, useMemo, useState } from 'react'
import { ConfigProvider, Table, Tooltip } from 'antd'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioResumen } from './inventario_service'

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

// Toma el primer valor definido (no null/undefined/'')
const pickFirstDefined = (...vals) => vals.find(v => v != null && v !== '')

const isUnidad = u => /(unidad|unid|uds?)/i.test(String(u || '').trim())

const InventarioProveedor = () => {
  const [rows, setRows] = useState([]) // filas consolidadas por proveedor+producto
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await getInventarioResumen()
        const arr = Array.isArray(data) ? data : []

        // Consolidar por (proveedor, producto)
        const map = new Map()
        for (const it of arr) {
          const provId =
            pickFirstDefined(it?.Id_proveedor, it?.id_proveedor) ?? 'SIN_PROV'
          const provName =
            pickFirstDefined(it?.Nombre_Proveedor, it?.Proveedor?.Nombre) ??
            'Sin proveedor'
          const prodId = pickFirstDefined(it?.Id_producto, it?.id_producto)
          if (!prodId) continue

          const prodName =
            pickFirstDefined(it?.Nombre_Producto, it?.Producto?.Nombre) ?? ''
          const unidad =
            pickFirstDefined(
              it?.Unidad_de_medida,
              it?.Producto?.Unidad_de_medida
            ) ?? ''
          const loteId = pickFirstDefined(it?.Id_lote, it?.id_lote) ?? null
          const fechaUlt =
            pickFirstDefined(
              it?.Fecha_ultimo_registro,
              it?.Fecha_ultimo_registri
            ) ?? null

          // Bodega / Ubicación (display inteligente: nombre || id)
          const id_bodega = pickFirstDefined(
            it?.id_bodega,
            it?.Id_bodega,
            it?.Bodega?.Id,
            it?.BodegaId
          )
          const bodegaNombre = pickFirstDefined(
            it?.Bodega?.Nombre,
            it?.BodegaNombre,
            it?.Bodega
          )
          const bodegaDisplay = bodegaNombre || id_bodega || ''

          const id_ubicacion = pickFirstDefined(
            it?.id_ubicacion,
            it?.Id_ubicacion,
            it?.Ubicacion?.Id,
            it?.UbicacionId
          )
          const ubicacionNombre = pickFirstDefined(
            it?.Ubicacion?.Nombre,
            it?.UbicacionNombre,
            it?.Ubicacion,
            it?.ubicacion
          )
          const ubicacionDisplay = ubicacionNombre || id_ubicacion || ''

          // Cantidad fila
          const cantidadRaw = pickFirstDefined(
            it?.Cantidad_Inventario,
            it?.Cantidad,
            it?.Cantidad_Lote
          )
          const cantidadFila = toNumberCO(cantidadRaw)

          // Kilos por fila: PesoTotalKg || (cantidad*PU) || cantidad
          const pesoTotalFromBE = toNumberCO(it?.PesoTotalKg)
          const pu = toNumberCO(it?.PesoUnitarioKg)
          const kilosFila =
            pesoTotalFromBE > 0
              ? pesoTotalFromBE
              : pu > 0
              ? cantidadFila * pu
              : cantidadFila

          const key = `${provId}|${prodId}`
          if (!map.has(key)) {
            map.set(key, {
              key, // rowKey
              id_proveedor: provId,
              proveedor: provName,
              id_producto: prodId,
              nombre_producto: prodName,
              unidad_referencial: unidad,
              cantidad_total: 0,
              unidades_total: 0,
              kilos_total: 0,
              lotes: new Set(),
              bodegas: new Set(),
              ubicaciones: new Set(),
              ultimo_ingreso: fechaUlt,
            })
          }

          const acc = map.get(key)
          acc.cantidad_total += cantidadFila
          acc.kilos_total += kilosFila
          if (isUnidad(unidad)) acc.unidades_total += cantidadFila
          if (loteId) acc.lotes.add(loteId)
          if (bodegaDisplay) acc.bodegas.add(bodegaDisplay)
          if (ubicacionDisplay) acc.ubicaciones.add(ubicacionDisplay)

          // último ingreso más reciente
          if (fechaUlt) {
            const cur = acc.ultimo_ingreso ? new Date(acc.ultimo_ingreso) : null
            const neu = new Date(fechaUlt)
            if (!cur || neu > cur) acc.ultimo_ingreso = fechaUlt
          }
        }

        const out = Array.from(map.values()).map(r => {
          const bodegasList = Array.from(r.bodegas)
          const ubicList = Array.from(r.ubicaciones)
          const bodegas_muestra = bodegasList.slice(0, 3).join(', ')
          const ubic_muestra = ubicList.slice(0, 3).join(', ')
          const ultimo_ingreso_ts = r.ultimo_ingreso
            ? new Date(r.ultimo_ingreso).getTime()
            : 0
          return {
            ...r,
            cantidad_total: toNumberCO(r.cantidad_total),
            unidades_total: toNumberCO(r.unidades_total),
            kilos_total: toNumberCO(r.kilos_total),
            lotes_count: r.lotes.size,
            bodegas_count: bodegasList.length,
            ubicaciones_count: ubicList.length,
            bodegas_muestra,
            bodegas_full: bodegasList.join(', '),
            ubicaciones_muestra: ubic_muestra,
            ubicaciones_full: ubicList.join(', '),
            ultimo_ingreso_ts,
            ultimo_ingreso_fmt: r.ultimo_ingreso
              ? new Date(r.ultimo_ingreso).toLocaleDateString('es-CO')
              : 'N/A',
          }
        })

        // Orden sugerido: más kilos primero
        out.sort((a, b) => b.kilos_total - a.kilos_total)

        if (!cancelled) setRows(out)
      } catch (err) {
        console.error(err)
        if (!cancelled)
          setError('No se pudo cargar el inventario por proveedor.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Buscar por proveedor, código o nombre
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (!q) return true
      return (
        String(r.proveedor).toLowerCase().includes(q) ||
        String(r.id_producto).toLowerCase().includes(q) ||
        String(r.nombre_producto).toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  // Totales
  const totalCantidad = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.cantidad_total), 0),
    [filtered]
  )
  const totalUnidades = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.unidades_total), 0),
    [filtered]
  )
  const totalKilos = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.kilos_total), 0),
    [filtered]
  )

  // Exportar Excel (consolidado)
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Inventario por Proveedor (consolidado por producto)'],
      ['Filtros', `Buscar="${search}"`],
      [
        'Totales',
        `Cantidad=${numberCO(totalCantidad, 2)}`,
        `Unidades=${numberCO(totalUnidades, 2)}`,
        `Kilos=${numberCO(totalKilos, 2)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        Proveedor: r.proveedor,
        'Código Producto': r.id_producto,
        'Nombre Producto': r.nombre_producto,
        'Unidad (ref.)': r.unidad_referencial,
        'Cantidad Total': toNumberCO(r.cantidad_total),
        'Unidades (agregadas)': toNumberCO(r.unidades_total),
        'Kilos Totales': toNumberCO(r.kilos_total),
        'N° Lotes': r.lotes_count,
        'Ubicaciones (N)': r.ubicaciones_count,
        'Ubicaciones (lista)': r.ubicaciones_full,
        'Último ingreso': r.ultimo_ingreso_fmt,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Por Proveedor')
    writeFile(wb, 'InventarioPorProveedor.xlsx')
  }

  // Helpers sort
  const strSort = (a, b, k) =>
    String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'es', {
      numeric: true,
      sensitivity: 'base',
    })
  const numSort = (a, b, k) => toNumberCO(a[k]) - toNumberCO(b[k])

  // Filtros dinámicos de columnas
  const proveedorFilters = useMemo(
    () =>
      Array.from(new Set(rows.map(r => r.proveedor))).map(p => ({
        text: p,
        value: p,
      })),
    [rows]
  )
  const unidadFilters = useMemo(
    () =>
      Array.from(
        new Set(rows.map(r => r.unidad_referencial).filter(Boolean))
      ).map(u => ({
        text: u,
        value: u,
      })),
    [rows]
  )

  // Columnas (Proveedor, Código y Nombre fijos a la izquierda) + sorter + filters
  const columns = useMemo(
    () => [
      {
        title: 'Proveedor',
        dataIndex: 'proveedor',
        key: 'proveedor',
        width: 180,
        fixed: 'left',
        sorter: (a, b) => strSort(a, b, 'proveedor'),
        sortDirections: ['ascend', 'descend'],
        filters: proveedorFilters,
        onFilter: (value, record) => record.proveedor === value,
      },
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
        width: 300,
        fixed: 'left',
        ellipsis: true,
        sorter: (a, b) => strSort(a, b, 'nombre_producto'),
        sortDirections: ['ascend', 'descend'],
      },

      {
        title: 'Unidad (ref.)',
        dataIndex: 'unidad_referencial',
        key: 'unidad_referencial',
        width: 90,
        sorter: (a, b) => strSort(a, b, 'unidad_referencial'),
        filters: unidadFilters,
        onFilter: (value, record) => record.unidad_referencial === value,
      },
      {
        title: 'Cantidad Total',
        dataIndex: 'cantidad_total',
        key: 'cantidad_total',
        width: 150,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'cantidad_total'),
        render: v => (
          <span className='text-end'>{numberCO(toNumberCO(v), 2)}</span>
        ),
      },
      {
        title: 'Unidades (agregadas)',
        dataIndex: 'unidades_total',
        key: 'unidades_total',
        width: 170,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'unidades_total'),
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
        title: 'Kilos Totales',
        dataIndex: 'kilos_total',
        key: 'kilos_total',
        width: 160,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'kilos_total'),
        render: v => (
          <span className='fw-semibold text-end'>
            {numberCO(toNumberCO(v), 2)}
          </span>
        ),
      },
      {
        title: 'N° Lotes',
        dataIndex: 'lotes_count',
        key: 'lotes_count',
        width: 120,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'lotes_count'),
      },
      {
        title: 'Ubicaciones',
        key: 'ubicaciones',
        width: 260,
        sorter: (a, b) => numSort(a, b, 'ubicaciones_count'),
        filters: [
          { text: 'Con ubicaciones', value: 'con' },
          { text: 'Sin ubicaciones', value: 'sin' },
        ],
        onFilter: (value, record) =>
          value === 'con'
            ? record.ubicaciones_count > 0
            : record.ubicaciones_count === 0,
        render: (_, r) =>
          r.ubicaciones_count > 0 ? (
            <Tooltip title={r.ubicaciones_full}>
              <span>
                {r.ubicaciones_count}{' '}
                {r.ubicaciones_count === 1 ? 'ubicación' : 'ubicaciones'}
                {r.ubicaciones_muestra
                  ? ` (${r.ubicaciones_muestra}${
                      r.ubicaciones_count > 3
                        ? ` +${r.ubicaciones_count - 3} más`
                        : ''
                    })`
                  : ''}
              </span>
            </Tooltip>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'Último ingreso',
        dataIndex: 'ultimo_ingreso_fmt',
        key: 'ultimo_ingreso_fmt',
        width: 150,
        sorter: (a, b) =>
          (a.ultimo_ingreso_ts || 0) - (b.ultimo_ingreso_ts || 0),
        sortDirections: ['ascend', 'descend'],
      },
    ],
    [proveedorFilters, unidadFilters]
  )

  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 420 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Proveedor, código o nombre…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-3'>
        <div className='text-muted small'>
          <strong>Total Cantidad:</strong> {numberCO(totalCantidad, 2)}
          {'  ·  '}
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
          <strong>Inventario por Proveedor</strong>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        {/* Filtros y totales */}
        <div className='mb-2'>{SubHeader}</div>

        {/* Bordes visibles y color de división sin CSS externo */}
        <ConfigProvider theme={{ token: { colorSplit: '#bfbfbf' } }}>
          <Table
            columns={columns}
            dataSource={filtered}
            loading={loading}
            scroll={{ x: 'max-content', y: 520 }} // scroll horizontal + sticky
            sticky
            bordered
            rowKey='key'
            size='middle'
            pagination={{
              pageSize: 30,
              showSizeChanger: true,
              pageSizeOptions: [30, 50, 100],
            }}
          />
        </ConfigProvider>
      </div>
    </div>
  )
}

export default InventarioProveedor
