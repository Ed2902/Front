import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { utils, writeFile } from 'xlsx'
import {
  getReporteDetalleDiario,
  fetchHorariosPorPersona,
  msToHMS,
} from './reporte_asistencia_service'

// ===== Constantes de negocio =====
const MS_PER_HOUR = 60 * 60 * 1000
const DEFAULT_JORNADA_HORAS = 9 // jornada estándar

// Conversión ms → texto ±hh:mm
const msToSignedHM = ms => {
  const neg = ms < 0
  const absMin = Math.floor(Math.abs(ms) / 60000)
  const hh = Math.floor(absMin / 60)
  const mm = absMin % 60
  return `${neg ? '-' : ''}${hh}h${String(mm).padStart(2, '0')}m`
}

// ===== Helpers de tiempo (sin variables sin usar) =====
const atTimeStr = (baseDateISO, hhmm) => {
  const d = new Date(baseDateISO)
  const [h, m] = String(hhmm || '')
    .split(':')
    .map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}
const overlapMs = (aStart, aEnd, bStart, bEnd) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))

const pickISO = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k]
    if (v) return v
  }
  return null
}

// === Cálculo de horas trabajadas (sin capar) con almuerzo inteligente ===
const computeWorkedMs = r => {
  // Campos posibles según backend (amplio para ser tolerante)
  const entradaISO = pickISO(r, [
    'entradaISO',
    'entrada',
    'inISO',
    'in',
    'primeraEntradaISO',
    'firstEntradaISO',
  ])
  const salidaISO = pickISO(r, [
    'salidaISO',
    'salida',
    'outISO',
    'out',
    'ultimaSalidaISO',
    'lastSalidaISO',
  ])
  const onAlmISO = pickISO(r, [
    'onAlmuerzoISO',
    'onAlmuerzo',
    'almuerzoInicioISO',
    'almuerzoInISO',
  ])
  const offAlmISO = pickISO(r, [
    'offAlmuerzoISO',
    'offAlmuerzo',
    'almuerzoFinISO',
    'almuerzoOutISO',
  ])

  if (!entradaISO || !salidaISO) return 0

  const tIn = new Date(entradaISO)
  const tOut = new Date(salidaISO)
  if (
    !(tIn instanceof Date) ||
    isNaN(tIn) ||
    !(tOut instanceof Date) ||
    isNaN(tOut)
  )
    return 0
  if (tOut <= tIn) return 0

  // Día laborable segun estado del daily
  const estado = r?.estado
  const esLaborable = !['FESTIVO', 'FIN_DE_SEMANA'].includes(estado)

  // Base para ubicar 12:00–14:00 (la fecha de entrada, para simplificar)
  const baseISO = entradaISO

  // Almuerzo
  let lunchMs = 0
  if (esLaborable) {
    if (onAlmISO && offAlmISO) {
      // Descuento real si hay marcas
      const ai = new Date(onAlmISO)
      const af = new Date(offAlmISO)
      if (ai < af) lunchMs = Math.max(0, af - ai)
    } else if (baseISO) {
      // Sin marcas: solo si hay solape con 12:00–14:00 y la entrada es antes de las 14:00
      const lunchStart = atTimeStr(baseISO, '12:00')
      const lunchEnd = atTimeStr(baseISO, '14:00')
      const solape = overlapMs(
        tIn.getTime(),
        tOut.getTime(),
        lunchStart.getTime(),
        lunchEnd.getTime()
      )

      if (tIn.getTime() < lunchEnd.getTime() && solape > 0) {
        lunchMs = Math.min(MS_PER_HOUR, solape) // máx 1h
      }
    }
  }

  return Math.max(0, tOut - tIn - lunchMs)
}

