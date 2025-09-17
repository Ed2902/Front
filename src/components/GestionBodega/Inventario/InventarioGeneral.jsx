import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import {
  getInventarioCompleto,
  getLotesProductoByProducto,
} from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'

const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const isUnidad = u => (u || '').toLowerCase() === 'unidades'
const isKiloUnit = u => /(kg|kilo)/i.test((u || '').toLowerCase())

const InventarioGeneral = () => {
  const [data, setData] = useState([]) // filas enriquecidas
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtros UI
  const [globalFilter, setGlobalFilter] = useState('')
  const [tiposDisponibles, setTiposDisponibles] = useState(['todos'])
  const [tipoSeleccionado, setTipoSeleccionado] = useState('todos')

  const { tienePermiso } = usePermisos()

  const puedeVerTipo = tipo => {
    if (tipo === 'RS') return tienePermiso('productosRS')
    if (tipo === 'Bodega') return tienePermiso('productosBodega')
    return true
  }

  // ==== Carga base + enriquecimiento con /lote-producto si unidad = "unidades" ====
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const crudo = await getInventarioCompleto()
        const agrupado = agruparPorProducto(crudo)

        // Para los de unidad "unidades": calcular pesoUnitarioProm y pesoTotalKg
        const deUnidades = agrupado.filter(p => isUnidad(p.unidad))

        const pesosMap = new Map() // Map<id_producto, {pesoUnitarioProm, pesoTotalKg}>
        if (deUnidades.length > 0) {
          const jobs = deUnidades.map(async p => {
            try {
              const lotes = await getLotesProductoByProducto(p.id_producto)
              let sumPU = 0
              let countPU = 0
              let totalKg = 0
              for (const it of Array.isArray(lotes) ? lotes : []) {
                const pu = Number(it?.PesoUnitarioKg)
                const cant = Number(it?.Cantidad)
                if (pu > 0) {
                  sumPU += pu
                  countPU += 1
                  if (cant > 0) totalKg += cant * pu
                }
              }
              const prom = countPU > 0 ? sumPU / countPU : 0
              pesosMap.set(p.id_producto, {
                pesoUnitarioProm: prom,
                pesoTotalKg: totalKg,
              })
            } catch (e) {
              console.error('Error /lote-producto', p.id_producto, e)
              pesosMap.set(p.id_producto, {
                pesoUnitarioProm: 0,
                pesoTotalKg: 0,
              })
            }
          })
          await Promise.all(jobs)
        }

        const enriquecido = agrupado.map(p => {
          const pesos = pesosMap.get(p.id_producto)
          return {
            ...p,
            pesoUnitarioKg: isUnidad(p.unidad)
              ? Number(pesos?.pesoUnitarioProm || 0)
              : 0,
            pesoTotalKg: isUnidad(p.unidad)
              ? Number(pesos?.pesoTotalKg || 0)
              : 0,
          }
        })

        const tiposUI = [
          'todos',
          ...Array.from(new Set(enriquecido.map(r => r.tipo).filter(Boolean))),
        ]

        if (!cancelled) {
          setData(enriquecido)
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

  // ==== Agrupar por producto ====
  const agruparPorProducto = rows => {
    const mapa = new Map()
    for (const item of rows || []) {
      const key = item?.id_producto || item?.Producto?.Id_producto
      if (!key) continue
      if (!mapa.has(key)) {
        mapa.set(key, {
          id_producto: item?.Producto?.Id_producto ?? key,
          nombre_producto: item?.Producto?.Nombre ?? '',
          unidad: item?.Producto?.Unidad_de_medida ?? '',
          tipo: item?.Producto?.Tipo ?? '',
          cantidad: 0,
          ultima_fecha: item?.LoteProducto?.Fecha_registro ?? null,
        })
      }
      const acc = mapa.get(key)
      acc.cantidad += Number(item?.Cantidad) || 0

      const nf = item?.LoteProducto?.Fecha_registro
      if (nf) {
        const actual = acc.ultima_fecha ? new Date(acc.ultima_fecha) : null
        const nueva = new Date(nf)
        if (!actual || nueva > actual) acc.ultima_fecha = nf
      }
    }

    return Array.from(mapa.values()).map(it => ({
      ...it,
      cantidad: Number(it.cantidad) || 0,
      ultima_fecha_fmt: it.ultima_fecha
        ? new Date(it.ultima_fecha).toLocaleDateString('es-CO')
        : 'N/A',
    }))
  }

  // ==== Filtrado UI (permisos, tipo, buscador) ====
  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    return data
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
          String(r.tipo).toLowerCase().includes(q)
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, globalFilter, tipoSeleccionado])

  // ==== Totales correctos por tipo de unidad ====
  const totalUnidades = useMemo(
    () =>
      filtered
        .filter(r => isUnidad(r.unidad))
        .reduce((s, r) => s + (Number(r.cantidad) || 0), 0),
    [filtered]
  )

  const totalKilos = useMemo(
    () =>
      filtered.reduce((s, r) => {
        if (isUnidad(r.unidad)) {
          // unidades -> usar kilos calculados desde /lote-producto
          return s + (Number(r.pesoTotalKg) || 0)
        }
        if (isKiloUnit(r.unidad)) {
          // unidad ya es kilo -> sumar cantidad
          return s + (Number(r.cantidad) || 0)
        }
        // otras unidades (m, l, etc.) no suman a kilos
        return s
      }, 0),
    [filtered]
  )

  // ==== Exportar Excel ====
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Inventario General'],
      ['Filtros', `Tipo=${tipoSeleccionado}`, `Buscar="${globalFilter}"`],
      [
        'Totales',
        `Unidades=${totalUnidades}`,
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
        Unidad: r.unidad,
        Tipo: r.tipo,
        'Cantidad Total': r.cantidad,
        'Peso unitario (kg)': Number(r.pesoUnitarioKg) || 0,
        'Medida en kilos (kg)':
          Number(r.pesoTotalKg) ||
          (isKiloUnit(r.unidad) ? Number(r.cantidad) || 0 : 0),
        'Última Entrada': r.ultima_fecha_fmt,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Inventario')
    writeFile(wb, 'InventarioGeneral.xlsx')
  }

  // ==== Columnas DataTable ====
  const columns = useMemo(
    () => [
      {
        name: 'Código',
        selector: r => r.id_producto,
        sortable: true,
        width: '160px',
      },
      {
        name: 'Nombre',
        selector: r => r.nombre_producto,
        sortable: true,
        grow: 3,
        wrap: true,
      },
      {
        name: 'Unidad',
        selector: r => r.unidad,
        sortable: true,
        width: '120px',
      },
      {
        name: 'Cantidad Total',
        selector: r => r.cantidad,
        sortable: true,
        right: true,
        width: '150px',
        cell: r => <span className='text-end'>{numberCO(r.cantidad, 2)}</span>,
      },
      {
        name: 'Peso unitario (kg)',
        selector: r => r.pesoUnitarioKg,
        sortable: true,
        right: true,
        width: '170px',
        cell: r =>
          isUnidad(r.unidad) ? (
            <span className='text-end'>{numberCO(r.pesoUnitarioKg, 2)}</span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        name: 'Medida en kilos (kg)',
        selector: r =>
          isUnidad(r.unidad)
            ? r.pesoTotalKg
            : isKiloUnit(r.unidad)
            ? r.cantidad
            : 0,
        sortable: true,
        right: true,
        width: '190px',
        cell: r => {
          const kg = isUnidad(r.unidad)
            ? r.pesoTotalKg
            : isKiloUnit(r.unidad)
            ? r.cantidad
            : 0
          return kg > 0 ? (
            <span className='fw-semibold text-end'>{numberCO(kg, 2)}</span>
          ) : (
            <span className='text-muted'>—</span>
          )
        },
      },
      {
        name: 'Última Entrada',
        selector: r => r.ultima_fecha_fmt,
        sortable: true,
        width: '150px',
      },
    ],
    []
  )

  // Estilos DataTable (coinciden con tus otras tablas)
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

  // SubHeader (buscador, tipos, totales, export)
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 320 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Código, nombre, unidad o tipo…'
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
          <strong>Inventario General</strong>
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
