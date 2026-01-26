// src/components/Notifications/NotificationsBell.jsx
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { BiBell, BiCheck, BiCheckDouble, BiRefresh } from 'react-icons/bi'
import AuthContext from '../../context/AuthContext'

import {
  countNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  fetchPersonalById,
} from './notifications.service'

const fmtDate = iso => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const oidToString = v => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.$oid) return String(v.$oid)
  return String(v)
}

export default function NotificationsBell({ placement = 'end' }) {
  const { token, user } = useContext(AuthContext)
  const id_personal = user?.personal?.id_personal

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState('unread') // 'unread' | 'all'
  const [error, setError] = useState(null)

  // cache para no llamar /personal/:id repetido
  const nameCacheRef = useRef(new Map())

  const canUse = !!token && !!id_personal

  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const loadCount = useCallback(async () => {
    if (!canUse) return
    try {
      const r = await countNotifications({ token, id_personal })
      setUnread(Number(r.unread) || 0)
    } catch {
      // silencioso
    }
  }, [canUse, token, id_personal])

  const resolveActorName = useCallback(
    async createdBy => {
      const key = String(createdBy || '').trim()
      if (!key) return ''
      if (nameCacheRef.current.has(key)) return nameCacheRef.current.get(key)

      const p = await fetchPersonalById({ token, id: key })
      if (!p) {
        nameCacheRef.current.set(key, '')
        return ''
      }

      const nombre = String(p?.Nombre || '').trim()
      const apellido = String(p?.Apellido || '').trim()
      const full = [nombre, apellido].filter(Boolean).join(' ').trim()

      nameCacheRef.current.set(key, full)
      return full
    },
    [token]
  )

  const loadList = useCallback(async () => {
    if (!canUse) return
    setLoading(true)
    setError(null)
    try {
      const isRead = filter === 'unread' ? false : undefined
      const r = await listNotifications({
        token,
        id_personal,
        page: 1,
        limit: 25,
        isRead,
      })
      const list = Array.isArray(r.items) ? r.items : []

      setItems(list)

      const actors = [
        ...new Set(
          list.map(n => String(n?.createdBy || '').trim()).filter(Boolean)
        ),
      ]
      await Promise.all(actors.map(a => resolveActorName(a)))
      setItems(prev => [...prev])
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar notificaciones.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [canUse, token, id_personal, filter, resolveActorName])

  useEffect(() => {
    loadCount()
    if (!canUse) return
    const t = setInterval(loadCount, 20000)
    return () => clearInterval(t)
  }, [canUse, loadCount])

  useEffect(() => {
    if (!open) return
    loadCount()
    loadList()
  }, [open, loadCount, loadList])

  const badgeText = useMemo(() => {
    if (!unread) return ''
    return unread > 99 ? '99+' : String(unread)
  }, [unread])

  const actorLabel = n => {
    const id = String(n?.createdBy || '').trim()
    if (!id) return ''
    const cached = nameCacheRef.current.get(id)
    return cached ? cached : id
  }

  const buildNavigationUrl = n => {
    const raw = String(n?.target?.url || '').trim()
    if (raw) {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
          const u = new URL(raw)
          return `${u.pathname}${u.search}${u.hash}`
        } catch {
          return raw
        }
      }
      if (!raw.startsWith('/')) return `/${raw}`
      return raw
    }

    const ticketId =
      n?.target?.params?.ticketId ||
      n?.target?.params?.ticketID ||
      n?.target?.params?.id

    const ticketsSection =
      n?.target?.params?.ticketsSection ||
      n?.target?.params?.section ||
      'misTareas'

    if (ticketId) {
      return `/tickets?ticketsSection=${encodeURIComponent(
        String(ticketsSection)
      )}&ticketId=${encodeURIComponent(String(ticketId))}`
    }
    return ''
  }

  const onClickNotification = async n => {
    if (!n?._id) return

    if (!n.isRead) {
      try {
        await markNotificationRead({
          token,
          notificationId: oidToString(n._id),
          id_personal,
        })

        setItems(prev =>
          prev.map(x =>
            oidToString(x?._id) === oidToString(n._id)
              ? { ...x, isRead: true, readAt: new Date().toISOString() }
              : x
          )
        )
        setUnread(u => Math.max(0, (Number(u) || 0) - 1))
      } catch {
        // no bloquea navegación
      }
    }

    const url = buildNavigationUrl(n)
    if (url) {
      window.location.assign(url)
      return
    }

    setOpen(false)
  }

  const onMarkAllRead = async () => {
    if (!canUse) return
    try {
      await markAllNotificationsRead({ token, id_personal })
      setItems(prev =>
        prev.map(x => ({
          ...x,
          isRead: true,
          readAt: x.readAt || new Date().toISOString(),
        }))
      )
      setUnread(0)
    } catch (e) {
      setError(e?.message || 'No se pudo marcar todo como leído.')
    }
  }

  const positionMenu = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()

    const menuW = 360
    const menuH = 460

    const left = Math.max(8, Math.min(r.left, window.innerWidth - menuW - 8))

    // Preferimos “arriba”; si no hay espacio, lo ponemos abajo
    const preferTop = r.top - menuH - 10
    const top =
      preferTop > 8
        ? preferTop
        : Math.min(r.bottom + 10, window.innerHeight - menuH - 8)

    setMenuPos({ top, left })
  }, [])

  // Al abrir: calcular posición y escuchar clicks afuera / escape / resize / scroll
  useEffect(() => {
    if (!open) return

    positionMenu()

    const onDown = e => {
      const btn = btnRef.current
      const menu = menuRef.current
      if (!btn || !menu) return
      const t = e.target
      if (btn.contains(t)) return
      if (menu.contains(t)) return
      setOpen(false)
    }

    const onKey = e => {
      if (e.key === 'Escape') setOpen(false)
    }

    const onReposition = () => positionMenu()

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition, { passive: true })
    window.addEventListener('scroll', onReposition, {
      passive: true,
      capture: true,
    })

    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, positionMenu])

  return (
    <div
      className={`dropdown ${open ? 'show' : ''}`}
      style={{ position: 'relative' }}
    >
      <button
        ref={btnRef}
        type='button'
        className='btn btn-sm btn-light position-relative'
        onClick={() => setOpen(v => !v)}
        disabled={!canUse}
        aria-expanded={open ? 'true' : 'false'}
        title={
          !canUse ? 'Inicia sesión para ver notificaciones' : 'Notificaciones'
        }
        style={{ borderRadius: 10 }}
      >
        <BiBell size={20} />
        {!!badgeText && (
          <span
            className='position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger'
            style={{ fontSize: 11 }}
          >
            {badgeText}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`dropdown-menu show dropdown-menu-${placement}`}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: 360,
              maxWidth: '92vw',
              padding: 0,
              zIndex: 999999,
              border: 0,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
              background: '#fff',
            }}
          >
            <div className='d-flex align-items-center justify-content-between px-3 py-2 border-bottom'>
              <div style={{ fontWeight: 800 }}>Notificaciones</div>

              <div className='d-flex gap-2'>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-secondary'
                  onClick={loadList}
                  disabled={loading}
                  title='Refrescar'
                >
                  <BiRefresh size={16} />
                </button>

                <button
                  type='button'
                  className='btn btn-sm btn-outline-primary'
                  onClick={onMarkAllRead}
                  disabled={loading || unread === 0}
                  title='Marcar todas como leídas'
                >
                  <BiCheckDouble size={18} />
                </button>
              </div>
            </div>

            <div className='d-flex align-items-center gap-2 px-3 py-2 border-bottom'>
              <div
                className='btn-group btn-group-sm'
                role='group'
                aria-label='Filtro notificaciones'
              >
                <button
                  type='button'
                  className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('unread')}
                  disabled={loading}
                >
                  No leídas
                </button>
                <button
                  type='button'
                  className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('all')}
                  disabled={loading}
                >
                  Todas
                </button>
              </div>

              <div className='ms-auto text-muted' style={{ fontSize: 12 }}>
                {unread} sin leer
              </div>
            </div>

            {error && (
              <div className='px-3 py-2'>
                <div className='alert alert-danger py-2 mb-0'>{error}</div>
              </div>
            )}

            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {loading && <div className='px-3 py-3 text-muted'>Cargando…</div>}

              {!loading && !items?.length && (
                <div className='px-3 py-3 text-muted'>
                  No hay notificaciones.
                </div>
              )}

              {!loading &&
                items?.map(n => {
                  const id = oidToString(n?._id)
                  const isRead = !!n?.isRead
                  const actor = actorLabel(n)
                  const createdAt = n?.createdAt?.$date || n?.createdAt
                  const when = fmtDate(createdAt)

                  return (
                    <button
                      key={id}
                      type='button'
                      className='dropdown-item text-wrap'
                      onClick={() => onClickNotification(n)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid rgba(0,0,0,.06)',
                        background: isRead
                          ? 'transparent'
                          : 'rgba(13,110,253,.08)',
                      }}
                    >
                      <div className='d-flex align-items-start justify-content-between gap-2'>
                        <div style={{ minWidth: 0 }}>
                          <div
                            className='fw-semibold'
                            style={{ lineHeight: 1.15 }}
                          >
                            {n?.title || '—'}
                          </div>
                          <div
                            className='text-muted'
                            style={{ fontSize: 12, lineHeight: 1.2 }}
                          >
                            {n?.body || '—'}
                          </div>

                          <div
                            className='text-muted mt-1'
                            style={{ fontSize: 11 }}
                          >
                            {actor ? (
                              <>
                                Por: <b>{actor}</b> ·{' '}
                              </>
                            ) : null}
                            {when}
                          </div>
                        </div>

                        <div className='d-flex flex-column align-items-end gap-1'>
                          {!isRead ? (
                            <span
                              className='badge bg-primary'
                              style={{ fontSize: 10 }}
                            >
                              Nueva
                            </span>
                          ) : (
                            <span
                              className='badge bg-light text-dark'
                              style={{ fontSize: 10 }}
                            >
                              Leída
                            </span>
                          )}
                        </div>
                      </div>

                      <div className='d-flex align-items-center justify-content-between mt-2'>
                        <span className='text-muted' style={{ fontSize: 11 }}>
                          {String(n?.type || '').trim() || '—'}
                        </span>

                        {!isRead && (
                          <span
                            className='text-primary d-inline-flex align-items-center gap-1'
                            style={{ fontSize: 12 }}
                          >
                            <BiCheck size={16} />
                            marcar leída
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>

            <div
              className='px-3 py-2 border-top text-muted'
              style={{ fontSize: 12 }}
            >
              * “Desmarcar como no leída” requiere endpoint backend (si lo
              quieres, lo armamos).
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