const ReporteConsolidadoGeneral = ({ filtros = {} }) => {
  const from = filtros?.from ?? ''
  const to = filtros?.to ?? ''
  const toleranciaRetrasoMin = filtros?.toleranciaRetrasoMin ?? 0

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancel = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        // --- Datos base del mes completo ---
        const daily = await getReporteDetalleDiario({ from, to })
        const horariosMap = await fetchHorariosPorPersona()

        const personas = new Map() // doc → datos acumulados

        const isJustificada = r =>
          !!(
            r?.justEntrada?.texto ||
            r?.justSalida?.texto ||
            r?.justEntrada?.imagen_url ||
            r?.justSalida?.imagen_url ||
            r?.aprobadoEntrada ||
            r?.aprobadoSalida
          )

        for (const r of daily) {
          const doc = r?.persona?.documento
          if (!doc) continue

          if (!personas.has(doc)) {
            personas.set(doc, {
              persona: r.persona,
              documento: doc,
              nombre: `${r.persona?.nombres ?? ''} ${
                r.persona?.apellidos ?? ''
              }`.trim(),
              horasTotalesMs: 0,
              diasLaborables: 0,
              justificaciones: 0,
              retardosSinJustificar: 0,
              ausencias: 0,
              salidasAntes: 0,
            })
          }

          const p = personas.get(doc)

          // ⬇️ APLICAMOS LA LÓGICA NUEVA AQUÍ
          const workedMs = (() => {
            // Si confías en r.horasDiaMs, comenta la siguiente línea y usa r.horasDiaMs:
            const ms = computeWorkedMs(r)
            return Number.isFinite(ms) ? ms : 0
          })()

          const estado = r?.estado
          const esLaborable = !['FESTIVO', 'FIN_DE_SEMANA'].includes(estado)

          // Contar solo días laborales (no fines ni festivos)
          if (esLaborable) p.diasLaborables += 1

          // Acumular horas trabajadas (incluye horas extra)
          p.horasTotalesMs += workedMs

          // Contar justificaciones
          if (isJustificada(r)) p.justificaciones += 1

          // Retardo sin justificar
          if (
            esLaborable &&
            r.retrasoMin > toleranciaRetrasoMin &&
            !isJustificada(r)
          ) {
            p.retardosSinJustificar += 1
          }

          // Ausencia sin justificar = debe jornada completa
          if (estado === 'AUSENTE' && esLaborable && !isJustificada(r)) {
            p.ausencias += 1
          }

          // Salida antes sin justificar
          if (r.salidaAntesMin > 0 && esLaborable && !isJustificada(r)) {
            p.salidasAntes += 1
          }
        }

        // --- Cálculo de horas esperadas y saldo ---
        const out = []
        for (const [doc, info] of personas.entries()) {
          const horario = horariosMap.get(doc)
          let jornadaHoras = DEFAULT_JORNADA_HORAS

          if (horario?.entrada && horario?.salida) {
            const [hIn, mIn] = horario.entrada.split(':').map(Number)
            const [hOut, mOut] = horario.salida.split(':').map(Number)

            // 🔧 Duración neta de la jornada restando 1h de almuerzo
            const diffH = hOut + mOut / 60 - (hIn + mIn / 60) - 1
            jornadaHoras = diffH > 0 ? diffH : DEFAULT_JORNADA_HORAS
          }

          const jornadaMs = jornadaHoras * MS_PER_HOUR

          // ✅ Horas esperadas: por cada día laborable
          const expectedMs = info.diasLaborables * jornadaMs

          // ✅ Saldo = trabajadas - esperadas (extra suma)
          const saldoMs = info.horasTotalesMs - expectedMs

          const estado = saldoMs < 0 ? 'Debe' : saldoMs > 0 ? 'A favor' : 'Ok'

          out.push({
            ...info,
            horasTotalesHMS: msToHMS(info.horasTotalesMs),
            saldoMs,
            saldoTexto: msToSignedHM(saldoMs),
            estado,
          })
        }

        // --- Resumen global ---
        const total = out.length
        const totalJust = out.reduce((s, r) => s + r.justificaciones, 0)
        const totalRetardos = out.reduce(
          (s, r) => s + r.retardosSinJustificar,
          0
        )
        const totalAusencias = out.reduce((s, r) => s + r.ausencias, 0)
        const totalAFavor = out.filter(r => r.estado === 'A favor').length
        const totalDebe = out.filter(r => r.estado === 'Debe').length
        const promHoras =
          out.length > 0
            ? out.reduce((s, r) => s + r.horasTotalesMs, 0) / out.length
            : 0

        const resumenGlobal = {
          total,
          totalJust,
          totalRetardos,
          totalAusencias,
          totalAFavor,
          totalDebe,
          promHorasTexto: msToHMS(promHoras),
        }

        if (!cancel) {
          setRows(out.sort((a, b) => b.saldoMs - a.saldoMs))
          setResumen(resumenGlobal)
        }
      } catch (err) {
        console.error(err)
        if (!cancel) setError('No se pudo generar el consolidado.')
      } finally {
        if (!cancel) setLoading(false)
      }
    }

    load()
    return () => {
      cancel = true
    }
  }, [from, to, toleranciaRetrasoMin])

  // --- Filtrado buscador ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      r =>
        r.documento.toLowerCase().includes(q) ||
        r.nombre.toLowerCase().includes(q)
    )
  }, [rows, search])

  // --- Exportar Excel ---
  const exportar = () => {
    const wb = utils.book_new()
    const header = [
      ['Consolidado general de asistencia'],
      [
        'Incluye todos los días del rango, considera festivos, fines de semana y ausencias como días de deuda.',
      ],
      [],
    ]
    const sheet = utils.aoa_to_sheet(header)
    utils.sheet_add_json(
      sheet,
      filtered.map(r => ({
        Documento: r.documento,
        Nombre: r.nombre,
        'Horas Totales': r.horasTotalesHMS,
        'Saldo Horas': r.saldoTexto,
        Estado: r.estado,
        Justificaciones: r.justificaciones,
        'Retardos sin justificar': r.retardosSinJustificar,
        Ausencias: r.ausencias,
        'Salidas antes': r.salidasAntes,
      })),
      { origin: -1 }
    )
    utils.book_append_sheet(wb, sheet, 'Consolidado')
    writeFile(
      wb,
      `Consolidado_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  // --- Columnas tabla ---
  const columns = useMemo(
    () => [
      {
        name: 'Documento',
        selector: r => r.documento,
        sortable: true,
        width: '140px',
      },
      { name: 'Nombre', selector: r => r.nombre, sortable: true, grow: 3 },
      {
        name: 'Horas totales',
        selector: r => r.horasTotalesHMS,
        sortable: true,
        width: '140px',
      },
      {
        name: 'Saldo',
        selector: r => r.saldoTexto,
        sortable: true,
        width: '140px',
        cell: row => (
          <span
            className={`fw-semibold ${
              row.estado === 'A favor'
                ? 'text-success'
                : row.estado === 'Debe'
                ? 'text-danger'
                : 'text-secondary'
            }`}
          >
            {row.saldoTexto}
          </span>
        ),
      },
      {
        name: 'Justificaciones',
        selector: r => r.justificaciones,
        sortable: true,
        width: '130px',
        cell: r => (
          <span
            className={`badge ${
              r.justificaciones > 0 ? 'text-bg-primary' : 'text-bg-secondary'
            }`}
          >
            {r.justificaciones}
          </span>
        ),
      },
      {
        name: 'Retardos sin justificar',
        selector: r => r.retardosSinJustificar,
        sortable: true,
        width: '150px',
        cell: r => (
          <span
            className={`badge ${
              r.retardosSinJustificar > 0
                ? 'text-bg-danger'
                : 'text-bg-secondary'
            }`}
          >
            {r.retardosSinJustificar}
          </span>
        ),
      },
      {
        name: 'Ausencias',
        selector: r => r.ausencias,
        sortable: true,
        width: '110px',
        cell: r => (
          <span
            className={`badge ${
              r.ausencias > 0 ? 'text-bg-warning' : 'text-bg-secondary'
            }`}
          >
            {r.ausencias}
          </span>
        ),
      },
      {
        name: 'Estado',
        selector: r => r.estado,
        sortable: true,
        width: '110px',
        cell: r => (
          <span
            className={`badge ${
              r.estado === 'A favor'
                ? 'text-bg-success'
                : r.estado === 'Debe'
                ? 'text-bg-danger'
                : 'text-bg-secondary'
            }`}
          >
            {r.estado}
          </span>
        ),
      },
    ],
    []
  )

  // --- Estilos compactos ---
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

  // --- SubHeader ---
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

  // --- Render ---
  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Consolidado general de asistencia</strong>
          <div className='text-muted small'>
            Incluye todo el mes: considera festivos, fines de semana y ausencias
            como días de deuda.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

        {/* === Resumen global === */}
        {resumen && (
          <div className='alert alert-info py-2 mb-3'>
            <div className='d-flex flex-wrap gap-3 small'>
              <span>
                <strong>Total empleados:</strong> {resumen.total}
              </span>
              <span>
                <strong>A favor:</strong> {resumen.totalAFavor}
              </span>
              <span>
                <strong>Debe:</strong> {resumen.totalDebe}
              </span>
              <span>
                <strong>Justificaciones:</strong> {resumen.totalJust}
              </span>
              <span>
                <strong>Retardos sin justificar:</strong>{' '}
                {resumen.totalRetardos}
              </span>
              <span>
                <strong>Ausencias:</strong> {resumen.totalAusencias}
              </span>
              <span>
                <strong>Promedio horas trabajadas:</strong>{' '}
                {resumen.promHorasTexto}
              </span>
            </div>
          </div>
        )}

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

export default ReporteConsolidadoGeneral
