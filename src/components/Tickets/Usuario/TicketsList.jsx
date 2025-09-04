// src/components/Tickets/Usuario/TicketsList.jsx
import { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom' // ⬅️ NUEVO
import AuthContext from '../../../context/AuthContext'
import { listTickets, getMessages, getPersonalById } from './tickets_service' // ⬅️ ACTUALIZADO
import TicketChat from './TicketChat'
import TicketCreate from './TicketCreate'

const POLL_MS = 500 // mismo período que TicketChat

// ---------- Badges y helpers (mismo look que Soporte) ----------
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
  return v === 'no_visto' || v === 'novisto' || v === 'no visto'
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
  width = 520,
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
        aria-labelledby='offUserTickets'
        style={{
          width,
          visibility: open ? 'visible' : '',
          display: open ? 'block' : 'none',
        }}
      >
        <div className='offcanvas-header'>
          <h5 className='offcanvas-title' id='offUserTickets'>
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

/** Modal controlado por React para crear ticket */
const ModalCreate = ({ open, title = 'Nuevo ticket', onClose, children }) => {
  if (!open) return null
  return createPortal(
    <>
      <div
        className='modal fade show'
        role='dialog'
        aria-modal='true'
        style={{ display: 'block', background: 'rgba(0,0,0,.5)' }}
      >
        <div className='modal-dialog modal-dialog-centered modal-lg'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h5 className='modal-title'>{title}</h5>
              <button type='button' className='btn-close' onClick={onClose} />
            </div>
            <div className='modal-body'>{children}</div>
          </div>
        </div>
      </div>
      <div className='modal-backdrop fade show' onClick={onClose} />
    </>,
    document.body
  )
}

const TicketsList = () => {
  const { user } = useContext(AuthContext)
  const idPersonal =
    user?.personal?.id_personal ||
    user?.id_personal ||
    user?.user?.id_personal ||
    ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tickets, setTickets] = useState([])

  // Crear Ticket -> ahora usa modal con TicketCreate adentro
  const [createOpen, setCreateOpen] = useState(false)

  // -------- filtros/paginación --------
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [categoria, setCategoria] = useState('')
  const [nivel, setNivel] = useState('')

  // Debounce simple para search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const params = useMemo(() => {
    const p = { page, size, Id_personal_solicitante: idPersonal }
    if (search) p.search = search
    if (estado) p.estado = estado
    if (categoria) p.categoria = categoria
    if (nivel) p.nivel = nivel
    return p
  }, [page, size, search, estado, categoria, nivel, idPersonal])

  const fetchTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listTickets(params)
      const soloMios = (data?.rows || []).filter(
        t => String(t?.Id_personal_solicitante || '') === String(idPersonal)
      )
      setTickets(soloMios)
      setTotal(data?.count ?? soloMios.length)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar la lista de tickets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!idPersonal) return
    fetchTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, idPersonal])

  // -------- UNREAD POLLING ----------
  const [unreadById, setUnreadById] = useState({})
  const [toast, setToast] = useState({ show: false, title: '', body: '' })

  const unreadTotalActivos = useMemo(
    () =>
      tickets
        .filter(t => t.Estado !== 'Cerrado')
        .reduce((acc, t) => acc + (unreadById[t.id_tiket] || 0), 0),
    [tickets, unreadById]
  )

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
                (ts > lastSeen || isNoVisto(m?.Estado))
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
      setUnreadById(prev => {
        const inc = Object.entries(next).some(([id, c]) => c > (prev[id] || 0))
        if (inc) {
          setToast({
            show: true,
            title: 'Nuevo mensaje',
            body: 'Tienes mensajes nuevos en uno o más tickets.',
          })
        }
        return next
      })
    } catch (e) {
      console.warn('recomputeUnread falló:', e?.message)
    }
  }

  useEffect(() => {
    recomputeUnread()
    const int = setInterval(recomputeUnread, POLL_MS)
    return () => clearInterval(int)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, idPersonal])

  // -------- Offcanvas: detalle (derecha) y chat (izquierda) ----------
  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false) // detalle
  const [chatOpen, setChatOpen] = useState(false) // chat

  // ⬇️ Cache y estados para nombres de personal (solo visual)
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

  const abrirTicket = async t => {
    setSelected(t)
    setDrawerOpen(true)
  }

  const abrirChat = t => {
    setSelected(t)
    setChatOpen(true)
  }

  // Cuando cambia el ticket seleccionado, cargar nombres (solo visual)
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

  useEffect(() => {
    if (!chatOpen) recomputeUnread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen])

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
        <h4 className='m-0'>Mis Tickets</h4>
        <div className='d-flex gap-2'>
          <button
            className='btn btn-primary'
            onClick={() => setCreateOpen(true)}
          >
            + Nuevo ticket
          </button>
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
      </div>

      {error && <div className='alert alert-danger'>{error}</div>}

      {/* Filtros */}
      <div className='row g-2 mb-3'>
        <div className='col-md-4'>
          <input
            className='form-control'
            placeholder='Buscar por asunto o descripción...'
            value={searchInput}
            onChange={e => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className='col-md-2'>
          <select
            className='form-select'
            value={estado}
            onChange={e => {
              setEstado(e.target.value)
              setPage(1)
            }}
          >
            <option value=''>Estado (todos)</option>
            <option value='Pendiente'>Pendiente</option>
            <option value='En_proceso'>En proceso</option>
            <option value='Cerrado'>Cerrado</option>
          </select>
        </div>
        <div className='col-md-3'>
          <input
            className='form-control'
            placeholder='Categoría (ej. Hardware)'
            value={categoria}
            onChange={e => {
              setCategoria(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className='col-md-2'>
          <select
            className='form-select'
            value={nivel}
            onChange={e => {
              setNivel(e.target.value)
              setPage(1)
            }}
          >
            <option value=''>Nivel (todos)</option>
            <option value='Alta'>Alta</option>
            <option value='Media'>Media</option>
            <option value='Baja'>Baja</option>
          </select>
        </div>
        <div className='col-md-1 d-grid'>
          <button
            className='btn btn-outline-secondary'
            onClick={() => {
              setSearchInput('')
              setEstado('')
              setCategoria('')
              setNivel('')
              setPage(1)
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className='mb-2 d-flex align-items-center gap-2'>
        <h6 className='m-0'>Tickets</h6>
        <span className='badge text-bg-secondary'>{tickets.length}</span>
        {unreadTotalActivos > 0 && (
          <span
            className='badge text-bg-danger'
            title='Mensajes sin leer en tickets activos'
          >
            Nuevos: {unreadTotalActivos}
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
        </table>
        <div style={{ maxHeight: 520, overflow: 'auto' }}>
          <table className='table align-middle table-sm mb-0'>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className='text-center text-muted py-4'>
                    Cargando...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className='text-center text-danger py-4'>
                    {error}
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className='text-center text-muted py-3'>
                    No hay tickets.
                  </td>
                </tr>
              ) : (
                tickets.map(t => {
                  const un =
                    t.Estado !== 'Cerrado' ? unreadById[t.id_tiket] || 0 : 0
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⬇️ Modal que renderiza TicketCreate */}
      <ModalCreate
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title='Crear Ticket'
      >
        <TicketCreate
          onCreated={created => {
            setCreateOpen(false)
            fetchTickets()
            setToast({
              show: true,
              title: 'Ticket',
              body: `Ticket creado correctamente${
                created?.id_tiket ? ` (#${created.id_tiket})` : ''
              }.`,
            })
          }}
        />
      </ModalCreate>

      {/* Paginación */}
      <div className='d-flex justify-content-between align-items-center mt-2'>
        <div className='d-flex align-items-center gap-2'>
          <span className='text-muted small'>{total} ticket(s)</span>
          <select
            className='form-select form-select-sm'
            style={{ width: 90 }}
            value={size}
            onChange={e => {
              setSize(Number(e.target.value))
              setPage(1)
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className='btn-group'>
          <button
            className='btn btn-sm btn-outline-secondary'
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <button className='btn btn-sm btn-light' disabled>
            {page} / {Math.max(1, Math.ceil(total / size))}
          </button>
          <button
            className='btn btn-sm btn-outline-secondary'
            disabled={page >= Math.max(1, Math.ceil(total / size))}
            onClick={() =>
              setPage(p =>
                Math.min(Math.max(1, Math.ceil(total / size)), p + 1)
              )
            }
          >
            ›
          </button>
        </div>
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

export default TicketsList
