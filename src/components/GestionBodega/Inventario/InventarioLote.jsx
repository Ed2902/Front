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

// Punto pequeño para el estado
const Dot = ({ color = 'var(--bs-secondary)' }) => (
  <span
    className='d-inline-block rounded-circle align-middle'
    style={{
      width: 9,
      height: 9,
      backgroundColor: color,
      verticalAlign: 'middle',
    }}
  />
)

const InventarioLote = () => {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('todos') // 'todos' | 'RS' | 'Bodega'

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

  // --- Agrupar por lote con totales + items detallados + estado + tipoLote (RS/Bodega)
  const lotes = useMemo(() => {
    const map = new Map()
    for (const it of raw) {
      if (!puedeVerTipo(it?.Tipo)) continue

      const loteId = pickFirstDefined(it?.Id_lote, it?.id_lote) ?? 'Sin Lote'
      const unidad =
        pickFirstDefined(
          it?.Unidad_de_medida,
          it?.Producto?.Unidad_de_medida
        ) ?? ''
      const tipo = String(it?.Tipo || '').trim() // 'RS' | 'Bodega' (lo que venga del BE)

      // Cantidad (prioridad: Inventario -> Cantidad -> Cantidad_Lote)
      const cantidadRaw = pickFirstDefined(
        it?.Cantidad_Inventario,
        it?.Cantidad,
        it?.Cantidad_Lote
      )
      const cantidad = toNumberCO(cantidadRaw)

      // kilos por fila (preferir PesoTotalKg; luego PU; si no, cantidad)
      const pesoTotalFromBE = toNumberCO(it?.PesoTotalKg)
      const pu = toNumberCO(it?.PesoUnitarioKg)

      let kilos = 0
      if (pesoTotalFromBE > 0) kilos = pesoTotalFromBE
      else if (pu > 0) kilos = cantidad * pu
      else kilos = cantidad

      const fila = {
        id_producto: pickFirstDefined(
          it?.Idproducto,
          it?.Id_producto,
          it?.id_producto
        ),
        nombre_producto:
          pickFirstDefined(it?.Nombre_Producto, it?.Producto?.Nombre) ?? '',
        unidad,
        cantidad,
        pesoUnitarioKg: pu > 0 ? pu : null,
        kilos,
        bodega: it?.id_bodega ?? '',
        ubicacion: it?.id_ubicacion ?? '',
        fechaRaw:
          pickFirstDefined(
            it?.Fecha_ultimo_registro,
            it?.Fecha_ultimo_registri
          ) ?? null,
        fecha: pickFirstDefined(
          it?.Fecha_ultimo_registro,
          it?.Fecha_ultimo_registri
        )
          ? new Date(
              pickFirstDefined(
                it?.Fecha_ultimo_registro,
                it?.Fecha_ultimo_registri
              )
            ).toLocaleDateString('es-CO')
          : 'N/A',
      }

      if (!map.has(loteId)) {
        map.set(loteId, {
          loteId,
          items: [],
          totalUnidades: 0,
          totalKilos: 0,
          ultimoIngreso: null,
          anyRS: false,
          anyBodega: false,
        })
      }
      const acc = map.get(loteId)
      acc.items.push(fila)
      if (isUnidad(unidad)) acc.totalUnidades += cantidad
      acc.totalKilos += kilos
      if (tipo === 'RS') acc.anyRS = true
      if (tipo === 'Bodega') acc.anyBodega = true

      if (fila.fechaRaw) {
        const cur = acc.ultimoIngreso ? new Date(acc.ultimoIngreso) : null
        const neu = new Date(fila.fechaRaw)
        if (!cur || neu > cur) acc.ultimoIngreso = fila.fechaRaw
      }
    }

    // Completar: ordenar items y calcular estado/tipo por lote
    for (const v of map.values()) {
      v.items.sort((a, b) =>
        String(a.nombre_producto).localeCompare(String(b.nombre_producto), 'es')
      )
      // Estado del lote
      const totU = toNumberCO(v.totalUnidades)
      const totK = toNumberCO(v.totalKilos)
      const cerrado = totU <= 0 && totK <= 0
      v.estado = cerrado ? 'cerrado' : 'operando'
      v.estadoUi = cerrado
        ? { etiqueta: 'Cerrado', color: 'var(--bs-danger)' }
        : { etiqueta: 'Operando', color: 'var(--bs-warning)' }

      // Tipo del lote (sin mezclas)
      if (v.anyRS && !v.anyBodega) v.tipoLote = 'RS'
      else if (v.anyBodega && !v.anyRS) v.tipoLote = 'Bodega'
      else v.tipoLote = 'Mixto' // si llegara a ocurrir, se excluye al filtrar
    }

    // Orden por lote asc inicialmente
    return Array.from(map.values()).sort((a, b) =>
      String(a.loteId).localeCompare(String(b.loteId), 'es')
    )
  }, [raw, tienePermiso])

  // --- Filtro global + filtro de tipo (RS/Bodega)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const bySearch = l =>
      !q ||
      String(l.loteId).toLowerCase().includes(q) ||
      l.items.some(item =>
        Object.values(item).some(val =>
          String(val ?? '')
            .toLowerCase()
            .includes(q)
        )
      )

    const byTipo =
      tipoFiltro === 'todos' ? () => true : l => l.tipoLote === tipoFiltro // excluye 'Mixto' automáticamente

    return lotes.filter(l => bySearch(l) && byTipo(l))
  }, [lotes, search, tipoFiltro])

  // --- Orden final: operando primero, cerrados abajo
  const filteredSorted = useMemo(() => {
    const rank = e => (e === 'cerrado' ? 1 : 0)
    return [...filtered].sort((a, b) => {
      const r = rank(a.estado) - rank(b.estado)
      if (r !== 0) return r
      return String(a.loteId).localeCompare(String(b.loteId), 'es')
    })
  }, [filtered])

  // --- Totales globales (sobre lo filtrado + ordenado)
  const totalUnidades = useMemo(
    () => filteredSorted.reduce((s, l) => s + toNumberCO(l.totalUnidades), 0),
    [filteredSorted]
  )
  const totalKilos = useMemo(
    () => filteredSorted.reduce((s, l) => s + toNumberCO(l.totalKilos), 0),
    [filteredSorted]
  )

  // --- Exportar Excel (detalle por item)
  const exportar = () => {
    const plano = filteredSorted.flatMap(l =>
      l.items.map(p => ({
        Lote: l.loteId,
        Estado: l.estadoUi.etiqueta,
        Tipo: l.tipoLote,
        Código: p.id_producto,
        Producto: p.nombre_producto,
        Unidad: p.unidad,
        Cantidad: toNumberCO(p.cantidad),
        'Peso unitario (kg)': p.pesoUnitarioKg ?? '',
        Kilos: toNumberCO(p.kilos),
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
      width: '110px',
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
        toNumberCO(r.totalUnidades) > 0 ? (
          <span className='text-end'>
            {numberCO(toNumberCO(r.totalUnidades), 2)}
          </span>
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
          {numberCO(toNumberCO(r.totalKilos), 2)}
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
    {
      name: 'Estado',
      selector: r => r.estado,
      sortable: true,
      width: '140px',
      cell: r => (
        <span className='badge text-bg-light border'>
          <span className='me-1 d-inline-flex align-items-center'>
            <Dot color={r.estadoUi.color} />
          </span>
          {r.estadoUi.etiqueta}
        </span>
      ),
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
      cell: r => (
        <span className='text-end'>{numberCO(toNumberCO(r.cantidad), 2)}</span>
      ),
    },
    {
      name: 'Peso unit. (kg)',
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
      name: 'Kilos',
      selector: r => r.kilos,
      sortable: true,
      right: true,
      width: '140px',
      cell: r => (
        <span className='fw-semibold text-end'>
          {numberCO(toNumberCO(r.kilos), 2)}
        </span>
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

  // --- Estilos DataTable (sin cambios)
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

  // --- SubHeader (buscador + filtro tipo + totales + export)
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

      {/* Filtro RS/Bodega */}
      <div
        className='btn-group btn-group-sm ms-2'
        role='group'
        aria-label='Filtrar tipo'
      >
        <button
          type='button'
          className={`btn ${
            tipoFiltro === 'todos' ? 'btn-dark' : 'btn-outline-dark'
          }`}
          onClick={() => setTipoFiltro('todos')}
          title='Mostrar todos'
        >
          Todos
        </button>
        <button
          type='button'
          className={`btn ${
            tipoFiltro === 'RS' ? 'btn-info' : 'btn-outline-info'
          }`}
          onClick={() => setTipoFiltro('RS')}
          title='Solo RS'
        >
          RS
        </button>
        <button
          type='button'
          className={`btn ${
            tipoFiltro === 'Bodega' ? 'btn-success' : 'btn-outline-success'
          }`}
          onClick={() => setTipoFiltro('Bodega')}
          title='Solo Bodega'
        >
          Bodega
        </button>
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
          disabled={loading || filteredSorted.length === 0}
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
          data={filteredSorted}
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
