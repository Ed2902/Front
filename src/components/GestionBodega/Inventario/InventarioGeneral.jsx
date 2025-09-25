import { useEffect, useMemo, useState, useCallback } from 'react'
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
    const s = v
      .trim()
      .replace(/\s+/g, '')
      .replace(/\./g, '') // separador de miles
      .replace(/,/g, '.') // coma decimal -> punto
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

  // Filtros UI
  const [globalFilter, setGlobalFilter] = useState('')
  const [tiposDisponibles, setTiposDisponibles] = useState(['todos'])
  const [tipoSeleccionado, setTipoSeleccionado] = useState('todos')

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
            it?.Nombre_Producto ?? it?.Producto?.Nombre ?? ''
          const tipo = it?.Tipo ?? it?.Producto?.Tipo ?? ''
          const unidad =
            it?.Unidad_de_medida ?? it?.Producto?.Unidad_de_medida ?? ''
          const id_lote = it?.Id_lote ?? it?.id_lote ?? ''

          // Cantidad (prioriza Cantidad_Inventario; fallback a Cantidad_Lote)
          const cantidad =
            toNumberCO(it?.Cantidad_Inventario ?? it?.Cantidad) ||
            toNumberCO(it?.Cantidad_Lote) ||
            0

          // Peso Unitario Kg (si viene por backend)
          const _pu = toNumberCO(it?.PesoUnitarioKg)
          const pesoUnitarioKg = _pu > 0 ? _pu : null

          // Fecha del último ingreso (algunos datasets traen typo de clave)
          const fechaUlt =
            it?.Fecha_ultimo_registro ?? it?.Fecha_ultimo_registri ?? null

          // *** REGLA de kilos por fila ***
          // - Si hay peso unitario (>0): multiplicar
          // - Si no hay: tomar cantidad como kilos
          let pesoTotalKg = 0
          if (pesoUnitarioKg != null && pesoUnitarioKg > 0) {
            pesoTotalKg = cantidad * pesoUnitarioKg
          } else {
            // si la cantidad ya viene en kg, coincide; si viene en unidades, se asume 1 unidad = 1 kg
            // (ajustar aquí si tu dominio requiere otra conversión)
            pesoTotalKg = cantidad
          }

          return {
            id_producto,
            nombre_producto,
            tipo,
            unidad,
            id_lote,
            cantidad,
            pesoUnitarioKg,
            pesoTotalKg,
            fecha_fmt: fechaUlt
              ? new Date(fechaUlt).toLocaleDateString('es-CO')
              : 'N/A',
          }
        })

        const tiposUI = [
          'todos',
          ...Array.from(new Set(normalizados.map(r => r.tipo).filter(Boolean))),
        ]

        if (!cancelled) {
          setRows(normalizados)
          setTiposDisponibles(tiposUI)
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

  // Filtro (permisos / tipo / buscador)
  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    return rows
      .filter(r => puedeVerTipo(r.tipo))
      .filter(r =>
        tipoSeleccionado === 'todos' ? true : r.tipo === tipoSeleccionado
      )
      .filter(r => {
        if (!q) return true
        return (
          String(r.id_producto).toLowerCase().includes(q) ||
          String(r.nombre_producto).toLowerCase().includes(q) ||
          String(r.unidad).toLowerCase().includes(q) ||
          String(r.tipo).toLowerCase().includes(q) ||
          String(r.id_lote).toLowerCase().includes(q)
        )
      })
  }, [rows, globalFilter, tipoSeleccionado, puedeVerTipo])

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

  // Exportar (sin ID inventario ni Referencia)
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Inventario por lote (resumen backend)'],
      ['Filtros', `Tipo=${tipoSeleccionado}`, `Buscar="${globalFilter}"`],
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

  // Columnas (sin ID Inv. ni Referencia)
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
        minWidth: '420px',
        wrap: false,
      },
      { name: 'Tipo', selector: r => r.tipo, sortable: true, width: '90px' },
      {
        name: 'Unidad',
        selector: r => r.unidad,
        sortable: true,
        width: '110px',
      },
      { name: 'Lote', selector: r => r.id_lote, sortable: true, width: '96px' },
      {
        name: 'Cantidad',
        selector: r => r.cantidad,
        sortable: true,
        right: true,
        width: '130px',
        cell: r => (
          <span className='text-end'>
            {numberCO(toNumberCO(r.cantidad), 2)}
          </span>
        ),
      },
      {
        name: 'Peso unitario (kg)',
        selector: r => r.pesoUnitarioKg ?? null,
        sortable: true,
        right: true,
        width: '150px',
        cell: r =>
          r.pesoUnitarioKg != null ? (
            <span className='text-end'>
              {numberCO(toNumberCO(r.pesoUnitarioKg), 2)}
            </span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        name: 'Medida en kilos (kg)',
        selector: r => r.pesoTotalKg,
        sortable: true,
        right: true,
        width: '170px',
        cell: r =>
          toNumberCO(r.pesoTotalKg) > 0 ? (
            <span className='fw-semibold text-end'>
              {numberCO(toNumberCO(r.pesoTotalKg), 2)}
            </span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        name: 'Último ingreso',
        selector: r => r.fecha_fmt,
        sortable: true,
        width: '130px',
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
      <div className='input-group' style={{ maxWidth: 380 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Código, nombre, tipo o lote…'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

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

export default InventarioGeneral
