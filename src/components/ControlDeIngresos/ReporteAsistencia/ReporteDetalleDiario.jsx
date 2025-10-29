// src/components/ControlIngresos/ReporteAsistencia/ReporteDetalleDiario.jsx
import { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import DataTable from 'react-data-table-component'
import { utils, writeFile } from 'xlsx'
import Holidays from 'date-holidays'
import {
  getReporteDetalleDiario,
  setApiAuthToken,
  putAprobacionMarcacion,
  putObservacionMarcacion,
} from './reporte_asistencia_service'
import AuthContext from '../../../context/AuthContext'
import { BiPaperclip, BiPencil } from 'react-icons/bi'

import AprobacionSlider from './AprobacionSlider'
import JustificacionesModal from './JustificacionesModal'
import ObservacionModal from './ObservacionModal'

// ====== Constantes / Utils ======
const LUNCH_MS_DEFAULT = 60 * 60 * 1000
const pad2 = n => String(n).padStart(2, '0')
const fmtHM = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const msToHM = ms => {
  const min = Math.floor(Math.max(0, ms) / 60000)
  const hh = Math.floor(min / 60)
  const mm = min % 60
  return `${pad2(hh)}:${pad2(mm)}`
}
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

// Detecta presencia REAL por lado: solo objeto/ID (nada de campos sueltos)
const hasRealSide = (root, side) => {
  if (!root || typeof root !== 'object') return false
  if (side === 'entrada') {
    return !!(
      root.entradaId ||
      root?.entrada?.id ||
      root?.marcacionEntrada?.id ||
      (root.entrada && Object.keys(root.entrada).length > 0) ||
      (root.marcacionEntrada && Object.keys(root.marcacionEntrada).length > 0)
    )
  }
  if (side === 'salida') {
    return !!(
      root.salidaId ||
      root?.salida?.id ||
      root?.marcacionSalida?.id ||
      (root.salida && Object.keys(root.salida).length > 0) ||
      (root.marcacionSalida && Object.keys(root.marcacionSalida).length > 0)
    )
  }
  return false
}

// Extrae {creado, anterior} SOLO si el lado existe realmente
const getMarkTimes = (root, side) => {
  if (!hasRealSide(root, side)) return { creado: null, anterior: null }

  const obj =
    (side === 'entrada'
      ? root?.entrada || root?.marcacionEntrada
      : root?.salida || root?.marcacionSalida) || null

  if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) {
    const creado =
      obj.creado_en || obj.creadoEn || obj.created_at || obj.createdAt || null
    const anterior =
      obj.fecha_hora ||
      obj.fechaHora ||
      obj.hora_anterior ||
      obj.horaAnterior ||
      null
    return { creado, anterior }
  }

  // Fallbacks planos
  const creado =
    (side === 'entrada'
      ? root?.entradaCreadoEn ||
        root?.entrada_creado_en ||
        root?.entradaCreatedAt
      : root?.salidaCreadoEn ||
        root?.salida_creado_en ||
        root?.salidaCreatedAt) || null

  const anterior =
    (side === 'entrada'
      ? root?.entrada_fecha_hora ||
        root?.entradaFechaHora ||
        root?.entrada_fecha_hora_original
      : root?.salida_fecha_hora ||
        root?.salidaFechaHora ||
        root?.salida_fecha_hora_original) || null

  return { creado, anterior }
}

// Saca un ISO válido desde string u objeto {creado_en/fecha_hora}
const extractCreatedISO = v =>
  typeof v === 'string'
    ? v
    : v?.creado_en || v?.creadoEn || v?.fecha_hora || v?.fechaHora || null

// Busca posibles on/off almuerzo en varias formas (como tu ejemplo)
const getLunchPairISO = row => {
  const onRaw =
    row?.onAlmuerzo ||
    row?.almuerzoOn ||
    row?.marcacionOnAlmuerzo ||
    row?.almuerzo_inicio ||
    null
  const offRaw =
    row?.offAlmuerzo ||
    row?.almuerzoOff ||
    row?.marcacionOffAlmuerzo ||
    row?.almuerzo_fin ||
    null
  const onISO = extractCreatedISO(onRaw)
  const offISO = extractCreatedISO(offRaw)
  return { onISO, offISO }
}

