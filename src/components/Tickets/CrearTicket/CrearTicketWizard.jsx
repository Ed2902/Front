import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Paso1OrgAsignacion from './steps/Paso1OrgAsignacion.jsx'
import Paso2Catalogo from './steps/Paso2Catalogo.jsx'
import Paso3Detalles from './steps/Paso3Detalles.jsx'

import {
  fetchCategorias,
  fetchPrioridades,
  fetchEstadoNuevoId,
  fetchPersonal,
  fetchAreas,
  fetchTeams,
  createTicket,
} from './service.CrearTicket.js'

import * as AuthMod from '../../../context/AuthContext.jsx'

const FallbackAuthContext = createContext({ user: null, token: null })
const AuthContextToUse = AuthMod?.AuthContext
  ? AuthMod.AuthContext
  : AuthMod?.default || FallbackAuthContext

const ORGS = [
  { value: 'FastwaySAS', label: 'FastwaySAS' },
  { value: 'MetalHarvest', label: 'MetalHarvest' },
  { value: 'GreenWay', label: 'GreenWay' },
]

const pickItems = r =>
  r?.items || r?.data || r?.rows || r?.results || (Array.isArray(r) ? r : [])

const safeStr = v => String(v ?? '').trim()

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

function resolveToken(auth, tokenProp) {
  const t =
    safeStr(tokenProp) ||
    safeStr(auth?.token) ||
    safeStr(auth?.accessToken) ||
    safeStr(auth?.user?.token)

  if (t) return t
  try {
    return safeStr(
      localStorage.getItem('token') || localStorage.getItem('accessToken')
    )
  } catch {
    return ''
  }
}

function resolveUser(auth) {
  return auth?.user ?? null
}

function resolveIdPersonalFromUser(user) {
  const candidates = [
    user?.personal?.id_personal,
    user?.personal?.Id_personal,
    user?.id_personal,
    user?.Id_personal,
    user?.principalId,
  ].map(safeStr)
  return candidates.find(Boolean) || ''
}

function resolveIdPersonalFromToken(token) {
  const payload = decodeJwtPayload(token)
  if (!payload) return ''
  const candidates = [
    payload?.id_personal,
    payload?.Id_personal,
    payload?.personal?.id_personal,
    payload?.personal?.Id_personal,
  ].map(safeStr)
  return candidates.find(Boolean) || ''
}

function resolveNombreCreador(user, creadoPor) {
  const nombre = safeStr(
    user?.personal?.nombre || user?.personal?.name || user?.nombre || user?.name
  )
  const apellido = safeStr(user?.personal?.apellido || user?.apellido)
  const full = safeStr([nombre, apellido].filter(Boolean).join(' '))
  if (full) return full
  return creadoPor ? `ID ${creadoPor}` : ''
}

function extractTicketFromResponse(res) {
  if (!res) return null
  if (res?.ticket) return res.ticket
  if (res?.data?.ticket) return res.data.ticket
  if (res?.data?.data?.ticket) return res.data.data.ticket
  return null
}

