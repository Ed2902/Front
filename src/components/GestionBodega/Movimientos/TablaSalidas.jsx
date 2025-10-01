import { useEffect, useMemo, useState, useCallback } from 'react'
import { Table, Tooltip } from 'antd'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getDocumentosSalida } from './service.TablaSalidas'
import SecureArchivosalidas from './SecureArchivosalidas'

// Helpers de formato
const numberCO = (n, d = 0) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const TablaSalidas = () => {
  // Datos/paginación
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Estado de la tabla (paginación server-side)
  const [pageSize, setPageSize] = useState(20)
  const [current, setCurrent] = useState(1)

  // Filtro global simple
  const [globalFilter, setGlobalFilter] = useState('')

  const fetchPage = useCallback(async ({ limit, offset }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDocumentosSalida(limit, offset)
      setRows(res.rows || [])
      setTotal(res.total || 0)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar la lista de salidas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const limit = pageSize
    const offset = (current - 1) * pageSize
    fetchPage({ limit, offset })
  }, [current, pageSize, fetchPage])

  // Filtrado client-side (sobre la página actual)
  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const lotesTxt = (r.lotes || []).join(' ').toLowerCase()
      const prodsTxt = (r.productos || [])
        .map(p => `${p.id_producto} ${p.nombre} ${p.cantidad}`)
        .join(' ')
        .toLowerCase()
      return (
        String(r.fecha_creacion || '')
          .toLowerCase()
          .includes(q) ||
        String(r.titulo || '')
          .toLowerCase()
          .includes(q) ||
        String(r.comentario || '')
          .toLowerCase()
          .includes(q) ||
        lotesTxt.includes(q) ||
        prodsTxt.includes(q)
      )
    })
  }, [rows, globalFilter])

  // Columnas Antd
  const columns = useMemo(() => {
    const strSort = (a, b, k) =>
      String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'es', {
        numeric: true,
        sensitivity: 'base',
      })

    return [
      {
        title: 'Fecha creación',
        dataIndex: 'fecha_creacion',
        key: 'fecha_creacion',
        width: 180,
        sorter: (a, b) => strSort(a, b, 'fecha_creacion'),
      },
      {
        title: 'Lotes',
        dataIndex: 'lotes',
        key: 'lotes',
        width: 220,
        render: lotes =>
          Array.isArray(lotes) && lotes.length > 0 ? (
            <div className='d-flex flex-wrap gap-1'>
              {lotes.map(l => (
                <span key={l} className='badge text-bg-light border' title={l}>
                  {l}
                </span>
              ))}
            </div>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'Productos (cantidad)',
        dataIndex: 'productos',
        key: 'productos',
        width: 420,
        render: productos =>
          Array.isArray(productos) && productos.length > 0 ? (
            <div className='d-flex flex-wrap gap-2'>
              {productos.map(p => (
                <span
                  key={p.id_producto}
                  className='badge rounded-pill text-bg-secondary'
                  title={`${p.nombre} · ${p.id_producto}`}
                >
                  {p.id_producto} ({numberCO(p.cantidad, 0)})
                </span>
              ))}
            </div>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'Comentario',
        dataIndex: 'comentario',
        key: 'comentario',
        ellipsis: true,
        render: v =>
          v ? (
            <span title={v}>{v}</span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
      {
        title: 'PDF',
        dataIndex: 'pdf_url',
        key: 'pdf_url',
        width: 110,
        align: 'center',
        render: url =>
          url ? (
            <SecureArchivosalidas
              src={url}
              mode='open' // 'download' si quieres descarga directa
              title='Ver PDF de salida'
              aria-label='Ver PDF de salida'
              className='px-2 py-1'
            />
          ) : (
            <Tooltip title='Sin PDF disponible'>
              <span className='text-muted'>—</span>
            </Tooltip>
          ),
      },
    ]
  }, [])

  // Exportar Excel (usa el filtrado actual de la página cargada)
  const exportar = () => {
    const wb = utils.book_new()
    const head = [
      ['Salidas (documentos)'],
      ['Filtros', `Buscar="${globalFilter}"`],
      [],
    ]
    const sheet = utils.aoa_to_sheet(head)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        'Fecha creación': r.fecha_creacion || '',
        Título: r.titulo || '',
        Comentario: r.comentario || '',
        Lotes: (r.lotes || []).join(', '),
        'Productos (cantidades)': (r.productos || [])
          .map(p => `${p.id_producto} (${p.cantidad})`)
          .join(', '),
        PDF: r.pdf_url || '',
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Salidas')
    writeFile(wb, 'Salidas.xlsx')
  }

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Ver Salidas</strong>
          <div className='small text-muted'>
            Documentos de salida (lista por documento)
          </div>
        </div>

        <div className='d-flex flex-wrap gap-2 align-items-center'>
          <div className='input-group' style={{ maxWidth: 360 }}>
            <span className='input-group-text'>Buscar</span>
            <input
              type='text'
              className='form-control'
              placeholder='Fecha, lote, producto, comentario…'
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
            />
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

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        <Table
          columns={columns}
          dataSource={filtered.map((r, i) => ({ key: i, ...r }))}
          loading={loading}
          scroll={{ x: 'max-content', y: 520 }}
          sticky
          size='middle'
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 30, 50, 100],
            onChange: (page, size) => {
              setCurrent(page)
              setPageSize(size)
            },
          }}
        />
      </div>
    </div>
  )
}

export default TablaSalidas
