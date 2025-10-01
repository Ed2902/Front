/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { ConfigProvider, Table } from 'antd'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioCompleto } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'

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

// Primer valor definido (no null/undefined/'')
const pickFirstDefined = (...vals) => vals.find(v => v != null && v !== '')

// Detección de unidad
const isUnidad = u => /(unidad|unid|uds?)/i.test(String(u || '').trim())
const isKg = u => /\b(?:kg|kilo|kilos)\b/i.test(String(u || '').trim())

const InventarioPorTercero = () => {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const { tienePermiso } = usePermisos()
  const puedeVerTipo = tipo => {
    if (tipo === 'RS') return tienePermiso('productosRS')
    if (tipo === 'Bodega') return tienePermiso('productosBodega')
    return false
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getInventarioCompleto()
        if (!cancelled) setRaw(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo cargar el inventario por tercero.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Agrupar por tercero (Cliente o Proveedor) y calcular volúmenes + kilos
  const terceros = useMemo(() => {
    const map = new Map()

    for (const it of raw) {
      const tipo = pickFirstDefined(it?.Producto?.Tipo, it?.Tipo)
      if (!puedeVerTipo(tipo)) continue

      const unidad =
        pickFirstDefined(
          it?.Producto?.Unidad_de_medida,
          it?.Unidad_de_medida
        ) ?? ''

      // Cantidad (inventario -> cantidad -> cantidad lote)
      const cantidadRaw = pickFirstDefined(
        it?.Cantidad_Inventario,
        it?.Cantidad,
        it?.Cantidad_Lote
      )
      const cantidad = toNumberCO(cantidadRaw)
      if (cantidad <= 0) continue

      // Tercero (cliente o proveedor)
      const tercero =
        pickFirstDefined(
          it?.LoteProducto?.Cliente?.Nombre,
          it?.LoteProducto?.Proveedor?.Nombre
        ) ?? 'Desconocido'

      // Dimensiones (cm) -> m³
      const alto = toNumberCO(it?.Producto?.Alto)
      const ancho = toNumberCO(it?.Producto?.Ancho)
      const largo = toNumberCO(it?.Producto?.Largo)
      const volumenUnitarioM3 = (alto * ancho * largo) / 1_000_000
      const volumenTotalM3 = volumenUnitarioM3 * cantidad
      const volumenTotalCm3 = volumenTotalM3 * 1_000_000

      // Peso total y PU
      const pesoTotalFromBE = toNumberCO(
        pickFirstDefined(
          it?.PesoTotalKg,
          it?.Peso_total_kg,
          it?.PesoTotal,
          it?.total_kg
        )
      )
      const pu = toNumberCO(
        pickFirstDefined(
          it?.PesoUnitarioKg,
          it?.Producto?.PesoUnitarioKg,
          it?.LoteProducto?.PesoUnitarioKg,
          it?.Peso_unitario_kg,
          it?.Peso_unitario,
          it?.PU_kg
        )
      )

      // Regla kilos
      let kilos = 0
      if (pesoTotalFromBE > 0) kilos = pesoTotalFromBE
      else if (pu > 0 && isUnidad(unidad)) kilos = cantidad * pu
      else if (isKg(unidad)) kilos = cantidad
      else kilos = 0

      const fechaRaw = pickFirstDefined(
        it?.Fecha_ultimo_registro,
        it?.Fecha_ultimo_registri
      )

      const detalle = {
        id_producto: pickFirstDefined(
          it?.Producto?.Id_producto,
          it?.id_producto
        ),
        nombre_producto:
          pickFirstDefined(it?.Producto?.Nombre, it?.Nombre_Producto) ??
          'Desconocido',
        unidad,
        cantidad,
        kilos,
        volumen_m3: volumenTotalM3,
        volumen_cm3: volumenTotalCm3,
        bodega: pickFirstDefined(it?.Bodega?.nombre, it?.id_bodega) ?? '',
        ubicacion:
          pickFirstDefined(it?.UbicacionBodega?.nombre, it?.id_ubicacion) ?? '',
        fechaRaw,
        fecha: fechaRaw
          ? new Date(fechaRaw).toLocaleDateString('es-CO')
          : 'N/A',
      }

      if (!map.has(tercero)) {
        map.set(tercero, {
          key: tercero, // rowKey padre
          tercero,
          items: [],
          totalCantidad: 0,
          totalKilos: 0,
          totalVolumenM3: 0,
          totalVolumenCm3: 0,
          ultimoIngreso: null,
        })
      }
      const acc = map.get(tercero)
      acc.items.push(detalle)
      acc.totalCantidad += cantidad
      acc.totalKilos += kilos
      acc.totalVolumenM3 += volumenTotalM3
      acc.totalVolumenCm3 += volumenTotalCm3

      if (fechaRaw) {
        const cur = acc.ultimoIngreso ? new Date(acc.ultimoIngreso) : null
        const neu = new Date(fechaRaw)
        if (!cur || neu > cur) acc.ultimoIngreso = fechaRaw
      }
    }

    // Ordenar items por producto
    for (const v of map.values()) {
      v.items.sort((a, b) =>
        String(a.nombre_producto).localeCompare(String(b.nombre_producto), 'es')
      )
    }

    // Salida ordenada por nombre de tercero + timestamp para ordenar en tabla
    return Array.from(map.values())
      .map(v => ({
        ...v,
        ultimoIngresoTs: v.ultimoIngreso
          ? new Date(v.ultimoIngreso).getTime()
          : 0,
      }))
      .sort((a, b) => String(a.tercero).localeCompare(String(b.tercero), 'es'))
  }, [raw, tienePermiso])

  // Filtro global por tercero o cualquier campo del detalle
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return terceros
    return terceros.filter(
      t =>
        String(t.tercero).toLowerCase().includes(q) ||
        t.items.some(item =>
          Object.values(item).some(val =>
            String(val ?? '')
              .toLowerCase()
              .includes(q)
          )
        )
    )
  }, [terceros, search])

  // Totales globales
  const totalCantidadGlobal = useMemo(
    () => filtered.reduce((s, t) => s + toNumberCO(t.totalCantidad), 0),
    [filtered]
  )
  const totalKilosGlobal = useMemo(
    () => filtered.reduce((s, t) => s + toNumberCO(t.totalKilos), 0),
    [filtered]
  )
  const totalVolumenM3Global = useMemo(
    () => filtered.reduce((s, t) => s + toNumberCO(t.totalVolumenM3), 0),
    [filtered]
  )

  // Export a Excel (detalle por ítem)
  const exportar = () => {
    const plano = filtered.flatMap(t =>
      t.items.map((p, idx) => ({
        Tercero: t.tercero,
        Código: p.id_producto,
        Producto: p.nombre_producto,
        Unidad: p.unidad,
        Cantidad: toNumberCO(p.cantidad),
        'Kilos (kg)': toNumberCO(p.kilos),
        'Volumen (m³)': toNumberCO(p.volumen_m3),
        'Volumen (cm³)': Math.round(toNumberCO(p.volumen_cm3)),
        Bodega: p.bodega,
        Ubicación: p.ubicacion,
        'Último ingreso': p.fecha,
        _row: idx + 1,
      }))
    )

    const wb = utils.book_new()
    const head = [
      ['Inventario por Tercero (Cliente/Proveedor)'],
      [
        'Totales filtrados',
        `Cantidad=${numberCO(totalCantidadGlobal, 2)}`,
        `Kilos=${numberCO(totalKilosGlobal, 2)}`,
        `Volumen m³=${numberCO(totalVolumenM3Global, 5)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(sheet, plano, { origin: -1 })
    utils.book_append_sheet(wb, sheet, 'Por Tercero')
    writeFile(wb, 'InventarioPorTercero.xlsx')
  }

  // Helpers sort
  const strSort = (a, b, k) =>
    String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'es', {
      numeric: true,
      sensitivity: 'base',
    })
  const numSort = (a, b, k) => toNumberCO(a[k]) - toNumberCO(b[k])

  // Filtros dinámicos (padre e hijo)
  const terceroFilters = useMemo(
    () =>
      Array.from(new Set(terceros.map(t => t.tercero))).map(t => ({
        text: t,
        value: t,
      })),
    [terceros]
  )
  const unidadChildFilters = useMemo(
    () =>
      Array.from(
        new Set(
          terceros.flatMap(t => t.items.map(i => i.unidad)).filter(Boolean)
        )
      ).map(u => ({
        text: u,
        value: u,
      })),
    [terceros]
  )
  const bodegaChildFilters = useMemo(
    () =>
      Array.from(
        new Set(
          terceros.flatMap(t => t.items.map(i => i.bodega)).filter(Boolean)
        )
      ).map(b => ({
        text: b,
        value: b,
      })),
    [terceros]
  )
  const ubicChildFilters = useMemo(
    () =>
      Array.from(
        new Set(
          terceros.flatMap(t => t.items.map(i => i.ubicacion)).filter(Boolean)
        )
      ).map(u => ({
        text: u,
        value: u,
      })),
    [terceros]
  )

  // Columnas tabla padre (Antd) — fijamos "Tercero" + sorter + filters
  const parentColumns = useMemo(
    () => [
      {
        title: 'Tercero',
        dataIndex: 'tercero',
        key: 'tercero',
        width: 320,
        fixed: 'left',
        ellipsis: true,
        sorter: (a, b) => strSort(a, b, 'tercero'),
        sortDirections: ['ascend', 'descend'],
        filters: terceroFilters,
        onFilter: (value, record) => record.tercero === value,
      },
      {
        title: 'Registros',
        dataIndex: ['items', 'length'],
        key: 'registros',
        width: 120,
        align: 'right',
        sorter: (a, b) => (a.items?.length || 0) - (b.items?.length || 0),
        render: (_, r) => r.items?.length || 0,
      },
      {
        title: 'Cantidad Total',
        dataIndex: 'totalCantidad',
        key: 'totalCantidad',
        width: 150,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'totalCantidad'),
        render: v => numberCO(toNumberCO(v), 2),
      },
      {
        title: 'Kilos Totales (kg)',
        dataIndex: 'totalKilos',
        key: 'totalKilos',
        width: 170,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'totalKilos'),
        render: v => numberCO(toNumberCO(v), 2),
      },
      {
        title: 'Volumen Total (m³)',
        dataIndex: 'totalVolumenM3',
        key: 'totalVolumenM3',
        width: 180,
        align: 'right',
        sorter: (a, b) => numSort(a, b, 'totalVolumenM3'),
        render: v => numberCO(toNumberCO(v), 5),
      },
      {
        title: 'Último ingreso',
        dataIndex: 'ultimoIngreso',
        key: 'ultimoIngreso',
        width: 150,
        sorter: (a, b) => (a.ultimoIngresoTs || 0) - (b.ultimoIngresoTs || 0),
        sortDirections: ['ascend', 'descend'],
        render: v => (v ? new Date(v).toLocaleDateString('es-CO') : 'N/A'),
      },
    ],
    [terceroFilters]
  )

  // Columnas tabla hija (detalle) — fijamos "Código" y "Producto" + sorter + filters
  const childColumns = useMemo(
    () => [
      {
        title: 'Código',
        dataIndex: 'id_producto',
        key: 'id_producto',
        width: 160,
        fixed: 'left',
        sorter: (a, b) =>
          String(a.id_producto ?? '').localeCompare(
            String(b.id_producto ?? ''),
            'es',
            {
              numeric: true,
              sensitivity: 'base',
            }
          ),
        sortDirections: ['ascend', 'descend'],
      },
      {
        title: 'Producto',
        dataIndex: 'nombre_producto',
        key: 'nombre_producto',
        width: 420,
        fixed: 'left',
        ellipsis: true,
        sorter: (a, b) =>
          String(a.nombre_producto ?? '').localeCompare(
            String(b.nombre_producto ?? ''),
            'es',
            {
              numeric: true,
              sensitivity: 'base',
            }
          ),
        sortDirections: ['ascend', 'descend'],
      },
      {
        title: 'Unidad',
        dataIndex: 'unidad',
        key: 'unidad',
        width: 130,
        sorter: (a, b) =>
          String(a.unidad ?? '').localeCompare(String(b.unidad ?? ''), 'es', {
            numeric: true,
            sensitivity: 'base',
          }),
        filters: unidadChildFilters,
        onFilter: (value, record) => record.unidad === value,
      },
      {
        title: 'Cantidad',
        dataIndex: 'cantidad',
        key: 'cantidad',
        width: 140,
        align: 'right',
        sorter: (a, b) => toNumberCO(a.cantidad) - toNumberCO(b.cantidad),
        render: v => numberCO(toNumberCO(v), 2),
      },
      {
        title: 'Kilos (kg)',
        dataIndex: 'kilos',
        key: 'kilos',
        width: 150,
        align: 'right',
        sorter: (a, b) => toNumberCO(a.kilos) - toNumberCO(b.kilos),
        render: v => numberCO(toNumberCO(v), 2),
      },
      {
        title: 'Volumen (m³)',
        dataIndex: 'volumen_m3',
        key: 'volumen_m3',
        width: 170,
        align: 'right',
        sorter: (a, b) => toNumberCO(a.volumen_m3) - toNumberCO(b.volumen_m3),
        render: v => numberCO(toNumberCO(v), 5),
      },
      {
        title: 'Volumen (cm³)',
        dataIndex: 'volumen_cm3',
        key: 'volumen_cm3',
        width: 170,
        align: 'right',
        sorter: (a, b) => toNumberCO(a.volumen_cm3) - toNumberCO(b.volumen_cm3),
        render: v => Math.round(toNumberCO(v)).toLocaleString('es-CO'),
      },
      {
        title: 'Bodega',
        dataIndex: 'bodega',
        key: 'bodega',
        width: 160,
        sorter: (a, b) =>
          String(a.bodega ?? '').localeCompare(String(b.bodega ?? ''), 'es', {
            numeric: true,
            sensitivity: 'base',
          }),
        filters: bodegaChildFilters,
        onFilter: (value, record) => record.bodega === value,
      },
      {
        title: 'Ubicación',
        dataIndex: 'ubicacion',
        key: 'ubicacion',
        width: 160,
        sorter: (a, b) =>
          String(a.ubicacion ?? '').localeCompare(
            String(b.ubicacion ?? ''),
            'es',
            { numeric: true, sensitivity: 'base' }
          ),
        filters: ubicChildFilters,
        onFilter: (value, record) => record.ubicacion === value,
      },
      {
        title: 'Último ingreso',
        dataIndex: 'fecha',
        key: 'fecha',
        width: 150,
        sorter: (a, b) => {
          const ta = a.fechaRaw ? new Date(a.fechaRaw).getTime() : 0
          const tb = b.fechaRaw ? new Date(b.fechaRaw).getTime() : 0
          return ta - tb
        },
        sortDirections: ['ascend', 'descend'],
      },
    ],
    [unidadChildFilters, bodegaChildFilters, ubicChildFilters]
  )

  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 420 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Tercero, código o producto…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-3'>
        <div className='text-muted small'>
          <strong>Total Cantidad:</strong> {numberCO(totalCantidadGlobal, 2)}
          {'  ·  '}
          <strong>Total Kilos:</strong> {numberCO(totalKilosGlobal, 2)}
          {'  ·  '}
          <strong>Total Volumen (m³):</strong>{' '}
          {numberCO(totalVolumenM3Global, 5)}
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
          <strong>Inventario por Tercero</strong>
          <div className='text-muted small'>
            Agrupa por Cliente o Proveedor y calcula volumen total y kilos.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        {/* Filtros y totales */}
        <div className='mb-2'>{SubHeader}</div>

        {/* Bordes visibles y color de split sin CSS externo */}
        <ConfigProvider theme={{ token: { colorSplit: '#bfbfbf' } }}>
          <Table
            columns={parentColumns}
            dataSource={filtered}
            loading={loading}
            rowKey='key'
            bordered
            size='middle'
            // scroll horizontal para activar columnas fijas; altura con header sticky
            scroll={{ x: 'max-content', y: 520 }}
            sticky
            expandable={{
              expandedRowRender: record => (
                <Table
                  columns={childColumns}
                  dataSource={record.items}
                  rowKey={(r, idx) => `${r.id_producto}|${r.ubicacion}|${idx}`}
                  size='small'
                  bordered
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50],
                  }}
                  scroll={{ x: 'max-content' }}
                  sticky
                />
              ),
            }}
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

export default InventarioPorTercero
