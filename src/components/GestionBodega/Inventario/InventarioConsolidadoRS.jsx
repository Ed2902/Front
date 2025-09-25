import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
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

const InventarioConsolidadoRS = () => {
  const [rows, setRows] = useState([]) // filas consolidadas por producto (solo RS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const { tienePermiso } = usePermisos()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await getInventarioResumen()
        const arr = Array.isArray(data) ? data : []

        // 1) SOLO RS (lee Tipo en raíz o dentro de Producto)
        const onlyRS = arr.filter(it => {
          const tipo = (it?.Tipo ?? it?.Producto?.Tipo ?? '')
            .toString()
            .toUpperCase()
          return tipo === 'RS'
        })

        // 2) Consolidar por Id_producto
        const map = new Map()
        for (const it of onlyRS) {
          const id = it?.Id_producto ?? it?.id_producto
          if (!id) continue

          const nombre = it?.Nombre_Producto ?? it?.Producto?.Nombre ?? ''
          const unidad =
            it?.Unidad_de_medida ?? it?.Producto?.Unidad_de_medida ?? ''
          const fechaUlt =
            it?.Fecha_ultimo_registro ?? it?.Fecha_ultimo_registri ?? null

          // Cantidad de la fila (prioridad: Inventario -> Cantidad -> Cantidad_Lote)
          const cantidadRaw = pickFirstDefined(
            it?.Cantidad_Inventario,
            it?.Cantidad,
            it?.Cantidad_Lote
          )
          const cantidadFila = toNumberCO(cantidadRaw)

          // Peso unitario
          const pu = toNumberCO(it?.PesoUnitarioKg)

          // *** Regla de kilos por fila ***
          // - Si PU > 0 => kilos = cantidad * PU
          // - Si PU no válido/0/null => kilos = cantidad
          const kilosFila = pu > 0 ? cantidadFila * pu : cantidadFila

          if (!map.has(id)) {
            map.set(id, {
              id_producto: id,
              nombre_producto: nombre,
              unidad_referencial: unidad, // informativo
              cantidad_total: 0, // suma de cantidades crudas
              unidades_total: 0, // suma donde la unidad es "unidades"
              kilos_total: 0, // suma de kilos calculados
              ultimo_ingreso: fechaUlt,
            })
          }
          const acc = map.get(id)
          acc.cantidad_total += cantidadFila
          acc.kilos_total += kilosFila
          if (isUnidad(unidad)) acc.unidades_total += cantidadFila

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
          ultimo_ingreso_fmt: r.ultimo_ingreso
            ? new Date(r.ultimo_ingreso).toLocaleDateString('es-CO')
            : 'N/A',
        }))

        // Orden: más kilos primero
        out.sort((a, b) => b.kilos_total - a.kilos_total)

        if (!cancelled) setRows(out)
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudo cargar el consolidado RS.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Buscar por código o nombre (respetando permiso RS)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(() => tienePermiso('productosRS'))
      .filter(r => {
        if (!q) return true
        return (
          String(r.id_producto).toLowerCase().includes(q) ||
          String(r.nombre_producto).toLowerCase().includes(q)
        )
      })
  }, [rows, search, tienePermiso])

  // Totales
  const totalCant = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.cantidad_total), 0),
    [filtered]
  )
  const totalKg = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.kilos_total), 0),
    [filtered]
  )
  const totalUnidades = useMemo(
    () => filtered.reduce((s, r) => s + toNumberCO(r.unidades_total), 0),
    [filtered]
  )

  // Export a Excel
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Consolidado RS por producto'],
      ['Filtros', `Buscar="${search}"`],
      [
        'Totales',
        `Cantidad=${numberCO(totalCant, 2)}`,
        `Unidades=${numberCO(totalUnidades, 2)}`,
        `Kilos=${numberCO(totalKg, 2)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        'Código Producto': r.id_producto,
        'Nombre Producto': r.nombre_producto,
        'Cantidad Total': toNumberCO(r.cantidad_total),
        'Unidades (agregadas)': toNumberCO(r.unidades_total),
        'Kilos Totales': toNumberCO(r.kilos_total),
        'Último ingreso': r.ultimo_ingreso_fmt,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Consolidado RS')
    writeFile(wb, 'Consolidado_RS.xlsx')
  }

  // Columnas (Nombre amplio + indicador de unidades)
  const columns = useMemo(
    () => [
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
        minWidth: '390px',
        wrap: false,
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
          placeholder='Código o nombre…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-3'>
        <div className='text-muted small'>
          <strong>Total Unidades:</strong> {numberCO(totalUnidades, 2)}
          {'  ·  '}
          <strong>Total Kilos:</strong> {numberCO(totalKg, 2)}
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
          <strong>Consolidado RS por producto</strong>
          <div className='text-muted small'>
            Suma cantidades y kilos de todos los lotes del mismo producto (tipo
            RS).
          </div>
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

export default InventarioConsolidadoRS