// ====== Badges ======
const EstadoBadge = ({ estado }) => {
  const txt = String(estado || '').replaceAll('_', ' ')
  const cls =
    estado === 'OK'
      ? 'text-bg-success'
      : estado === 'FESTIVO'
      ? 'text-bg-primary'
      : estado === 'FIN_DE_SEMANA'
      ? 'text-bg-secondary'
      : estado === 'AUSENTE' || estado === 'INCOMPLETO'
      ? 'text-bg-danger'
      : estado === 'TARDE' ||
        estado === 'SALIDA_ANTES' ||
        estado === 'TARDE_Y_SALIDA_ANTES'
      ? 'text-bg-warning'
      : 'text-bg-secondary'
  return <span className={`badge ${cls}`}>{txt}</span>
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

// ====== Componente principal ======
const ReporteDetalleDiario = ({ filtros = {} }) => {
  const { from = '', to = '', getHorarioPara } = filtros || {}
  const { token: ctxToken } = useContext(AuthContext) || {}
  const token =
    ctxToken ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    ''

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  // Festivos / fines de semana (Colombia) — igual que en tu ejemplo
  const hd = useMemo(() => new Holidays('CO'), [])
  const isWeekend = useCallback(d => {
    const day = new Date(d)
    return day.getDay() === 0 || day.getDay() === 6
  }, [])
  const isHoliday = useCallback(
    d => {
      const day = new Date(d)
      return !!hd.isHoliday(
        new Date(day.getFullYear(), day.getMonth(), day.getDate())
      )
    },
    [hd]
  )

  // Modales
  const [modalJustif, setModalJustif] = useState({
    open: false,
    loading: false,
    entrada: null,
    salida: null,
  })
  const [modalObs, setModalObs] = useState({
    open: false,
    id: null,
    value: '',
    saving: false,
    which: 'entrada',
  })

  // ===== Cálculo "como en TablaMarcaciones": primera entrada, última salida y almuerzo =====
  // Reemplaza COMPLETO computeWorkedMs por esto:
  const computeWorkedMs = useCallback(
    row => {
      // Tomamos primera entrada y última salida (ya mapeadas por getMarkTimes)
      const ent = getMarkTimes(row, 'entrada')
      const sal = getMarkTimes(row, 'salida')
      if (!ent.creado || !sal.creado) return 0

      const tIn = new Date(ent.creado)
      const tOut = new Date(sal.creado)
      if (isNaN(tIn) || isNaN(tOut) || tOut <= tIn) return 0

      // Día hábil (según TU lógica de festivo/fds)
      const weekend = isWeekend(tIn) // <-- ancla al día de la entrada real
      const holiday = isHoliday(tIn)

      let lunchMs = 0
      if (!weekend && !holiday) {
        const { onISO, offISO } = getLunchPairISO(row)

        if (onISO && offISO) {
          // Descuento real (solo lo que caiga dentro de la jornada efectiva)
          const ai = new Date(onISO)
          const af = new Date(offISO)
          if (!isNaN(ai) && !isNaN(af) && af > ai) {
            lunchMs = overlapMs(
              tIn.getTime(),
              tOut.getTime(),
              ai.getTime(),
              af.getTime()
            )
          }
        } else {
          // SIN marcas: descontar por defecto si hay solape con 12:00–14:00
          // y la entrada fue antes de las 14:00. Anclado al DIA de tIn.
          const lunchStart = atTimeStr(tIn, '12:00') // <-- ancla al día local de tIn
          const lunchEnd = atTimeStr(tIn, '14:00')

          const solape = overlapMs(
            tIn.getTime(),
            tOut.getTime(),
            lunchStart.getTime(),
            lunchEnd.getTime()
          )

          if (tIn.getTime() < lunchEnd.getTime() && solape > 0) {
            lunchMs = Math.min(60 * 60 * 1000, solape) // máximo 60 min
          }
        }
      }

      return Math.max(0, tOut - tIn - lunchMs)
    },
    [isWeekend, isHoliday]
  )

  // Carga de datos
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        if (token) setApiAuthToken(token)
        else setApiAuthToken(null)

        const data = await getReporteDetalleDiario({
          from,
          to,
          getHorarioPara:
            typeof getHorarioPara === 'function' ? getHorarioPara : undefined,
        })

        const computed = (Array.isArray(data) ? data : [])
          .map(d => {
            const ent = getMarkTimes(d, 'entrada')
            const sal = getMarkTimes(d, 'salida')

            const entradaExists = hasRealSide(d, 'entrada')
            const salidaExists = hasRealSide(d, 'salida')

            // Horas visibles (creado_en) con clamp por existencia
            const entradaHM =
              entradaExists && ent.creado ? fmtHM(ent.creado) : ''
            const salidaHM = salidaExists && sal.creado ? fmtHM(sal.creado) : ''

            // Horas anteriores (fecha_hora) con clamp por existencia
            const entradaAnteriorHM =
              entradaExists && ent.anterior ? fmtHM(ent.anterior) : ''
            const salidaAnteriorHM =
              salidaExists && sal.anterior ? fmtHM(sal.anterior) : ''

            // IDs solo si existe el lado
            const entradaId = entradaExists
              ? d?.entradaId ??
                d?.entrada?.id ??
                d?.marcacionEntrada?.id ??
                null
              : null
            const salidaId = salidaExists
              ? d?.salidaId ?? d?.salida?.id ?? d?.marcacionSalida?.id ?? null
              : null

            // métricas backend
            const retrasoEntradaMin =
              Number(d?.retrasoEntradaMin ?? d?.retrasoMin ?? 0) || 0
            const salidaAntesMin =
              Number(d?.salidaAntesMin ?? d?.salida_antes_min ?? 0) || 0

            // justificaciones
            const hasJustEntrada = !!(
              d?.justEntrada?.texto || d?.justEntrada?.imagen_url
            )
            const hasJustSalida = !!(
              d?.justSalida?.texto || d?.justSalida?.imagen_url
            )

            // ===== Trabajado (como TablaMarcaciones) =====
            const trabajadoMs = computeWorkedMs(d)
            const trabajadoHM = msToHM(trabajadoMs)

            return {
              ...d,
              nombre: `${d?.persona?.nombres || ''} ${
                d?.persona?.apellidos || ''
              }`.trim(),

              hasEntrada: entradaExists,
              hasSalida: salidaExists,

              entradaId,
              salidaId,

              entradaHM,
              salidaHM,
              entradaAnteriorHM,
              salidaAnteriorHM,

              hasJust: hasJustEntrada || hasJustSalida,
              hasJustEntrada,
              hasJustSalida,

              retrasoEntradaMin,
              salidaAntesMin,

              trabajadoMs,
              trabajadoHM,
            }
          })
          .sort((a, b) => {
            const da = new Date(a?.fecha || 0).getTime()
            const db = new Date(b?.fecha || 0).getTime()
            return db - da
          })

        setRows(computed)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el detalle diario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [from, to, getHorarioPara, token, computeWorkedMs])

  // --- Helpers de regla
  const shouldExpand = useCallback(
    row =>
      !!row?.hasJust ||
      (Number(row?.retrasoEntradaMin) || 0) > 0 ||
      (Number(row?.salidaAntesMin) || 0) > 0 ||
      row?.estado === 'INCOMPLETO',
    []
  )

  // 🔒 Se puede aprobar si hay justificación **o** si el estado es INCOMPLETO
  const canApproveEntrada = row =>
    !!row?.hasEntrada && (!!row?.hasJustEntrada || row?.estado === 'INCOMPLETO')
  const canApproveSalida = row =>
    !!row?.hasSalida && (!!row?.hasJustSalida || row?.estado === 'INCOMPLETO')

  // --- Handlers: Justificaciones
  const openJustificaciones = useCallback(row => {
    const entrada = row?.justEntrada
      ? { ...row.justEntrada, horaAnteriorHM: row.entradaAnteriorHM || '' }
      : row?.entradaAnteriorHM
      ? { texto: '', imagen_url: null, horaAnteriorHM: row.entradaAnteriorHM }
      : null

    const salida = row?.justSalida
      ? { ...row.justSalida, horaAnteriorHM: row.salidaAnteriorHM || '' }
      : row?.salidaAnteriorHM
      ? { texto: '', imagen_url: null, horaAnteriorHM: row.salidaAnteriorHM }
      : null

    setModalJustif({ open: true, loading: false, entrada, salida })
  }, [])

  // --- Handlers: Aprobaciones
  const setAprobacion = useCallback(async (idMarc, nuevo, side, row) => {
    if (!idMarc) return alert(`No hay marcación de ${side}.`)
    try {
      await putAprobacionMarcacion(
        idMarc,
        nuevo === 'APROBADO',
        side === 'entrada'
          ? row.observacionEntrada || ''
          : row.observacionSalida || ''
      )
      setRows(prev =>
        prev.map(r =>
          r === row
            ? side === 'entrada'
              ? {
                  ...r,
                  aprobadoEntrada:
                    nuevo === 'APROBADO'
                      ? true
                      : nuevo === 'RECHAZADO'
                      ? false
                      : null,
                }
              : {
                  ...r,
                  aprobadoSalida:
                    nuevo === 'APROBADO'
                      ? true
                      : nuevo === 'RECHAZADO'
                      ? false
                      : null,
                }
            : r
        )
      )
    } catch (err) {
      console.error(err)
      alert('Error al actualizar aprobación.')
    }
  }, [])

  const handleAprobacionEntrada = useCallback(
    (row, nuevo) => setAprobacion(row.entradaId, nuevo, 'entrada', row),
    [setAprobacion]
  )
  const handleAprobacionSalida = useCallback(
    (row, nuevo) => setAprobacion(row.salidaId, nuevo, 'salida', row),
    [setAprobacion]
  )

  // --- Handlers: Observación
  const openEditarObs = useCallback(row => {
    const which = row.entradaId ? 'entrada' : 'salida'
    const id = which === 'entrada' ? row.entradaId : row.salidaId
    if (!id) return alert('No hay marcación asociada para observación.')
    const current =
      which === 'entrada'
        ? row.observacionEntrada || ''
        : row.observacionSalida || ''
    setModalObs({ open: true, id, value: current, saving: false, which })
  }, [])

  const saveObs = useCallback(async () => {
    try {
      setModalObs(v => ({ ...v, saving: true }))
      await putObservacionMarcacion(modalObs.id, modalObs.value)
    } catch (e) {
      console.error(e)
      setModalObs(v => ({ ...v, saving: false }))
      alert('Error al guardar observación.')
      return
    }
    setRows(prev =>
      prev.map(r => {
        if (r.entradaId === modalObs.id)
          return { ...r, observacionEntrada: modalObs.value }
        if (r.salidaId === modalObs.id)
          return { ...r, observacionSalida: modalObs.value }
        return r
      })
    )
    setModalObs({
      open: false,
      id: null,
      value: '',
      saving: false,
      which: 'entrada',
    })
  }, [modalObs])

  // --- Filtro local
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const doc = String(r?.persona?.documento || '').toLowerCase()
      const nom = String(r?.nombre || '').toLowerCase()
      const fec = String(r?.fecha || '').toLowerCase()
      return doc.includes(q) || nom.includes(q) || fec.includes(q)
    })
  }, [rows, search])

  // --- KPIs de justificaciones (sobre lo filtrado)
  const justCounts = useMemo(() => {
    let ent = 0,
      sal = 0
    for (const r of filtered) {
      if (r.hasJustEntrada) ent++
      if (r.hasJustSalida) sal++
    }
    return { ent, sal, total: ent + sal }
  }, [filtered])

  // --- Exportar Excel
  const exportar = () => {
    const wb = utils.book_new()
    const ws = utils.json_to_sheet(
      filtered.map(d => ({
        Fecha: d.fecha,
        Documento: d.persona.documento,
        Nombre: d.nombre,
        Entrada: d.hasEntrada ? d.entradaHM : '',
        Salida: d.hasSalida ? d.salidaHM : '',
        Trabajado: d.trabajadoHM || '',
        Estado: d.estado,
        Observación:
          d.observacionEntrada || d.observacionSalida || d.observacion || '',
        'Tarde entrada (min)': d.retrasoEntradaMin ?? 0,
        'Salida antes (min)': d.salidaAntesMin ?? 0,
        'Entrada (anterior)': d.hasEntrada ? d.entradaAnteriorHM || '' : '',
        'Salida (anterior)': d.hasSalida ? d.salidaAnteriorHM || '' : '',
      }))
    )
    utils.book_append_sheet(wb, ws, 'Detalle')
    writeFile(
      wb,
      `Detalle_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  // ====== Columnas ======
  // ====== Columnas ======
  const columns = useMemo(
    () => [
      {
        name: 'Fecha',
        selector: r => r.fecha,
        sortable: true,
        width: '100px', // antes 120px
        style: { paddingLeft: '6px' }, // pega más a la izquierda
      },
      {
        name: 'Documento',
        selector: r => r?.persona?.documento || '',
        sortable: true,
        width: '110px', // antes 120px
        style: { paddingLeft: '6px' }, // pega más a la izquierda
      },
      {
        name: 'Nombre',
        selector: r => r.nombre,
        wrap: true,
        grow: 1, // antes 2 (reduce expansión)
        minWidth: '180px',
        style: { paddingLeft: '6px' }, // pega más a la izquierda
      },
      {
        name: 'Entrada',
        cell: r => (r.hasEntrada ? r.entradaHM : ''),
        sortable: true,
        width: '86px', // un poco más compacto
        style: { paddingLeft: '6px' },
      },
      {
        name: 'Salida',
        cell: r => (r.hasSalida ? r.salidaHM : ''),
        sortable: true,
        width: '86px',
        style: { paddingLeft: '6px' },
      },
      {
        name: 'Trabajado',
        selector: r => r.trabajadoMs,
        sortable: true,
        width: '104px',
        style: { paddingLeft: '6px' },
        cell: r => r.trabajadoHM || '',
      },
      {
        name: 'Estado',
        selector: r => r.estado,
        sortable: true,
        width: '220px', // antes 260px (para que Obs. suba)
        cell: r => (
          <div className='d-flex align-items-center gap-2'>
            <EstadoBadge estado={r.estado} />
            {((r.retrasoEntradaMin || 0) > 0 ||
              (r.salidaAntesMin || 0) > 0) && (
              <span className='badge text-bg-warning' title='Hay incidencias'>
                Incidencia
              </span>
            )}
            {r.hasJust && (
              <span className='badge text-bg-info' title='Con justificación'>
                Justif.
              </span>
            )}
          </div>
        ),
      },
      {
        name: 'Obs.',
        grow: 1, // antes 3 (para traerla a la izquierda)
        minWidth: '260px', // ancho mínimo razonable
        wrap: true,
        style: { paddingLeft: '6px' }, // pega más a la izquierda
        cell: row => (
          <div className='d-flex align-items-center w-100 gap-2'>
            <div className='text-muted flex-grow-1'>
              {row.observacionEntrada ||
                row.observacionSalida ||
                row.observacion || (
                  <span className='opacity-50'>Sin observación</span>
                )}
            </div>
            <button
              type='button'
              className='btn btn-sm btn-outline-secondary'
              onClick={() => openEditarObs(row)}
              title='Editar observación'
            >
              <BiPencil size={16} />
            </button>
          </div>
        ),
      },
    ],
    [openEditarObs]
  )

  // ====== Estilos compactos ======
  const customStyles = {
    headCells: {
      style: {
        fontWeight: 600,
        whiteSpace: 'normal',
        lineHeight: '1.1',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        paddingLeft: '6px', // pega encabezados a la izquierda
      },
    },
    rows: { style: { minHeight: '40px' } },
    cells: {
      style: {
        paddingTop: '0.30rem',
        paddingBottom: '0.30rem',
        lineHeight: 1.15,
        paddingLeft: '6px', // pega celdas a la izquierda (fallback general)
      },
    },
  }

  // ====== SubHeader (buscador + KPIs + export) ======
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 360 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Documento, nombre o fecha…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-2'>
        <span className='badge text-bg-info'>
          Justificaciones: {justCounts.total}
        </span>
        <span className='badge text-bg-secondary'>
          Ent: {justCounts.ent} · Sal: {justCounts.sal}
        </span>
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

  // ====== Componente expandible: Detalles (justificación + aprobación) ======
  const ExpandedComponent = ({ data: row }) => {
    const showEntradaApproval = canApproveEntrada(row)
    const showSalidaApproval = canApproveSalida(row)

    const showJustBtnEntrada = !!row.hasJustEntrada
    const showJustBtnSalida = !!row.hasJustSalida

    return (
      <div className='w-100 px-2 py-3'>
        <div className='row g-3'>
          {/* Entrada */}
          {row.hasEntrada && (
            <div className='col-12 col-md-6'>
              <div className='card h-100'>
                <div className='card-header py-2'>
                  <strong>Entrada</strong>
                  <div className='small text-muted'>
                    Hora (creado_en): {row.entradaHM || '—'} · Retraso:{' '}
                    <span
                      className={`badge ms-1 ${
                        (row.retrasoEntradaMin || 0) > 0
                          ? 'text-bg-warning'
                          : 'text-bg-secondary'
                      }`}
                    >
                      {row.retrasoEntradaMin || 0} Min
                    </span>
                  </div>
                  {row.entradaAnteriorHM ? (
                    <div className='small text-muted'>
                      Hora anterior (fecha_hora): {row.entradaAnteriorHM}
                    </div>
                  ) : null}
                </div>
                <div className='card-body d-flex flex-column gap-3'>
                  <div className='d-flex flex-wrap align-items-center gap-2'>
                    {showJustBtnEntrada && (
                      <button
                        type='button'
                        className='btn btn-sm btn-outline-primary d-flex align-items-center gap-1'
                        onClick={() => openJustificaciones(row)}
                        title='Ver justificación de entrada'
                      >
                        <BiPaperclip size={16} />
                        <span>Ver justificación</span>
                      </button>
                    )}
                  </div>

                  {showEntradaApproval && (
                    <div>
                      <HeaderTwoLines
                        top='Aprobación entrada'
                        bottom='(toggle)'
                        align='left'
                      />
                      <AprobacionSlider
                        className='mt-1'
                        size='sm'
                        value={
                          row.aprobadoEntrada === true
                            ? 'APROBADO'
                            : row.aprobadoEntrada === false
                            ? 'RECHAZADO'
                            : 'PENDIENTE'
                        }
                        onChange={val => handleAprobacionEntrada(row, val)}
                        disabled={!row.entradaId || !canApproveEntrada(row)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Salida */}
          {row.hasSalida && (
            <div className='col-12 col-md-6'>
              <div className='card h-100'>
                <div className='card-header py-2'>
                  <strong>Salida</strong>
                  <div className='small text-muted'>
                    Hora (creado_en): {row.salidaHM || '—'} · Salida antes:{' '}
                    <span
                      className={`badge ms-1 ${
                        (row.salidaAntesMin || 0) > 0
                          ? 'text-bg-warning'
                          : 'text-bg-secondary'
                      }`}
                    >
                      {row.salidaAntesMin || 0} Min
                    </span>
                  </div>
                  {row.salidaAnteriorHM ? (
                    <div className='small text-muted'>
                      Hora anterior (fecha_hora): {row.salidaAnteriorHM}
                    </div>
                  ) : null}
                </div>
                <div className='card-body d-flex flex-column gap-3'>
                  <div className='d-flex flex-wrap align-items-center gap-2'>
                    {showJustBtnSalida && (
                      <button
                        type='button'
                        className='btn btn-sm btn-outline-primary d-flex align-items-center gap-1'
                        onClick={() => openJustificaciones(row)}
                        title='Ver justificación de salida'
                      >
                        <BiPaperclip size={16} />
                        <span>Ver justificación</span>
                      </button>
                    )}
                  </div>

                  {showSalidaApproval && (
                    <div>
                      <HeaderTwoLines
                        top='Aprobación salida'
                        bottom='(toggle)'
                        align='left'
                      />
                      <AprobacionSlider
                        className='mt-1'
                        size='sm'
                        value={
                          row.aprobadoSalida === true
                            ? 'APROBADO'
                            : row.aprobadoSalida === false
                            ? 'RECHAZADO'
                            : 'PENDIENTE'
                        }
                        onChange={val => handleAprobacionSalida(row, val)}
                        disabled={!row.salidaId || !canApproveSalida(row)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ====== Render ======
  return (
    <div className='card'>
      <div className='card-header d-flex align-items-center'>
        <strong>Detalle diario</strong>
        <div className='ms-2 small text-muted'>
          Incluye festivos y fines de semana según calendario CO.
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
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          expandableRowDisabled={row => !shouldExpand(row)}
          expandOnRowClicked
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      <JustificacionesModal
        open={modalJustif.open}
        loading={modalJustif.loading}
        entrada={modalJustif.entrada}
        salida={modalJustif.salida}
        onClose={() =>
          setModalJustif({
            open: false,
            loading: false,
            entrada: null,
            salida: null,
          })
        }
      />

      <ObservacionModal
        open={modalObs.open}
        value={modalObs.value}
        saving={modalObs.saving}
        onChange={v => setModalObs(s => ({ ...s, value: v }))}
        onCancel={() =>
          setModalObs({
            open: false,
            id: null,
            value: '',
            saving: false,
            which: 'entrada',
          })
        }
        onSave={saveObs}
      />
    </div>
  )
}

export default ReporteDetalleDiario
