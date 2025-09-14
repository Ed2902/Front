// src/components/ControlIngresos/ReporteAsistencia/ReporteResumenPersona.jsx
import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { utils, writeFile } from 'xlsx'
import { getReporteDetalleDiario } from './reporte_asistencia_service'

// ====== Constantes de negocio (jornada objetivo) ======
const HOURS_PER_WEEK = 45 // L–V
const HOURS_PER_DAY = HOURS_PER_WEEK / 5 // 9 h
const MS_PER_HOUR = 60 * 60 * 1000
const TARGET_DAY_MS = HOURS_PER_DAY * MS_PER_HOUR

// ====== Utils ======
const pad2 = n => String(n).padStart(2, '0')
const isWeekend = isoYmd => {
  const [y, m, d] = isoYmd.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  const dow = dt.getDay() // 0=Dom, 6=Sáb
  return dow === 0 || dow === 6
}
const enumerateDatesYMD = (from, to) => {
  if (!from || !to) return []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear()
    const mm = pad2(d.getMonth() + 1)
    const dd = pad2(d.getDate())
    days.push(`${yyyy}-${mm}-${dd}`)
  }
  return days
}
const msToHMS = ms => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total - h * 3600) / 60)
  const s = total - h * 3600 - m * 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}
const msToSignedHM = ms => {
  const neg = ms < 0
  const absMin = Math.floor(Math.abs(ms) / 60000)
  const hh = Math.floor(absMin / 60)
  const mm = absMin % 60
  return `${neg ? '-' : ''}${hh}h${String(mm).padStart(2, '0')}m`
}

const HeaderTwoLines = ({ top, bottom, align = 'left' }) => (
  <div
    className={`d-flex flex-column ${
      align === 'right'
        ? 'text-end'
        : align === 'center'
        ? 'text-center'
        : 'text-start'
    }`}
  >
    <span>{top}</span>
    {bottom ? <small className='text-muted'>{bottom}</small> : null}
  </div>
)

