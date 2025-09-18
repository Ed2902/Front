/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioCompleto } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'

const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

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

  // Agrupar por tercero (Cliente o Proveedor) y calcular volúmenes
  const terceros = useMemo(() => {
    const map = new Map()

    for (const it of raw) {
      const tipo = it?.Producto?.Tipo
      if (!puedeVerTipo(tipo)) continue

      const cantidad = Number(it?.Cantidad) || 0
      if (cantidad <= 0) continue

      // Nombre del tercero (cliente o proveedor)
      const tercero =
        it?.LoteProducto?.Cliente?.Nombre ||
        it?.LoteProducto?.Proveedor?.Nombre ||
        'Desconocido'

      // Volumen: (Alto * Ancho * Largo) / 1_000_000 => m³
      const alto = Number(it?.Producto?.Alto) || 0
      const ancho = Number(it?.Producto?.Ancho) || 0
      const largo = Number(it?.Producto?.Largo) || 0
      const volumenUnitarioM3 = (alto * ancho * largo) / 1_000_000
      const volumenTotalM3 = volumenUnitarioM3 * cantidad
      const volumenTotalCm3 = volumenTotalM3 * 1_000_000

      const detalle = {
        id_producto: it?.Producto?.Id_producto || it?.id_producto,
        nombre_producto: it?.Producto?.Nombre || 'Desconocido',
        unidad: it?.Producto?.Unidad_de_medida || '',
        cantidad,
        volumen_m3: volumenTotalM3,
        volumen_cm3: volumenTotalCm3,
        bodega: it?.Bodega?.nombre || it?.id_bodega || '',
        ubicacion: it?.UbicacionBodega?.nombre || it?.id_ubicacion || '',
        fechaRaw: it?.Fecha_ultimo_registri || null,
        fecha: it?.Fecha_ultimo_registri
          ? new Date(it.Fecha_ultimo_registri).toLocaleDateString('es-CO')
          : 'N/A',
      }

      if (!map.has(tercero)) {
        map.set(tercero, {
          tercero,
          items: [],
          totalVolumenM3: 0,
          totalVolumenCm3: 0,
          totalCantidad: 0,
          ultimoIngreso: null,
        })
      }
      const acc = map.get(tercero)
      acc.items.push(detalle)
      acc.totalVolumenM3 += volumenTotalM3
      acc.totalVolumenCm3 += volumenTotalCm3
      acc.totalCantidad += cantidad

      if (detalle.fechaRaw) {
        const cur = acc.ultimoIngreso ? new Date(acc.ultimoIngreso) : null
        const neu = new Date(detalle.fechaRaw)
        if (!cur || neu > cur) acc.ultimoIngreso = detalle.fechaRaw
      }
    }

    // Ordenar items por nombre de producto
    for (const v of map.values()) {
      v.items.sort((a, b) =>
        String(a.nombre_producto).localeCompare(String(b.nombre_producto), 'es')
      )
    }

    // Salida ordenada por nombre de tercero
    return Array.from(map.values()).sort((a, b) =>
      String(a.tercero).localeCompare(String(b.tercero), 'es')
    )
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

  // Totales globales (sobre lo filtrado)
  const totalCantidadGlobal = useMemo(
    () => filtered.reduce((s, t) => s + (Number(t.totalCantidad) || 0), 0),
    [filtered]
  )
  const totalVolumenM3Global = useMemo(
    () => filtered.reduce((s, t) => s + (Number(t.totalVolumenM3) || 0), 0),
    [filtered]
  )

  // Export a Excel (detalle por ítem)
  const exportar = () => {
    const plano = filtered.flatMap(t =>
      t.items.map(p => ({
        Tercero: t.tercero,
        Código: p.id_producto,
        Producto: p.nombre_producto,
        Unidad: p.unidad,
        Cantidad: p.cantidad,
        'Volumen (m³)': Number(p.volumen_m3 || 0),
        'Volumen (cm³)': Math.round(Number(p.volumen_cm3 || 0)),
        Bodega: p.bodega,
        Ubicación: p.ubicacion,
        'Último ingreso': p.fecha,
      }))
    )

    const wb = utils.book_new()
    const head = [
      ['Inventario por Tercero (Cliente/Proveedor)'],
      [
        'Totales filtrados',
        `Cantidad=${numberCO(totalCantidadGlobal, 2)}`,
        `Volumen m³=${numberCO(totalVolumenM3Global, 5)}`,
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(sheet, plano, { origin: -1 })
    utils.book_append_sheet(wb, sheet, 'Por Tercero')
    writeFile(wb, 'InventarioPorTercero.xlsx')
  }

  // Columnas tabla padre (terceros)
  const parentColumns = [
    {
      name: 'Tercero',
      selector: r => r.tercero,
      sortable: true,
      grow: 6,
      minWidth: '380px',
      wrap: false,
    },
    {
      name: 'Registros',
      selector: r => r.items?.length || 0,
      sortable: true,
      right: true,
      width: '120px',
    },
    {
      name: 'Cantidad Total',
      selector: r => r.totalCantidad,
      sortable: true,
      right: true,
      width: '150px',
      cell: r => (
        <span className='text-end'>{numberCO(r.totalCantidad, 2)}</span>
      ),
    },
    {
      name: 'Volumen Total (m³)',
      selector: r => r.totalVolumenM3,
      sortable: true,
      right: true,
      width: '180px',
      cell: r => (
        <span className='fw-semibold text-end'>
          {numberCO(r.totalVolumenM3, 5)}
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

  // Columnas tabla hija (detalle)
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
      name: 'Volumen (m³)',
      selector: r => r.volumen_m3,
      sortable: true,
      right: true,
      width: '160px',
      cell: r => <span className='text-end'>{numberCO(r.volumen_m3, 5)}</span>,
    },
    {
      name: 'Volumen (cm³)',
      selector: r => r.volumen_cm3,
      sortable: true,
      right: true,
      width: '160px',
      cell: r => (
        <span className='text-end'>
          {Number(r.volumen_cm3 || 0).toLocaleString('es-CO')}
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
            Agrupa por Cliente o Proveedor y calcula volumen total ocupado.
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

export default InventarioPorTercero
