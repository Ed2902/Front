// src/components/ControlIngresos/Marcacion/TablaMarcaciones.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
} from 'react'
import DataTable from 'react-data-table-component'
import Holidays from 'date-holidays'
import AuthContext from '../../../context/AuthContext'

import { msToHMS } from '../ReporteAsistencia/reporte_asistencia_service'
import {
  getMarcacionHistorialDelUsuarioActual as getMarcacionesUsuario,
  getMiHorarioDesdeToken,
  getHorarioDe,
} from './Marcacion_service'

import ModalJustificar from './ModalJustificar'
import ModalActualizarFecha from './ModalActualizarFecha'

// ===== Utils =====
const LUNCH_MS_DEFAULT = 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000
const pad2 = n => String(n).padStart(2, '0')
const normDoc = v => String(v || '').replace(/[^\d]/g, '')
const fmtHM = iso =>
  !iso
    ? '—'
    : (() => {
        const d = new Date(iso)
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      })()
const fmtDate = d =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
const getDayKey = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const atTimeStr = (baseDate, hhmm) => {
  const d = new Date(baseDate)
  const [h, m] = String(hhmm || '')
    .split(':')
    .map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}
const endOfDay = d =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const startOfDay = d =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const mins = ms => Math.floor(Math.max(0, ms) / 60000)
const isAlreadyUpdated = r => {
  if (!r) return false
  const a = r?.creado_en ? new Date(r.creado_en).getTime() : null
  const b = r?.fecha_hora ? new Date(r.fecha_hora).getTime() : null
  return (
    a != null && b != null && Math.floor(a / 60000) !== Math.floor(b / 60000)
  )
}

// Documento desde contexto/JWT
const getDocumentoSesion = ctxUser => {
  const docCtx =
    ctxUser?.documento ||
    ctxUser?.doc ||
    ctxUser?.personal?.id_personal ||
    ctxUser?.user?.personal?.id_personal
  if (docCtx) return normDoc(docCtx)

  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      ''
    if (token && token.split('.').length === 3) {
      const payload = JSON.parse(atob(token.split('.')[1] || ''))
      const doc =
        payload?.personal?.documento ??
        payload?.documento ??
        payload?.id_personal ??
        payload?.personal?.id_personal
      if (doc) return normDoc(doc)
    }
  } catch {
    /* empty */
  }
  return ''
}

