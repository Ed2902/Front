/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioResumen } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'

const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const isUnidad = u => (u || '').toLowerCase() === 'unidades'
const isKiloUnit = u => /(kg|kilo)/i.test((u || '').toLowerCase())

const InventarioLote = () => {
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
        const data = await getInventarioResumen()
        if (!cancelled) setRaw(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo cargar el inventario por lote.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // --- Agrupar por lote con totales + items detallados
  const lotes = useMemo(() => {
    const map = new Map()
    for (const it of raw) {
      if (!puedeVerTipo(it?.Tipo)) continue

      const loteId = it?.Id_lote ?? it?.id_lote ?? 'Sin Lote'
      const unidad = it?.Unidad_de_medida ?? ''
      const cantidad =
        Number(it?.Cantidad_Inventario ?? it?.Cantidad) ||
        Number(it?.Cantidad_Lote) ||
        0

      // kilos por fila (preferir PesoTotalKg; si no, reglas)
      const pesoTotalFromBE = Number(it?.PesoTotalKg) || 0
      const pu = it?.PesoUnitarioKg != null ? Number(it.PesoUnitarioKg) : null

      let kilos = 0
      if (pesoTotalFromBE > 0) kilos = pesoTotalFromBE
      else if (isUnidad(unidad) && pu && pu > 0) kilos = cantidad * pu
      else if (isKiloUnit(unidad)) kilos = cantidad

      const fila = {
        id_producto: it?.Id_producto ?? it?.id_producto,
        nombre_producto: it?.Nombre_Producto ?? it?.Producto?.Nombre ?? '',
        unidad,
        cantidad,
        pesoUnitarioKg: isUnidad(unidad) && pu != null ? pu : null,
        kilos,
        bodega: it?.id_bodega ?? '',
        ubicacion: it?.id_ubicacion ?? '',
        fechaRaw: it?.Fecha_ultimo_registro ?? null,
        fecha: it?.Fecha_ultimo_registro
          ? new Date(it.Fecha_ultimo_registro).toLocaleDateString('es-CO')
          : 'N/A',
      }

      if (!map.has(loteId)) {
        map.set(loteId, {
          loteId,
          items: [],
          totalUnidades: 0,
          totalKilos: 0,
          ultimoIngreso: null,
        })
      }
      const acc = map.get(loteId)
      acc.items.push(fila)
      if (isUnidad(unidad)) acc.totalUnidades += cantidad
      acc.totalKilos += kilos

      if (fila.fechaRaw) {
        const cur = acc.ultimoIngreso ? new Date(acc.ultimoIngreso) : null
        const neu = new Date(fila.fechaRaw)
        if (!cur || neu > cur) acc.ultimoIngreso = fila.fechaRaw
      }
    }

    // Orden por lote asc, y por nombre dentro
    for (const v of map.values()) {
      v.items.sort((a, b) =>
        String(a.nombre_producto).localeCompare(String(b.nombre_producto), 'es')
      )
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.loteId).localeCompare(String(b.loteId), 'es')
    )
  }, [raw, tienePermiso])

  // --- Filtro global (lote o cualquier campo hijo)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lotes
    return lotes.filter(
      l =>
        String(l.loteId).toLowerCase().includes(q) ||
        l.items.some(item =>
          Object.values(item).some(val =>
            String(val ?? '')
              .toLowerCase()
              .includes(q)
          )
        )
    )
  }, [lotes, search])

  // --- Totales globales (sobre lo filtrado)
  const totalUnidades = useMemo(
    () => filtered.reduce((s, l) => s + (Number(l.totalUnidades) || 0), 0),
    [filtered]
  )
  const totalKilos = useMemo(
    () => filtered.reduce((s, l) => s + (Number(l.totalKilos) || 0), 0),
    [filtered]
  )

  // --- Exportar Excel (detalle por item)
  const exportar = () => {
    const plano = filtered.flatMap(l =>
      l.items.map(p => ({
        Lote: l.loteId,
        Código: p.id_producto,
        Producto: p.nombre_producto,
        Unidad: p.unidad,
        Cantidad: p.cantidad,
        'Peso unitario (kg)': p.pesoUnitarioKg ?? '',
        Kilos: p.kilos,
        Bodega: p.bodega,
        Ubicación: p.ubicacion,
        'Último ingreso': p.fecha,
      }))
    )
    const wb = utils.book_new()
    const head = [
      ['Inventario por Lote'],
      [
        'Totales filtrados',
        `Unidades=${numberCO(totalUnidades, 2)}`,
        `Kilos=${numberCO(totalKilos, 2)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(sheet, plano, { origin: -1 })
    utils.book_append_sheet(wb, sheet, 'Por Lote')
    writeFile(wb, 'InventarioPorLote.xlsx')
  }

  // --- Columnas tabla padre (lotes)
  const parentColumns = [
    {
      name: 'Lote',
      selector: r => r.loteId,
      sortable: true,
      width: '110px', // 👈 compacto (5–6 chars)
    },
    {
      name: 'Registros',
      selector: r => r.items?.length || 0,
      sortable: true,
      right: true,
      width: '120px',
    },
    {
      name: 'Total Unidades',
      selector: r => r.totalUnidades,
      sortable: true,
      right: true,
      width: '150px',
      cell: r =>
        Number(r.totalUnidades) > 0 ? (
          <span className='text-end'>{numberCO(r.totalUnidades, 2)}</span>
        ) : (
          <span className='text-muted'>—</span>
        ),
    },
    {
      name: 'Total Kg',
      selector: r => r.totalKilos,
      sortable: true,
      right: true,
      width: '150px',
      cell: r => (
        <span className='fw-semibold text-end'>
          {numberCO(r.totalKilos, 2)}
        </span>
      ),
    },
    {
      name: 'Último ingreso',
      selector: r =>
        r.ultimoIngreso
          ? new Date(r.ultimoIngreso).toLocaleDateString('es-CO')
          : 'N/A',
      sortable: true,
      width: '140px',
    },
  ]

  // --- Columnas tabla hija (items dentro del lote)
  const childColumns = [
    {
      name: 'Código',
      selector: r => r.id_producto,
      sortable: true,
      width: '140px',
    },
    {
      name: 'Producto',
      selector: r => r.nombre_producto,
      sortable: true,
      grow: 6,
      minWidth: '420px',
      wrap: false,
    },
    { name: 'Unidad', selector: r => r.unidad, sortable: true, width: '110px' },
    {
      name: 'Cantidad',
      selector: r => r.cantidad,
      sortable: true,
      right: true,
      width: '130px',
      cell: r => <span className='text-end'>{numberCO(r.cantidad, 2)}</span>,
    },
    {
      name: 'Peso unit. (kg)',
      selector: r => r.pesoUnitarioKg ?? null,
      sortable: true,
      right: true,
      width: '150px',
      cell: r =>
        r.pesoUnitarioKg != null ? (
          <span className='text-end'>{numberCO(r.pesoUnitarioKg, 2)}</span>
        ) : (
          <span className='text-muted'>—</span>
        ),
    },
    {
      name: 'Kilos',
      selector: r => r.kilos,
      sortable: true,
      right: true,
      width: '140px',
      cell: r => (
        <span className='fw-semibold text-end'>{numberCO(r.kilos, 2)}</span>
      ),
    },
    { name: 'Bodega', selector: r => r.bodega, sortable: true, width: '110px' },
    {
      name: 'Ubicación',
      selector: r => r.ubicacion,
      sortable: true,
      width: '110px',
    },
    {
      name: 'Último ingreso',
      selector: r => r.fecha,
      sortable: true,
      width: '130px',
    },
  ]

  // --- Estilos DataTable
  const tableStyles = {
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

  // --- Componente expandible: subtabla por lote
  const ExpandedComponent = ({ data }) => (
    <div className='w-100 px-2 py-2'>
      <DataTable
        columns={childColumns}
        data={data.items}
        dense
        responsive
        highlightOnHover
        noHeader
        customStyles={tableStyles}
        pagination
        paginationPerPage={10}
        paginationRowsPerPageOptions={[10, 20, 50]}
      />
    </div>
  )

  // --- SubHeader (buscador + totales + export)
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 360 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Lote, código o producto…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Inventario por Lote</strong>
          <div className='text-muted small'>
            Despliega cada lote y su detalle por producto.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        <DataTable
          columns={parentColumns}
          data={filtered}
          progressPending={loading}
          pagination
          paginationPerPage={30}
          paginationRowsPerPageOptions={[30, 50, 100]}
          highlightOnHover
          dense
          responsive
          customStyles={tableStyles}
          subHeader
          subHeaderComponent={SubHeader}
          persistTableHead
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>
    </div>
  )
}

export default InventarioLote