function PrettyConfirmModal({
  open,
  title = 'Listo',
  summary,
  creator,
  onClose,
  onCopy,
}) {
  if (!open) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          zIndex: 9999,
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 16,
        }}
      >
        <div
          role='dialog'
          aria-modal='true'
          style={{
            width: 'min(860px, 100%)',
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 24px 70px rgba(0,0,0,.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(15,23,42,.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 900, color: '#0f172a' }}>{title}</div>

            <button
              type='button'
              onClick={onClose}
              aria-label='Cerrar'
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 26,
                lineHeight: 1,
                color: '#64748b',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                aria-hidden='true'
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  flex: '0 0 auto',
                }}
              >
                ✓
              </div>

              <div style={{ width: '100%' }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: 4,
                  }}
                >
                  {summary.code ? `Código: ${summary.code}` : 'Ticket creado'}
                </div>

                <div style={{ color: '#64748b', marginBottom: 14 }}>
                  Tu ticket quedó registrado correctamente.
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid rgba(15,23,42,.10)',
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      color: '#0f172a',
                    }}
                  >
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748b' }}>Título: </span>
                      <span style={{ fontWeight: 700 }}>
                        {summary.titulo || '—'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Organización: </span>
                      <span style={{ fontWeight: 700 }}>
                        {summary.org || '—'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Asignado a: </span>
                      <span style={{ fontWeight: 700 }}>
                        {summary.asignado || '—'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Categoría: </span>
                      <span style={{ fontWeight: 700 }}>
                        {summary.categoria || '—'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Prioridad: </span>
                      <span style={{ fontWeight: 700 }}>
                        {summary.prioridad || '—'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Estado: </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: '#16a34a',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        {summary.estado || 'Nuevo'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Adjuntos: </span>
                      <span style={{ fontWeight: 700 }}>
                        {Number.isFinite(summary.adjuntosCount)
                          ? summary.adjuntosCount
                          : 0}
                      </span>
                    </div>

                    {summary.chatId ? (
                      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                        <span style={{ color: '#64748b' }}>ChatId: </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          }}
                        >
                          {summary.chatId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 14, color: '#64748b' }}>
                  Creador:{' '}
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>
                    {creator || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '16px 20px',
              borderTop: '1px solid rgba(15,23,42,.08)',
              background: '#ffffff',
            }}
          >
            <button
              type='button'
              onClick={onClose}
              style={{
                borderRadius: 12,
                padding: '10px 16px',
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,.18)',
                color: '#0f172a',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>

            {summary.code ? (
              <button
                type='button'
                onClick={onCopy}
                style={{
                  borderRadius: 12,
                  padding: '10px 16px',
                  background: '#0f172a',
                  border: '1px solid #0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Copiar código
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

export default function CrearTicketWizard({ token: tokenProp, onClose }) {
  const auth = useContext(AuthContextToUse) || {}
  const user = resolveUser(auth)
  const tokenResolved = resolveToken(auth, tokenProp)

  const idFromUser = resolveIdPersonalFromUser(user)
  const idFromToken = resolveIdPersonalFromToken(tokenResolved)
  const creadoPor = idFromUser || idFromToken

  const [step, setStep] = useState(1)
  const [dir, setDir] = useState('next')

  const [data, setData] = useState({
    tipo: 'tarea',

    orgId: ORGS[0].value,
    orgLabel: ORGS[0].label,

    asignado_tipo: 'personal',
    asignado_id: '',
    asignado_label: '',

    categoria_id: '',
    categoria_label: '',
    categoria_color: '',

    prioridad_id: '',
    prioridad_label: '',
    prioridad_color: '',

    estado_id: '',

    operacion_subtipo: '',
    operacion_cliente_id: '',
    operacion_lote_id: '',
    operacion_producto_id: '',

    titulo: '',
    descripcion: '',

    fecha_estimada: '',
    watchers: [],

    files: [],
  })

  const [cats, setCats] = useState([])
  const [pris, setPris] = useState([])
  const [estadoNuevoId, setEstadoNuevoId] = useState('')

  const [personal, setPersonal] = useState([])
  const [areas, setAreas] = useState([])
  const [teams, setTeams] = useState([])

  const [pagePersonal, setPagePersonal] = useState(1)
  const [pageAreas, setPageAreas] = useState(1)
  const [pageTeams, setPageTeams] = useState(1)

  const [hasMorePersonal, setHasMorePersonal] = useState(true)
  const [hasMoreAreas, setHasMoreAreas] = useState(true)
  const [hasMoreTeams, setHasMoreTeams] = useState(true)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const [showOk, setShowOk] = useState(false)
  const [createdTicket, setCreatedTicket] = useState(null)

  useEffect(() => {
    if (data.tipo === 'operacion') return
    setData(s => ({
      ...s,
      operacion_subtipo: '',
      operacion_cliente_id: '',
      operacion_lote_id: '',
      operacion_producto_id: '',
    }))
  }, [data.tipo])

  const isOperacion = data.tipo === 'operacion'

  const step1Valid = Boolean(
    data.tipo && data.orgId && data.asignado_tipo && data.asignado_id
  )

  const step2OperacionValid = isOperacion
    ? Boolean(data.operacion_subtipo && data.operacion_cliente_id)
    : true

  const step2Valid = Boolean(
    data.categoria_id &&
    data.prioridad_id &&
    (data.estado_id || estadoNuevoId) &&
    step2OperacionValid
  )

  const step3Valid =
    data.titulo.trim().length >= 3 && data.descripcion.trim().length >= 5

  const canNext = step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid

  useEffect(() => {
    setData(s => ({
      ...s,
      categoria_id: '',
      categoria_label: '',
      categoria_color: '',
      prioridad_id: '',
      prioridad_label: '',
      prioridad_color: '',
      estado_id: '',
    }))
    setCats([])
    setPris([])
    setEstadoNuevoId('')
  }, [data.orgId])

  useEffect(() => {
    setData(s => ({ ...s, asignado_id: '', asignado_label: '' }))
  }, [data.asignado_tipo])

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!tokenResolved || !data.orgId) return
      setErr(null)
      try {
        setLoading(true)
        const [cRes, pRes, nuevoId] = await Promise.all([
          fetchCategorias(data.orgId, tokenResolved, { page: 1, limit: 100 }),
          fetchPrioridades(data.orgId, tokenResolved, { page: 1, limit: 100 }),
          fetchEstadoNuevoId(data.orgId, tokenResolved),
        ])
        if (!alive) return
        setCats(pickItems(cRes))
        setPris(pickItems(pRes))
        setEstadoNuevoId(nuevoId || '')
        setData(s => ({ ...s, estado_id: nuevoId || '' }))
      } catch (e) {
        if (!alive) return
        setErr(e?.response?.data || e?.message || 'Error cargando catálogo')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [data.orgId, tokenResolved])

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!tokenResolved) return
      try {
        const res = await fetchPersonal({ page: 1, limit: 50 }, tokenResolved)
        if (!alive) return
        const items = pickItems(res)
        setPersonal(items)
        setPagePersonal(1)
        setHasMorePersonal(items.length >= 50)
      } catch {
        // ignore
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [tokenResolved])

  const loadMorePersonal = useCallback(async () => {
    if (!tokenResolved || !hasMorePersonal) return
    const next = pagePersonal + 1
    try {
      setLoading(true)
      const res = await fetchPersonal({ page: next, limit: 50 }, tokenResolved)
      const items = pickItems(res)
      setPersonal(prev => [...prev, ...items])
      setPagePersonal(next)
      setHasMorePersonal(items.length >= 50)
    } finally {
      setLoading(false)
    }
  }, [tokenResolved, hasMorePersonal, pagePersonal])

  const loadAreasIfNeeded = useCallback(async () => {
    if (!tokenResolved) return
    if (areas.length > 0) return
    setLoading(true)
    try {
      const res = await fetchAreas({ page: 1, limit: 50 }, tokenResolved)
      const items = pickItems(res)
      setAreas(items)
      setPageAreas(1)
      setHasMoreAreas(items.length >= 50)
    } catch (e) {
      setErr(e?.response?.data || e?.message || 'Error cargando áreas')
    } finally {
      setLoading(false)
    }
  }, [tokenResolved, areas.length])

  const loadTeamsIfNeeded = useCallback(async () => {
    if (!tokenResolved) return
    if (teams.length > 0) return
    setLoading(true)
    try {
      const res = await fetchTeams({ page: 1, limit: 50 }, tokenResolved)
      const items = pickItems(res)
      setTeams(items)
      setPageTeams(1)
      setHasMoreTeams(items.length >= 50)
    } catch (e) {
      setErr(e?.response?.data || e?.message || 'Error cargando teams')
    } finally {
      setLoading(false)
    }
  }, [tokenResolved, teams.length])

  const loadMoreAreas = useCallback(async () => {
    if (!tokenResolved || !hasMoreAreas) return
    const next = pageAreas + 1
    setLoading(true)
    try {
      const res = await fetchAreas({ page: next, limit: 50 }, tokenResolved)
      const items = pickItems(res)
      setAreas(prev => [...prev, ...items])
      setPageAreas(next)
      setHasMoreAreas(items.length >= 50)
    } finally {
      setLoading(false)
    }
  }, [tokenResolved, hasMoreAreas, pageAreas])

  const loadMoreTeams = useCallback(async () => {
    if (!tokenResolved || !hasMoreTeams) return
    const next = pageTeams + 1
    setLoading(true)
    try {
      const res = await fetchTeams({ page: next, limit: 50 }, tokenResolved)
      const items = pickItems(res)
      setTeams(prev => [...prev, ...items])
      setPageTeams(next)
      setHasMoreTeams(items.length >= 50)
    } finally {
      setLoading(false)
    }
  }, [tokenResolved, hasMoreTeams, pageTeams])

  useEffect(() => {
    if (data.asignado_tipo === 'area') loadAreasIfNeeded()
    if (data.asignado_tipo === 'team') loadTeamsIfNeeded()
  }, [data.asignado_tipo, loadAreasIfNeeded, loadTeamsIfNeeded])

  const goNext = () => {
    if (!canNext) return
    setDir('next')
    setStep(s => Math.min(3, s + 1))
  }

  const goBack = () => {
    setDir('back')
    setStep(s => Math.max(1, s - 1))
  }

  const onCreate = async () => {
    setErr(null)
    if (!tokenResolved) return setErr('No hay token disponible.')
    if (!creadoPor)
      return setErr('No se pudo determinar id_personal del creador.')
    if (!step1Valid || !step2Valid || !step3Valid)
      return setErr('Faltan campos obligatorios.')

    try {
      setLoading(true)

      const payload = {
        orgId: data.orgId,
        tipo: data.tipo,
        titulo: data.titulo,
        descripcion: data.descripcion,
        categoria_id: data.categoria_id,
        prioridad_id: data.prioridad_id,
        estado_id: data.estado_id || estadoNuevoId,
        creado_por: creadoPor,
        asignado_tipo: data.asignado_tipo,
        asignado_id: data.asignado_id,

        fecha_estimada: data.fecha_estimada,
        watchers: data.watchers,

        files: data.files,
      }

      if (data.tipo === 'operacion') {
        payload.subtipo = data.operacion_subtipo
        payload.id_cliente = data.operacion_cliente_id
        payload.id_lote = data.operacion_lote_id
        payload.id_producto = data.operacion_producto_id
      }

      const res = await createTicket(payload, tokenResolved)

      const tk = extractTicketFromResponse(res) || null
      setCreatedTicket(tk)
      setShowOk(true)
    } catch (e) {
      setErr(e?.response?.data || e?.message || 'Error creando ticket')
    } finally {
      setLoading(false)
    }
  }

  const creadoPorLabel = useMemo(
    () => resolveNombreCreador(user, creadoPor),
    [user, creadoPor]
  )

  const resumenModal = useMemo(() => {
    const code = safeStr(createdTicket?.code)
    const chatId = safeStr(createdTicket?.chatId)
    const adj = Array.isArray(createdTicket?.adjuntos)
      ? createdTicket.adjuntos.length
      : Array.isArray(data.files)
        ? data.files.length
        : 0

    return {
      org: data.orgLabel || data.orgId,
      code,
      titulo: data.titulo,
      asignado: data.asignado_label || data.asignado_id,
      categoria: data.categoria_label,
      prioridad: data.prioridad_label,
      estado: 'Nuevo',
      adjuntosCount: adj,
      chatId,
    }
  }, [createdTicket, data])

  const closeAfterSummary = useCallback(() => {
    onClose?.(createdTicket)
  }, [onClose, createdTicket])

  const stepNode = useMemo(() => {
    if (step === 1) {
      return (
        <Paso1OrgAsignacion
          ORGS={ORGS}
          data={data}
          setData={setData}
          loading={loading}
          lists={{ personal, areas, teams }}
          paging={{
            hasMorePersonal,
            hasMoreAreas,
            hasMoreTeams,
            loadMorePersonal,
            loadMoreAreas,
            loadMoreTeams,
          }}
        />
      )
    }

    if (step === 2) {
      return (
        <Paso2Catalogo
          data={data}
          setData={setData}
          loading={loading}
          cats={cats}
          pris={pris}
          token={tokenResolved} // ✅ AQUÍ
        />
      )
    }

    return (
      <Paso3Detalles
        data={data}
        setData={setData}
        loading={loading}
        creadoPorLabel={creadoPorLabel}
        personal={personal}
        resumen={{
          org: data.orgLabel || data.orgId,
          asignado: data.asignado_label || data.asignado_id,
          categoria: data.categoria_label,
          prioridad: data.prioridad_label,
          estado: 'Nuevo',
        }}
      />
    )
  }, [
    step,
    data,
    setData,
    loading,
    personal,
    areas,
    teams,
    hasMorePersonal,
    hasMoreAreas,
    hasMoreTeams,
    loadMorePersonal,
    loadMoreAreas,
    loadMoreTeams,
    cats,
    pris,
    creadoPorLabel,
    tokenResolved,
  ])

  const wrapperClass =
    step === 3
      ? 'wizard-step wizard-static'
      : `wizard-step ${dir === 'next' ? 'wizard-next' : 'wizard-back'}`

  return (
    <div className='container my-3'>
      <style>{`
        .wizard-stage { position: relative; min-height: 320px; }
        .wizard-step { animation-duration: 220ms; animation-timing-function: ease; animation-fill-mode: both; }
        .wizard-next { animation-name: wizardNext; }
        .wizard-back { animation-name: wizardBack; }
        @keyframes wizardNext { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
        @keyframes wizardBack { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
        .wizard-static { animation: none !important; transform: none !important; will-change: auto !important; }
      `}</style>

      <PrettyConfirmModal
        open={showOk}
        title='Ticket creado'
        summary={resumenModal}
        creator={creadoPorLabel}
        onClose={closeAfterSummary}
        onCopy={() => {
          if (!resumenModal.code) return
          try {
            navigator.clipboard?.writeText(resumenModal.code)
          } catch {
            // ignore
          }
        }}
      />

      <div className='card shadow-sm border-0'>
        <div className='card-body'>
          <div className='d-flex flex-wrap align-items-center justify-content-between gap-2'>
            <div>
              <h5 className='mb-1 fw-bold'>Crear Ticket (Paso a paso)</h5>
              <div className='text-muted small'>
                Organización → asignación → catálogo → detalles.
              </div>
            </div>

            <div className='text-end'>
              <div className='small text-muted'>Paso {step} de 3</div>
              <div className='fw-bold'>
                {step === 1 ? 33 : step === 2 ? 66 : 100}%
              </div>
            </div>
          </div>

          <div className='progress my-3' style={{ height: 10 }}>
            <div
              className='progress-bar'
              role='progressbar'
              style={{ width: `${step === 1 ? 33 : step === 2 ? 66 : 100}%` }}
            />
          </div>

          <div className='wizard-stage'>
            <div key={step} className={wrapperClass}>
              {stepNode}
            </div>
          </div>

          <div className='d-flex justify-content-between gap-2 mt-3'>
            <button
              type='button'
              className='btn btn-outline-secondary'
              onClick={goBack}
              disabled={loading || step === 1 || showOk}
            >
              Atrás
            </button>

            {step < 3 ? (
              <button
                type='button'
                onClick={goNext}
                disabled={loading || !canNext || showOk}
                className='btn'
                style={{
                  background: '#93c5fd',
                  border: '1px solid #60a5fa',
                  color: '#0f172a',
                  fontWeight: 800,
                }}
              >
                Siguiente
              </button>
            ) : (
              <button
                type='button'
                className='btn btn-success'
                onClick={onCreate}
                disabled={loading || !step3Valid || showOk}
              >
                {loading ? 'Creando…' : 'Crear Ticket'}
              </button>
            )}
          </div>

          {err ? (
            <div className='alert alert-danger mt-3 mb-0'>
              <div className='fw-bold mb-1'>No se pudo crear el ticket</div>
              <div className='small' style={{ whiteSpace: 'pre-wrap' }}>
                {typeof err === 'string' ? err : JSON.stringify(err, null, 2)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