const TablaMarcaciones = ({
  from: fromProp = '',
  to: toProp = '',
  reloadKey = 0, // ← para refrescar desde el padre
}) => {
  const { user } = useContext(AuthContext) || {}
  const documentoUsuario = getDocumentoSesion(user)

  const [rowsRaw, setRowsRaw] = useState([])
  const [horario, setHorario] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [range, setRange] = useState({ from: null, to: null })

  // Modales
  const [justModal, setJustModal] = useState({ row: null, mode: 'view' }) // 'view' | 'edit'
  const [openUpd, setOpenUpd] = useState(false)
  const [rowUpd, setRowUpd] = useState(null)

  // Festivos / fines de semana (Colombia)
  const hd = useMemo(() => new Holidays('CO'), [])
  const isWeekend = useCallback(d => d.getDay() === 0 || d.getDay() === 6, [])
  const isHoliday = useCallback(
    d => !!hd.isHoliday(new Date(d.getFullYear(), d.getMonth(), d.getDate())),
    [hd]
  )

  // --- CARGA/RECARGA ---
  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hist = await getMarcacionesUsuario()
      const arr = (Array.isArray(hist) ? hist : []).filter(
        it => normDoc(it?.personal?.documento) === documentoUsuario
      )
      const normalized = arr.map(r => ({
        ...r,
        tipo: String(r.tipo || '').toLowerCase(),
        efectiva: r.creado_en || r.fecha_hora,
        evidencia_url:
          r.evidencia_url ||
          r.evidenciaUrl ||
          (r.evidencia ? `/app/marcacion/${r.id}/evidencia` : null),
      }))
      setRowsRaw(
        normalized.sort((a, b) => new Date(a.efectiva) - new Date(b.efectiva))
      )

      let hor = await getMiHorarioDesdeToken().catch(() => null)
      if (!hor && normalized.length && normalized[0]?.personal?.documento) {
        hor = await getHorarioDe(normalized[0].personal.documento).catch(
          () => null
        )
      }
      if (!hor) hor = { entrada: '07:45', salida: '17:30' }
      setHorario(hor)

      // Rango base
      if (fromProp && toProp) {
        const from = startOfDay(new Date(fromProp))
        const to = endOfDay(new Date(toProp))
        setRange({ from, to })
      } else {
        const today = new Date()
        const first = new Date(today.getFullYear(), today.getMonth(), 1)
        const to = endOfDay(today) // cortar en HOY (no futuros)
        setRange({ from: startOfDay(first), to })
      }
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar tu historial.')
    } finally {
      setLoading(false)
    }
  }, [documentoUsuario, fromProp, toProp])

  // Carga inicial
  useEffect(() => {
    if (documentoUsuario) load()
    else setError('No se pudo determinar el documento del usuario.')
  }, [documentoUsuario, load])

  // Recarga cuando el padre cambie reloadKey
  useEffect(() => {
    if (documentoUsuario) load()
  }, [reloadKey, documentoUsuario, load])

  // Días del rango (capados a HOY)
  const daysInRange = useMemo(() => {
    if (!range.from || !range.to) return []
    const today = endOfDay(new Date())
    const effectiveEnd = range.to > today ? today : range.to
    const out = []
    for (
      let d = new Date(range.from);
      d <= effectiveEnd;
      d.setDate(d.getDate() + 1)
    ) {
      out.push(new Date(d))
    }
    return out
  }, [range])

  // Consolidación por día (primera entrada, última salida, etc.)
  const rowsByDay = useMemo(() => {
    if (!daysInRange.length) return []

    const map = new Map()
    for (const d of daysInRange) {
      map.set(getDayKey(d), {
        fecha: new Date(d),
        estado: '',
        entrada: null,
        salida: null,
        onAlmuerzo: null,
        offAlmuerzo: null,
        justificaciones: 0,
        horasTrabajadas: 0,
        jornadaEsperada: 0,
        saldo: 0,
        detalle: [],
      })
    }

    const todayEnd = endOfDay(new Date())
    const inRange = rowsRaw.filter(
      r => r.efectiva && new Date(r.efectiva) <= todayEnd
    )

    for (const r of inRange) {
      const key = getDayKey(new Date(r.efectiva))
      if (!map.has(key)) continue
      const day = map.get(key)
      day.detalle.push(r)

      // Asignaciones robustas:
      if (r.tipo === 'entrada') {
        if (
          !day.entrada ||
          new Date(r.efectiva) < new Date(day.entrada.efectiva)
        ) {
          day.entrada = r // primera entrada del día
        }
      }
      if (r.tipo === 'salida') {
        if (
          !day.salida ||
          new Date(r.efectiva) > new Date(day.salida.efectiva)
        ) {
          day.salida = r // última salida del día
        }
      }
      if (r.tipo === 'on_almuerzo') {
        if (
          !day.onAlmuerzo ||
          new Date(r.efectiva) < new Date(day.onAlmuerzo.efectiva)
        ) {
          day.onAlmuerzo = r // primera salida a almuerzo
        }
      }
      if (r.tipo === 'off_almuerzo') {
        if (
          !day.offAlmuerzo ||
          new Date(r.efectiva) > new Date(day.offAlmuerzo.efectiva)
        ) {
          day.offAlmuerzo = r // último regreso de almuerzo
        }
      }

      if (r.justificacion || r.observacion || r.evidencia_url)
        day.justificaciones++
    }

    for (const day of map.values()) {
      const d = day.fecha
      const weekend = isWeekend(d)
      const holiday = isHoliday(d)

      const entH = horario?.entrada || '07:45'
      const salH = horario?.salida || '17:30'

      // Jornada esperada solo en días hábiles (horario - 1h almuerzo por defecto)
      if (!weekend && !holiday) {
        const [hIn, mIn] = entH.split(':').map(Number)
        const [hOut, mOut] = salH.split(':').map(Number)
        day.jornadaEsperada = Math.max(
          0,
          (hOut + mOut / 60 - (hIn + mIn / 60)) * MS_PER_HOUR - LUNCH_MS_DEFAULT
        )
      } else {
        day.jornadaEsperada = 0
      }

      // Cálculo de horas trabajadas reales (SIN capar contra horario)
      const inISO = day.entrada?.efectiva
      const outISO = day.salida?.efectiva
      if (inISO && outISO) {
        const tIn = new Date(inISO)
        const tOut = new Date(outISO)

        let lunchMs = 0
        if (!weekend && !holiday) {
          if (day.onAlmuerzo && day.offAlmuerzo) {
            // ▼ Descuento real si hay marcas
            const ai = new Date(day.onAlmuerzo.efectiva)
            const af = new Date(day.offAlmuerzo.efectiva)
            lunchMs = Math.max(0, af - ai)
          } else {
            // ▼ Sin marcas: solo si hay solape con 12:00–14:00 y la entrada es antes de las 14:00
            const lunchStart = atTimeStr(d, '12:00')
            const lunchEnd = atTimeStr(d, '14:00')

            const overlap = Math.max(
              0,
              Math.min(tOut.getTime(), lunchEnd.getTime()) -
                Math.max(tIn.getTime(), lunchStart.getTime())
            )

            // Reglas:
            // - Si la entrada es >= 14:00 → NO asumir almuerzo
            // - Si overlap > 0 y entrada < 14:00 → descontar hasta 1h máx
            if (tIn.getTime() < lunchEnd.getTime() && overlap > 0) {
              lunchMs = Math.min(LUNCH_MS_DEFAULT, overlap)
            } else {
              lunchMs = 0
            }
          }
        }

        const worked = Math.max(0, tOut - tIn - lunchMs)
        day.horasTrabajadas = worked
        day.saldo = day.horasTrabajadas - day.jornadaEsperada
      } else {
        day.horasTrabajadas = 0
        day.saldo = -day.jornadaEsperada
      }

      // Estado visual del día
      if (holiday) day.estado = 'FESTIVO'
      else if (weekend) day.estado = 'FIN_DE_SEMANA'
      else if (!day.entrada?.efectiva && !day.salida?.efectiva)
        day.estado = 'AUSENTE'
      else if (!day.entrada?.efectiva || !day.salida?.efectiva)
        day.estado = 'INCOMPLETO'
      else day.estado = day.saldo < 0 ? 'DEBE' : 'OK'
    }

    return Array.from(map.values()).sort((a, b) => b.fecha - a.fecha)
  }, [daysInRange, rowsRaw, horario, isWeekend, isHoliday])

  // Resumen mensual (hasta HOY)
  const resumenMensual = useMemo(() => {
    if (!rowsByDay.length) return null
    const totalTrab = rowsByDay.reduce((s, d) => s + d.horasTrabajadas, 0)
    const totalEsp = rowsByDay.reduce((s, d) => s + d.jornadaEsperada, 0)
    const diff = totalTrab - totalEsp
    const h = Math.floor(Math.abs(diff) / 3600000)
    const m = Math.floor((Math.abs(diff) % 3600000) / 60000)
    const text = `${pad2(h)}:${pad2(m)}`
    if (diff === 0) return { status: 'neutral', text: `En tiempo ${text}` }
    if (diff > 0) return { status: 'favor', text: `A favor ${text}` }
    return { status: 'debe', text: `Debes ${text}` }
  }, [rowsByDay])

  // Estado de cada marcación (usa horario SOLO para etiquetas de tardanza/temprano/extra)
  const estadoMarcacion = useCallback(
    (r, fechaDelDia) => {
      if (!r?.efectiva || !horario)
        return { kind: '', text: '', lateMin: 0, earlyMin: 0 }
      const weekend = isWeekend(fechaDelDia)
      const holiday = isHoliday(fechaDelDia)
      if (weekend || holiday)
        return { kind: '', text: '', lateMin: 0, earlyMin: 0 }

      const entradaRef = atTimeStr(fechaDelDia, horario.entrada)
      const salidaRef = atTimeStr(fechaDelDia, horario.salida)
      const dt = new Date(r.efectiva)

      if (r.tipo === 'entrada') {
        const delta = dt - entradaRef
        if (delta > 0)
          return {
            kind: 'danger',
            text: `Retraso ${msToHMS(delta)}`,
            lateMin: mins(delta),
            earlyMin: 0,
          }
        if (delta < 0) {
          return {
            kind: 'success',
            text: `Temprano +${msToHMS(Math.abs(delta))}`,
            lateMin: 0,
            earlyMin: 0,
          }
        }
        return { kind: 'success', text: 'A tiempo', lateMin: 0, earlyMin: 0 }
      }

      if (r.tipo === 'salida') {
        const earlyMs = salidaRef - dt
        if (earlyMs > 0)
          return {
            kind: 'danger',
            text: `Salida antes ${msToHMS(earlyMs)}`,
            earlyMin: mins(earlyMs),
            lateMin: 0,
          }
        const extraMs = dt - salidaRef
        if (extraMs > 0)
          return {
            kind: 'success',
            text: `Tiempo extra +${msToHMS(extraMs)}`,
            lateMin: 0,
            earlyMin: 0,
          }
        return { kind: 'success', text: 'Cumplida', lateMin: 0, earlyMin: 0 }
      }

      return { kind: '', text: '', lateMin: 0, earlyMin: 0 }
    },
    [horario, isWeekend, isHoliday]
  )

  // Expandible por día (con minutos y reglas de botones)
  const Expanded = ({ data }) => {
    const det = data.detalle || []
    if (!det.length)
      return (
        <div className='small text-muted p-2'>Sin marcaciones registradas.</div>
      )

    return (
      <div className='p-3'>
        {det.map((r, i) => {
          const est = estadoMarcacion(r, data.fecha)
          const canUpdate = !!r.aprobado && !isAlreadyUpdated(r) // aprobado y NO actualizada
          const hasJust = !!(
            r.justificacion ||
            r.evidencia_url ||
            r.observacion
          )
          const canJustify = est.kind === 'danger' || hasJust // incidencia o ya existe justificación
          const nextMode = hasJust ? 'view' : 'edit' // ver si ya hay, editar si no

          return (
            <div key={i} className='mb-3 border-bottom pb-2'>
              <div className='d-flex flex-wrap align-items-center gap-2'>
                <strong style={{ textTransform: 'capitalize' }}>
                  {r.tipo.replace('_', ' ')}
                </strong>
                <span className='text-muted small'>{fmtHM(r.efectiva)}</span>

                {est.text && (
                  <span
                    className={`badge ${
                      est.kind === 'danger'
                        ? 'text-bg-danger'
                        : 'text-bg-success'
                    }`}
                  >
                    {est.text}
                    {r.tipo === 'entrada' && est.lateMin > 0 && (
                      <>&nbsp;({est.lateMin} Min)</>
                    )}
                    {r.tipo === 'salida' && est.earlyMin > 0 && (
                      <>&nbsp;({est.earlyMin} Min)</>
                    )}
                  </span>
                )}

                <div className='ms-auto d-flex gap-2'>
                  <button
                    className='btn btn-sm btn-outline-primary'
                    disabled={!canJustify}
                    onClick={() => {
                      if (!canJustify) return
                      setJustModal({ row: r, mode: nextMode })
                    }}
                    title={
                      !canJustify
                        ? 'Sin incidencia y sin justificación previa'
                        : hasJust
                        ? 'Ver justificación'
                        : 'Cargar justificación'
                    }
                  >
                    {hasJust ? 'Ver' : 'Justificar'}
                  </button>

                  <button
                    className='btn btn-sm btn-outline-danger'
                    disabled={!canUpdate}
                    onClick={() => {
                      setRowUpd(r)
                      setOpenUpd(true)
                    }}
                    title={
                      isAlreadyUpdated(r)
                        ? 'La hora efectiva ya fue actualizada'
                        : r.aprobado
                        ? 'Actualizar fecha y hora'
                        : 'Requiere aprobación'
                    }
                  >
                    {isAlreadyUpdated(r)
                      ? 'Actualizado'
                      : 'Actualizar marcación'}
                  </button>
                </div>
              </div>

              {r.justificacion && (
                <div className='text-muted small mt-1'>
                  Justificación: {r.justificacion}
                </div>
              )}
              {r.observacion && (
                <div className='text-muted small'>Obs: {r.observacion}</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Columnas
  const columns = useMemo(
    () => [
      {
        name: 'Fecha',
        selector: r => r.fecha.toISOString(),
        sortable: true,
        width: '120px',
        cell: r => fmtDate(r.fecha),
      },
      {
        name: 'Estado',
        selector: r => r.estado,
        sortable: true,
        width: '140px',
        cell: r => {
          const cls =
            r.estado === 'OK'
              ? 'text-bg-success'
              : r.estado === 'DEBE'
              ? 'text-bg-danger'
              : r.estado === 'AUSENTE'
              ? 'text-bg-warning'
              : r.estado === 'FESTIVO'
              ? 'text-bg-primary'
              : r.estado === 'FIN_DE_SEMANA'
              ? 'text-bg-secondary'
              : 'text-bg-light'
          return <span className={`badge ${cls}`}>{r.estado}</span>
        },
      },
      {
        name: 'Entrada',
        width: '100px',
        selector: r => (r.entrada ? r.entrada.efectiva : ''),
        cell: r => (r.entrada ? fmtHM(r.entrada.efectiva) : '—'),
      },
      {
        name: 'Salida',
        width: '100px',
        selector: r => (r.salida ? r.salida.efectiva : ''),
        cell: r => (r.salida ? fmtHM(r.salida.efectiva) : '—'),
      },
      {
        name: 'Horas trabajadas',
        width: '150px',
        selector: r => r.horasTrabajadas,
        cell: r => msToHMS(r.horasTrabajadas),
      },
      {
        name: 'Saldo',
        width: '140px',
        selector: r => r.saldo,
        sortable: true,
        cell: r => {
          const neg = r.saldo < 0
          return (
            <span
              className={`fw-semibold ${neg ? 'text-danger' : 'text-success'}`}
            >
              {neg ? '-' : '+'}
              {msToHMS(Math.abs(r.saldo))}
            </span>
          )
        },
      },
      {
        name: 'Justificaciones',
        width: '140px',
        selector: r => r.justificaciones,
        cell: r => (
          <span
            className={`badge ${
              r.justificaciones > 0 ? 'text-bg-info' : 'text-bg-secondary'
            }`}
          >
            {r.justificaciones}
          </span>
        ),
      },
    ],
    []
  )

  const customStyles = {
    headCells: { style: { fontWeight: 600, padding: '0.6rem' } },
    rows: { style: { minHeight: '44px' } },
  }

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Mi reporte diario de marcaciones</strong>
          <div className='small text-muted'>
            Documento: {documentoUsuario || '(sin documento)'}
          </div>
        </div>

        {range.from && range.to && (
          <div className='small text-muted'>
            Rango: {fmtDate(range.from)} — {fmtDate(range.to)}
          </div>
        )}

        {resumenMensual && (
          <span
            className={`badge ${
              resumenMensual.status === 'favor'
                ? 'text-bg-success'
                : resumenMensual.status === 'debe'
                ? 'text-bg-danger'
                : 'text-bg-secondary'
            }`}
            style={{ fontSize: '0.9rem' }}
          >
            {resumenMensual.text}
          </span>
        )}

        {/* 🔄 Botón rojo recargar */}
        <button
          type='button'
          className='btn btn-sm btn-danger ms-2'
          onClick={load}
          disabled={loading}
          title='Volver a solicitar los datos al servidor'
        >
          {loading ? 'Recargando…' : 'Recargar datos'}
        </button>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

        <DataTable
          columns={columns}
          data={rowsByDay}
          progressPending={loading}
          pagination
          highlightOnHover
          dense
          responsive
          customStyles={customStyles}
          expandableRows
          expandableRowsComponent={Expanded}
          persistTableHead
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      {/* Modales */}
      <ModalJustificar
        open={!!justModal.row}
        row={justModal.row}
        mode={justModal.mode} // 'view' | 'edit'
        onClose={() => setJustModal({ row: null, mode: 'view' })}
        onSaved={updated => {
          // Actualiza rápido en memoria
          if (updated?.id) {
            setRowsRaw(prev =>
              prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r))
            )
          }
          setJustModal({ row: null, mode: 'view' })
          // Re-sync completo por si cambian contadores/estado
          load()
        }}
      />

      <ModalActualizarFecha
        open={openUpd}
        row={rowUpd}
        onClose={() => setOpenUpd(false)}
        onSaved={updated => {
          if (!updated?.id) {
            setOpenUpd(false)
            return
          }
          const eff = updated?.creado_en || updated?.fecha_hora
          // Actualiza rápido en memoria (reordena por efectiva)
          setRowsRaw(prev =>
            prev
              .map(r =>
                r.id === updated.id
                  ? { ...r, ...updated, efectiva: eff || r.efectiva }
                  : r
              )
              .sort((a, b) => new Date(a.efectiva) - new Date(b.efectiva))
          )
          setOpenUpd(false)
          // Re-sync completo (por si cambió aprobación, estado del día, etc.)
          load()
        }}
      />
    </div>
  )
}

export default TablaMarcaciones