const ReporteResumenPersona = ({ filtros = {} }) => {
  const from = filtros?.from ?? ''
  const to = filtros?.to ?? ''
  const toleranciaRetrasoMin = filtros?.toleranciaRetrasoMin ?? 0

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtros UI
  const [minDiasRetraso, setMinDiasRetraso] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const daily = await getReporteDetalleDiario({
          from,
          to,
          toleranciaRetrasoMin,
        })
        const dailyRows = Array.isArray(daily) ? daily : []

        const workByPersonDay = new Map() // Map<doc, Map<YYYY-MM-DD, workedMs>>
        const totalWorkedByPerson = new Map() // Map<doc, totalMs (incluye S-D)>

        for (const r of dailyRows) {
          const doc = r?.persona?.documento
          if (!doc) continue
          const fecha = r?.fecha
          const workedMs = Number(r?.horasDiaMs) || 0

          if (!workByPersonDay.has(doc)) workByPersonDay.set(doc, new Map())
          workByPersonDay.get(doc).set(fecha, workedMs)
          totalWorkedByPerson.set(
            doc,
            (totalWorkedByPerson.get(doc) || 0) + workedMs
          )
        }

        const allDates = enumerateDatesYMD(from, to)

        const out = []
        for (const [doc, perDay] of workByPersonDay.entries()) {
          // Persona
          let persona = null
          for (const r of dailyRows) {
            if (r?.persona?.documento === doc) {
              persona = r.persona
              break
            }
          }
          if (!persona) continue

          // Contadores L–V (para días con retraso / a tiempo)
          let diasConRetraso = 0
          let diasATiempo = 0

          for (const ymd of allDates) {
            if (isWeekend(ymd)) continue // S–D no cuentan para días
            const workedMs = perDay.get(ymd) || 0 // pero sí para horas totales
            if (workedMs >= TARGET_DAY_MS) diasATiempo += 1
            else diasConRetraso += 1
          }

          const totalWorkedMs = totalWorkedByPerson.get(doc) || 0 // incluye S–D
          // Esperado sólo L–V
          const laborables = allDates.filter(d => !isWeekend(d)).length
          const expectedMs = laborables * TARGET_DAY_MS

          const debeMs = expectedMs - totalWorkedMs // + = debe, - = a favor

          out.push({
            id: doc,
            persona,
            documento: doc,
            nombre: `${persona.nombres} ${persona.apellidos}`.trim(),
            horasTotalesMs: totalWorkedMs,
            horasTotalesHMS: msToHMS(totalWorkedMs),
            debeMs,
            saldoTexto: msToSignedHM(debeMs),
            estadoDebe: debeMs > 0 ? 'Debe' : debeMs < 0 ? 'A favor' : 'Ok',
            diasConRetraso,
            diasATiempo,
          })
        }

        // Orden: más deuda primero
        out.sort((a, b) => b.debeMs - a.debeMs)
        if (!cancelled) setRows(out)
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudo cargar el resumen por persona.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [from, to, toleranciaRetrasoMin])

  // Filtrado (buscador + min días con retraso)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = Number(minDiasRetraso) || 0
    return rows.filter(r => {
      if (min > 0 && (r.diasConRetraso ?? 0) < min) return false
      if (!q) return true
      return (
        r.documento.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q)
      )
    })
  }, [rows, search, minDiasRetraso])

  // Exportar a Excel
  const exportar = () => {
    const wb = utils.book_new()
    const header = [
      ['Resumen por persona'],
      [
        'Jornada objetivo:',
        '45 h (L–V) = 9 h/día. Sáb-Dom no generan retraso; sus horas descuentan adeudo.',
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(header)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        Documento: r.documento,
        Nombre: r.nombre,
        'Horas totales (HH:MM:SS)': r.horasTotalesHMS,
        'Saldo de horas': r.saldoTexto,
        Estado: r.estadoDebe,
        'Días con retraso': r.diasConRetraso,
        'Días A tiempo': r.diasATiempo,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Resumen')
    writeFile(
      wb,
      `Resumen_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  // Columnas DataTable — nombre amplio, numéricas compactas y badges
  const columns = useMemo(
    () => [
      {
        name: 'Documento',
        selector: row => row.documento,
        sortable: true,
        width: '140px',
      },
      {
        name: 'Nombre',
        selector: row => row.nombre,
        sortable: true,
        grow: 6, // 👈 da mucho espacio al nombre
        wrap: true,
      },
      {
        name: <HeaderTwoLines top='Horas totales' bottom='(HH:MM:SS)' />,
        selector: row => row.horasTotalesHMS,
        sortable: true,
        width: '150px',
        cell: row => <span className='text-start'>{row.horasTotalesHMS}</span>,
      },
      {
        name: <HeaderTwoLines top='Saldo de horas' bottom='(±hh:mm)' />,
        sortable: true,
        width: '210px',
        sortFunction: (a, b) => a.debeMs - b.debeMs,
        cell: row => {
          if (row.debeMs > 0) {
            return (
              <div className='d-flex align-items-center'>
                <span className='badge text-bg-danger me-2'>Debe</span>
                <span className='fw-semibold text-danger'>
                  {row.saldoTexto}
                </span>
              </div>
            )
          } else if (row.debeMs < 0) {
            return (
              <div className='d-flex align-items-center'>
                <span className='badge text-bg-success me-2'>A favor</span>
                <span className='fw-semibold text-success'>
                  {row.saldoTexto}
                </span>
              </div>
            )
          }
          return (
            <div className='d-flex align-items-center'>
              <span className='badge text-bg-secondary me-2'>Ok</span>
              <span className='text-secondary'>0h00m</span>
            </div>
          )
        },
      },
      {
        name: <HeaderTwoLines top='Días con retraso' bottom='(L–V)' />,
        selector: row => row.diasConRetraso,
        sortable: true,
        width: '120px', // 👈 compacto
        cell: row => (
          <span
            className={`badge ${
              row.diasConRetraso > 0 ? 'text-bg-danger' : 'text-bg-secondary'
            }`}
          >
            {row.diasConRetraso}
          </span>
        ),
      },
      {
        name: <HeaderTwoLines top='Días A tiempo' bottom='(L–V)' />,
        selector: row => row.diasATiempo,
        sortable: true,
        width: '115px', // 👈 compacto
        cell: row => (
          <span
            className={`badge ${
              row.diasATiempo > 0 ? 'text-bg-success' : 'text-bg-secondary'
            }`}
          >
            {row.diasATiempo}
          </span>
        ),
      },
    ],
    []
  )

  // Estilos DataTable: encabezado multilínea y densidad
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

  // SubHeader con buscador + filtro + export
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100'>
      <div className='input-group' style={{ maxWidth: 320 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Documento o nombre…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='input-group' style={{ width: 200 }}>
        <span className='input-group-text'>Mín. retraso</span>
        <input
          type='number'
          min={0}
          className='form-control'
          value={minDiasRetraso}
          onChange={e => setMinDiasRetraso(e.target.value)}
          placeholder='0'
        />
      </div>

      <div className='ms-auto'>
        <button
          className='btn btn-sm btn-success'
          onClick={exportar}
          disabled={loading || filtered.length === 0}
        >
          Exportar Excel
        </button>
      </div>
    </div>
  )

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Resumen por persona</strong>
          <div className='text-muted small'>
            Jornada objetivo: <strong>45 h L–V (9 h/día)</strong>. Sáb-Dom no
            generan retraso; sus horas se restan del adeudo.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

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

export default ReporteResumenPersona
