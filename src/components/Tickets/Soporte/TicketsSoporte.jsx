// src/components/Tickets/Soporte/TicketsSoporte.jsx
import { useContext, useEffect, useMemo, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  listTickets,
  changeTicketEstado,
  assignTicket,
  getMessages,
  getPersonalById, // ⬅️ NUEVO
} from '../Usuario/tickets_service'
import TicketChat from '../Usuario/TicketChat'

const POLL_MS = 500 // mismo período que TicketChat

const EstadoBadge = ({ estado }) => {
  const map = { Pendiente: 'warning', En_proceso: 'info', Cerrado: 'success' }
  return (
    <span className={`badge text-bg-${map[estado] || 'secondary'}`}>
      {estado}
    </span>
  )
}

const NivelBadge = ({ nivel }) => {
  const map = { Baja: 'success', Media: 'warning', Alta: 'danger' }
  return (
    <span className={`badge text-bg-${map[nivel] || 'secondary'}`}>
      {nivel}
    </span>
  )
}

const CategoriaPill = ({ categoria }) => (
  <span className='badge rounded-pill text-bg-light border'>{categoria}</span>
)

const fmt = iso => (iso ? new Date(iso).toLocaleString() : '—')

// helpers similares a los del chat
const coerceDate = m =>
  m?.Fecha_Hora || m?.fecha_hora || m?.Fecha || m?.created_at || null
const isMine = (m, myId) =>
  String(m?.Id_personal || m?.id_personal || '') === String(myId || '')
const isNoVisto = estado => {
  const v = String(estado || '').toLowerCase()
  return (
    v === 'no_visto'.toLowerCase() ||
    v === 'novisto' ||
    v === 'no visto' ||
    v === 'novisto'
  )
}

// lastSeen / lastMsg cache (lo actualiza también el chat)
const getLastSeen = id =>
  Number(localStorage.getItem(`ticket_lastSeenAt_${id}`) || 0)
const setLastMsg = (id, ts) =>
  localStorage.setItem(`ticket_lastMsgAt_${id}`, String(ts || 0))

/** Toast simple controlado por estado (sin bootstrap.Toast) */
const ToastLite = ({
  show,
  title = 'Info',
  body = '',
  onClose,
  autoHideMs = 2200,
}) => {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onClose?.(), autoHideMs)
    return () => clearTimeout(t)
  }, [show, onClose, autoHideMs])

  if (!show) return null
  return (
    <div className='position-fixed bottom-0 end-0 p-3' style={{ zIndex: 1080 }}>
      <div
        className='toast show'
        role='alert'
        aria-live='assertive'
        aria-atomic='true'
      >
        <div className='toast-header'>
          <strong className='me-auto'>{title}</strong>
          <button
            type='button'
            className='btn-close'
            onClick={onClose}
            aria-label='Close'
          />
        </div>
        <div className='toast-body'>{body}</div>
      </div>
    </div>
  )
}

/** Offcanvas controlado por React, con lado configurable */
const OffcanvasDrawer = ({
  open,
  onClose,
  width = 420,
  title,
  children,
  side = 'end',
}) => {
  const sideClass = side === 'start' ? 'offcanvas-start' : 'offcanvas-end'
  return (
    <>
      <div
        className={`offcanvas ${sideClass} ${open ? 'show' : ''}`}
        tabIndex='-1'
        aria-labelledby='offTicketLabel'
        style={{
          width,
          visibility: open ? 'visible' : '',
          display: open ? 'block' : 'none',
        }}
      >
        <div className='offcanvas-header'>
          <h5 className='offcanvas-title' id='offTicketLabel'>
            {title}
          </h5>
          <button
            type='button'
            className='btn-close'
            aria-label='Close'
            onClick={onClose}
          />
        </div>
        <div className='offcanvas-body'>{children}</div>
      </div>

      {open && (
        <div
          className='offcanvas-backdrop fade show'
          onClick={onClose}
          style={{ zIndex: 1040 }}
        />
      )}
    </>
  )
}

