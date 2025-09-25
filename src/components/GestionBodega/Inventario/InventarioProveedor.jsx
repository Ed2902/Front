import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioResumen } from './inventario_service'

const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

// Parser robusto para "es-CO" (e.g., "1.234,56" -> 1234.56)
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

          // Cantidad fila (prioridad: Inventario -> Cantidad -> Cantidad_Lote)
          const cantidadRaw = pickFirstDefined(
            it?.Cantidad_Inventario,
            it?.Cantidad,
            it?.Cantidad_Lote
          )
          const cantidadFila = toNumberCO(cantidadRaw)

          // Kilos por fila:
          // 1) Usa PesoTotalKg si viene (>0)
          // 2) Si hay PU (>0): cantidad * PU
          // 3) Si no: cantidad
          const pesoTotalFromBE = toNumberCO(it?.PesoTotalKg)
          const pu = toNumberCO(it?.PesoUnitarioKg)

          let kilosFila = 0
          if (pesoTotalFromBE > 0) {
            kilosFila = pesoTotalFromBE
          } else if (pu > 0) {
            kilosFila = cantidadFila * pu
          } else {
            kilosFila = cantidadFila
          }

          const key = `${provId}|${prodId}`
          if (!map.has(key)) {
            map.set(key, {
              id_proveedor: provId,
              proveedor: provName,
              id_producto: prodId,
              nombre_producto: prodName,
              unidad_referencial: unidad, // informativo
              cantidad_total: 0,
              unidades_total: 0, // solo donde unidad = "unidades"
              kilos_total: 0,
              lotes: new Set(),
              ultimo_ingreso: fechaUlt,
            })
          }

          const acc = map.get(key)
          acc.cantidad_total += cantidadFila
          acc.kilos_total += kilosFila
          if (isUnidad(unidad)) acc.unidades_total += cantidadFila
          if (loteId) acc.lotes.add(loteId)

          // último ingreso más reciente
          if (fechaUlt) {
            const cur = acc.ultimo_ingreso ? new Date(acc.ultimo_ingreso) : null
            const neu = new Date(fechaUlt)
            if (!cur || neu > cur) acc.ultimo_ingreso = fechaUlt
          }
        }

        const out = Array.from(map.values()).map(r => ({
          ...r,
          cantidad_total: toNumberCO(r.cantidad_total),
          unidades_total: toNumberCO(r.unidades_total),
          kilos_total: toNumberCO(r.kilos_total),
          lotes_count: r.lotes.size,
          ultimo_ingreso_fmt: r.ultimo_ingreso
            ? new Date(r.ultimo_ingreso).toLocaleDateString('es-CO')
            : 'N/A',
        }))

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
        'Último ingreso': r.ultimo_ingreso_fmt,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Por Proveedor')
    writeFile(wb, 'InventarioPorProveedor.xlsx')
  }

  // Columnas (Nombre amplio, números a la derecha)
  const columns = useMemo(
    () => [
      {
        name: 'Proveedor',
        selector: r => r.proveedor,
        sortable: true,
        width: '180px',
        wrap: true,
      },
      {
        name: 'Código',
        selector: r => r.id_producto,
        sortable: true,
        width: '140px',
      },
      {
        name: 'Nombre',
        selector: r => r.nombre_producto,
        sortable: true,
        grow: 6,
        minWidth: '420px',
        wrap: false,
      },
      {
        name: 'Unidad (ref.)',
        selector: r => r.unidad_referencial,
        sortable: true,
        width: '100px',
      },
      {
        name: 'Cantidad Total',
        selector: r => r.cantidad_total,
        sortable: true,
        right: true,
        width: '150px',
        cell: r => (
          <span className='text-end'>
            {numberCO(toNumberCO(r.cantidad_total), 2)}
          </span>
        ),
      },
      {
        name: 'Unidades (agregadas)',
        selector: r => r.unidades_total,
        sortable: true,
        right: true,
        width: '170px',
        cell: r =>
          toNumberCO(r.unidades_total) > 0 ? (
            <span className='fw-semibold text-end'>
              {numberCO(toNumberCO(r.unidades_total), 2)}
            </span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        name: 'Kilos Totales',
        selector: r => r.kilos_total,
        sortable: true,
        right: true,
        width: '160px',
        cell: r => (
          <span className='fw-semibold text-end'>
            {numberCO(toNumberCO(r.kilos_total), 2)}
          </span>
        ),
      },
      {
        name: 'N° Lotes',
        selector: r => r.lotes_count,
        sortable: true,
        right: true,
        width: '110px',
      },
      {
        name: 'Último ingreso',
        selector: r => r.ultimo_ingreso_fmt,
        sortable: true,
        width: '140px',
      },
    ],
    []
  )

  const customStyles = {
    headCells: {
      style: {
        fontWeight: 600,
        whiteSpace: 'normal',
        lineHeight: '1.1',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
      },
    },
    rows: { style: { minHeight: '44px' } },
  }

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
          <div className='text-muted small'></div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        <DataTable
          columns={columns}
          data={filtered}
          progressPending={loading}
          pagination
          paginationPerPage={30}
          paginationRowsPerPageOptions={[30, 50, 100]}
          highlightOnHover
          dense
          responsive
          customStyles={customStyles}
          subHeader
          subHeaderComponent={SubHeader}
          persistTableHead
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>
    </div>
  )
}

export default InventarioProveedor