const TicketsSoporte = () => {
  const { user } = useContext(AuthContext)
  const idPersonal =
    user?.personal?.id_personal ||
    user?.id_personal ||
    user?.user?.id_personal ||
    ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tickets, setTickets] = useState([])

  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false) // detalle (derecha)
  const [chatOpen, setChatOpen] = useState(false) // chat (izquierda)
  const [working, setWorking] = useState(false)

  const [toast, setToast] = useState({ show: false, title: '', body: '' })

  // id_tiket -> count de no leídos
  const [unreadById, setUnreadById] = useState({})

  // ⬇️ Cache y estados para nombres (solo visual)
  const [personalCache, setPersonalCache] = useState({})
  const [solicitante, setSolicitante] = useState(null)
  const [soporte, setSoporte] = useState(null)

  const getNombreCompleto = p =>
    p ? `${p.Nombre ?? ''} ${p.Apellido ?? ''}`.trim() || '—' : '—'

  const fetchPersonalOnce = async id => {
    if (!id) return null
    if (personalCache[id]) return personalCache[id]
    try {
      const data = await getPersonalById(id)
      setPersonalCache(prev => ({ ...prev, [id]: data }))
      return data
    } catch {
      return null
    }
  }

  const pendientes = useMemo(
    () => tickets.filter(t => t.Estado === 'Pendiente'),
    [tickets]
  )
  const enProceso = useMemo(
    () => tickets.filter(t => t.Estado === 'En_proceso'),
    [tickets]
  )
  const otros = useMemo(
    () => tickets.filter(t => t.Estado !== 'Pendiente'),
    [tickets]
  )

  // contadores agregados
  const unreadPend = useMemo(
    () => pendientes.reduce((acc, t) => acc + (unreadById[t.id_tiket] || 0), 0),
    [pendientes, unreadById]
  )
  const unreadEnProceso = useMemo(
    () => enProceso.reduce((acc, t) => acc + (unreadById[t.id_tiket] || 0), 0),
    [enProceso, unreadById]
  )

  const fetchTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listTickets({ page: 1, size: 50 })
      setTickets(data?.rows || [])
    } catch (e) {
      setError('No se pudo cargar la lista de tickets.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  // -------- UNREAD POLLING ----------
  const recomputeUnread = async () => {
    try {
      const active = tickets.filter(t => t.Estado !== 'Cerrado')
      if (active.length === 0) {
        setUnreadById({})
        return
      }

      const results = await Promise.all(
        active.map(async t => {
          try {
            const data = await getMessages(t.id_tiket)
            const items = Array.isArray(data?.rows)
              ? data.rows
              : data?.items || data || []
            // ordenar por fecha y actualizar lastMsg
            const ordered = [...items].sort((a, b) => {
              const ta = new Date(coerceDate(a) || 0).getTime()
              const tb = new Date(coerceDate(b) || 0).getTime()
              return ta - tb
            })
            if (ordered.length) {
              const last = ordered[ordered.length - 1]
              const lastTs = new Date(coerceDate(last) || Date.now()).getTime()
              setLastMsg(t.id_tiket, lastTs)
            }

            const lastSeen = getLastSeen(t.id_tiket)
            const count = ordered.filter(m => {
              const ts = new Date(coerceDate(m) || 0).getTime()
              return (
                !isMine(m, idPersonal) &&
                (isNoVisto(m?.Estado) || (lastSeen && ts > lastSeen))
              )
            }).length

            return [t.id_tiket, count]
          } catch {
            return [t.id_tiket, unreadById[t.id_tiket] || 0]
          }
        })
      )

      const next = {}
      for (const [id, c] of results) next[id] = c
      setUnreadById(next)
    } catch (e) {
      console.warn('recomputeUnread falló:', e?.message)
    }
  }

  // Inicio del polling + refresco cuando cambian tickets o idPersonal
  useEffect(() => {
    recomputeUnread()
    const int = setInterval(recomputeUnread, POLL_MS)
    return () => clearInterval(int)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, idPersonal])

  // Al cerrar chat, forzar un refresh rápido (el chat marca vistos y actualiza localStorage)
  useEffect(() => {
    if (!chatOpen) recomputeUnread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen])

  // -------- estado y acciones ----------
  const ensureEnProceso = async t => {
    if (t.Estado !== 'Pendiente') return
    try {
      setWorking(true)
      await changeTicketEstado(t.id_tiket, 'En_proceso', String(idPersonal))
      setTickets(prev =>
        prev.map(x =>
          x.id_tiket === t.id_tiket
            ? {
                ...x,
                Estado: 'En_proceso',
                Fecha_Proceso: new Date().toISOString(),
              }
            : x
        )
      )
      setSelected(s =>
        s
          ? {
              ...s,
              Estado: 'En_proceso',
              Fecha_Proceso: new Date().toISOString(),
            }
          : s
      )
      setToast({ show: true, title: 'Ticket', body: 'Movido a En_proceso.' })
    } catch (e) {
      setToast({
        show: true,
        title: 'Error',
        body: 'No se pudo mover a En_proceso.',
      })
      console.error(e)
    } finally {
      setWorking(false)
    }
  }

  const abrirTicket = async t => {
    setSelected(t)
    setDrawerOpen(true)
    await ensureEnProceso(t)
  }

  const abrirChat = async t => {
    setSelected(t)
    setChatOpen(true)
    await ensureEnProceso(t)
  }

  const cerrarTicket = async () => {
    if (!selected) return
    if (selected.Estado !== 'En_proceso') {
      setToast({
        show: true,
        title: 'No permitido',
        body: 'Para cerrar el ticket, primero debe estar En_proceso (asignado).',
      })
      return
    }
    const ok = window.confirm(
      '¿Seguro que quieres Cerrar este ticket? Esta acción no se puede deshacer.'
    )
    if (!ok) return

    try {
      setWorking(true)
      await changeTicketEstado(selected.id_tiket, 'Cerrado', String(idPersonal))
      setTickets(prev =>
        prev.map(x =>
          x.id_tiket === selected.id_tiket
            ? { ...x, Estado: 'Cerrado', Fecha_Fin: new Date().toISOString() }
            : x
        )
      )
      setSelected(s =>
        s ? { ...s, Estado: 'Cerrado', Fecha_Fin: new Date().toISOString() } : s
      )
      setToast({ show: true, title: 'Ticket', body: 'Ticket cerrado.' })
    } catch (e) {
      setToast({
        show: true,
        title: 'Error',
        body: 'No se pudo cerrar el ticket.',
      })
      console.error(e)
    } finally {
      setWorking(false)
    }
  }

  const tomarTicket = async () => {
    if (!selected || !idPersonal) return
    try {
      setWorking(true)
      await assignTicket(selected.id_tiket, {
        Id_personal_soporte: String(idPersonal),
      })
      await changeTicketEstado(
        selected.id_tiket,
        'En_proceso',
        String(idPersonal)
      )

      setTickets(prev =>
        prev.map(x =>
          x.id_tiket === selected.id_tiket
            ? {
                ...x,
                Id_personal_soporte: String(idPersonal),
                Estado: 'En_proceso',
                Fecha_Proceso: new Date().toISOString(),
              }
            : x
        )
      )
      setSelected(s =>
        s
          ? {
              ...s,
              Id_personal_soporte: String(idPersonal),
              Estado: 'En_proceso',
              Fecha_Proceso: new Date().toISOString(),
            }
          : s
      )
      setToast({
        show: true,
        title: 'Ticket',
        body: 'Ticket tomado y en proceso.',
      })
    } catch (e) {
      setToast({
        show: true,
        title: 'Error',
        body: 'No se pudo tomar el ticket.',
      })
      console.error(e)
    } finally {
      setWorking(false)
    }
  }

  // Cargar nombres (solo visual) cuando cambia el seleccionado
  useEffect(() => {
    let cancel = false
    const run = async () => {
      if (!selected) {
        setSolicitante(null)
        setSoporte(null)
        return
      }
      const [sol, sop] = await Promise.all([
        fetchPersonalOnce(selected.Id_personal_solicitante),
        fetchPersonalOnce(selected.Id_personal_soporte),
      ])
      if (!cancel) {
        setSolicitante(sol)
        setSoporte(sop)
      }
    }
    run()
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // ---------- UI ----------
  const UnreadPill = ({ count }) =>
    count > 0 ? (
      <span
        className='badge text-bg-danger ms-2'
        title={`${count} nuevo(s) sin leer`}
      >
        +{count}
      </span>
    ) : null

  return (
    <div className='container py-3'>
      <div className='d-flex align-items-center justify-content-between mb-3'>
        <h4 className='m-0'>Soporte</h4>
        <button
          className='btn btn-outline-secondary'
          onClick={fetchTickets}
          disabled={loading}
        >
          {loading ? (
            <>
              <span
                className='spinner-border spinner-border-sm me-2'
                role='status'
              />
              Cargando...
            </>
          ) : (
            'Refrescar'
          )}
        </button>
      </div>

      {error && <div className='alert alert-danger'>{error}</div>}

      {/* Pendientes como cards */}
      <div className='mb-2 d-flex align-items-center gap-2'>
        <h6 className='m-0'>Pendientes</h6>
        <span className='badge text-bg-warning'>{pendientes.length}</span>
        {unreadPend > 0 && (
          <span
            className='badge text-bg-danger'
            title='Mensajes sin leer en Pendientes'
          >
            Nuevos: {unreadPend}
          </span>
        )}
      </div>

      {pendientes.length === 0 ? (
        <div className='text-muted mb-4'>No hay tickets pendientes.</div>
      ) : (
        <div className='row g-3 mb-4'>
          {pendientes.map(t => {
            const un = unreadById[t.id_tiket] || 0
            return (
              <div className='col-12 col-sm-6 col-lg-4' key={t.id_tiket}>
                <div className='card h-100 shadow-sm'>
                  <div className='card-body d-flex flex-column'>
                    <div className='d-flex justify-content-between align-items-start'>
                      <h6 className='card-title mb-2'>
                        {t.Asunto}
                        <UnreadPill count={un} />
                      </h6>
                      <NivelBadge nivel={t.Nivel} />
                    </div>
                    <p className='card-text text-muted small mb-2'>
                      {t.Descripcion}
                    </p>
                    <div className='d-flex flex-wrap gap-2 mb-2'>
                      <CategoriaPill categoria={t.Categoria} />
                      <EstadoBadge estado={t.Estado} />
                    </div>
                    <div className='text-muted small mb-3'>
                      <strong>Creado:</strong> {fmt(t.Fecha_Creacion)}
                    </div>

                    <div className='mt-auto d-grid gap-2'>
                      <button
                        className='btn btn-primary'
                        onClick={() => abrirTicket(t)}
                        disabled={working}
                      >
                        Abrir detalle
                      </button>
                      <button
                        className='btn btn-outline-primary'
                        onClick={() => abrirChat(t)}
                        disabled={working}
                        title='Abrir chat del ticket'
                      >
                        Abrir chat{' '}
                        {un > 0 && (
                          <span className='badge text-bg-danger ms-1'>
                            +{un}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Otros en tabla (mostramos badge en En_proceso) */}
      <div className='mb-2 d-flex align-items-center gap-2'>
        <h6 className='m-0'>Otros</h6>
        <span className='badge text-bg-secondary'>{otros.length}</span>
        {unreadEnProceso > 0 && (
          <span
            className='badge text-bg-danger'
            title='Mensajes sin leer en En_proceso'
          >
            Nuevos: {unreadEnProceso}
          </span>
        )}
      </div>

      <div className='table-responsive'>
        <table className='table align-middle table-sm'>
          <thead>
            <tr>
              <th>ID</th>
              <th>Asunto</th>
              <th>Estado</th>
              <th>Nivel</th>
              <th>Categoría</th>
              <th>Creación</th>
              <th>Proceso</th>
              <th>Fin</th>
              <th className='text-end'>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {otros.map(t => {
              const un =
                t.Estado === 'En_proceso' ? unreadById[t.id_tiket] || 0 : 0
              return (
                <tr key={t.id_tiket}>
                  <td>#{t.id_tiket}</td>
                  <td className='text-truncate' style={{ maxWidth: 260 }}>
                    {t.Asunto} {un > 0 && <UnreadPill count={un} />}
                  </td>
                  <td>
                    <EstadoBadge estado={t.Estado} />
                  </td>
                  <td>
                    <NivelBadge nivel={t.Nivel} />
                  </td>
                  <td>
                    <CategoriaPill categoria={t.Categoria} />
                  </td>
                  <td className='text-nowrap'>{fmt(t.Fecha_Creacion)}</td>
                  <td className='text-nowrap'>{fmt(t.Fecha_Proceso)}</td>
                  <td className='text-nowrap'>{fmt(t.Fecha_Fin)}</td>
                  <td className='text-end'>
                    <div className='btn-group'>
                      <button
                        className='btn btn-outline-primary btn-sm'
                        onClick={() => abrirTicket(t)}
                      >
                        Ver
                      </button>
                      <button
                        className='btn btn-outline-secondary btn-sm'
                        onClick={() => abrirChat(t)}
                        title='Abrir chat'
                      >
                        Chat{' '}
                        {un > 0 && (
                          <span className='badge text-bg-danger ms-1'>
                            +{un}
                          </span>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {otros.length === 0 && (
              <tr>
                <td colSpan={9} className='text-center text-muted py-3'>
                  No hay tickets en proceso o cerrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Offcanvas DETALLE (derecha) */}
      <OffcanvasDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        side='end'
        title='Detalle del ticket'
      >
        {!selected ? (
          <div className='text-muted'>Selecciona un ticket…</div>
        ) : (
          <>
            <div className='d-flex flex-wrap justify-content-between align-items-center mb-2'>
              <div className='d-flex align-items-center gap-2'>
                <h6 className='mb-0'>
                  #{selected.id_tiket} — {selected.Asunto}
                </h6>
                <EstadoBadge estado={selected.Estado} />
              </div>
              <div className='d-flex gap-2'>
                <button
                  className='btn btn-outline-primary btn-sm'
                  onClick={() => abrirChat(selected)}
                  title='Abrir chat al costado'
                >
                  Abrir chat
                </button>
                <button
                  className='btn btn-outline-success btn-sm'
                  onClick={tomarTicket}
                  disabled={
                    working ||
                    String(selected.Id_personal_soporte || '') ===
                      String(idPersonal)
                  }
                  title={
                    String(selected.Id_personal_soporte || '') ===
                    String(idPersonal)
                      ? 'Ya eres el soporte asignado'
                      : 'Tomar ticket'
                  }
                >
                  Tomar ticket
                </button>
                <button
                  className='btn btn-danger btn-sm'
                  onClick={cerrarTicket}
                  disabled={working || selected.Estado === 'Cerrado'}
                  title='Cerrar ticket'
                >
                  Cerrar tikects
                </button>
              </div>
            </div>

            <p className='text-muted small'>{selected.Descripcion}</p>
            <div className='d-flex flex-wrap gap-2 mb-3'>
              <CategoriaPill categoria={selected.Categoria} />
              <NivelBadge nivel={selected.Nivel} />
            </div>

            <ul className='list-group list-group-flush mb-3'>
              <li className='list-group-item px-0 d-flex justify-content-between'>
                <span className='text-muted'>Solicitante</span>
                <strong>{getNombreCompleto(solicitante)}</strong>
              </li>
              <li className='list-group-item px-0 d-flex justify-content-between'>
                <span className='text-muted'>Soporte</span>
                <strong>{getNombreCompleto(soporte)}</strong>
              </li>
              <li className='list-group-item px-0 d-flex justify-content-between'>
                <span className='text-muted'>Creado</span>
                <span>{fmt(selected.Fecha_Creacion)}</span>
              </li>
              <li className='list-group-item px-0 d-flex justify-content-between'>
                <span className='text-muted'>En proceso</span>
                <span>{fmt(selected.Fecha_Proceso)}</span>
              </li>
              <li className='list-group-item px-0 d-flex justify-content-between'>
                <span className='text-muted'>Cierre</span>
                <span>{fmt(selected.Fecha_Fin)}</span>
              </li>
            </ul>
          </>
        )}
      </OffcanvasDrawer>

      {/* Offcanvas CHAT (izquierda) */}
      <OffcanvasDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        width={520}
        side='start'
        title={selected ? `Chat — Ticket #${selected.id_tiket}` : 'Chat'}
      >
        {!selected ? (
          <div className='text-muted'>Selecciona un ticket…</div>
        ) : (
          <TicketChat ticket={selected} onClose={() => setChatOpen(false)} />
        )}
      </OffcanvasDrawer>

      <ToastLite
        show={toast.show}
        title={toast.title}
        body={toast.body}
        onClose={() => setToast(s => ({ ...s, show: false }))}
      />
    </div>
  )
}

export default TicketsSoporte
