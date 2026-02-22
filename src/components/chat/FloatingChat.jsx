import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { io } from 'socket.io-client'
import { useLocation } from 'react-router-dom'
import AuthContext from '../../context/AuthContext'
import ChatPanel from './ChatPanel'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function FloatingChat() {
  const auth = useContext(AuthContext)
  const location = useLocation()
  const CUSTOM_CHAT_ICON_URL = '/chat-bubble-custom.svg'

  // ✅ Hooks SIEMPRE arriba (nada de return antes)
  const [open, setOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem('floatingChatPos')
      if (!raw) return { x: 24, y: 140 }
      const p = JSON.parse(raw)
      return { x: Number(p.x) || 24, y: Number(p.y) || 140 }
    } catch (e) {
      // si localStorage falla, usamos default
      return { x: 24, y: 140 }
    }
  })

  const draggingRef = useRef(false)
  const dragStartRef = useRef({ dx: 0, dy: 0 })
  const dragDistanceRef = useRef({ x: 0, y: 0 })
  const socketRef = useRef(null)
  const openRef = useRef(false)
  const [iconFailed, setIconFailed] = useState(false)
  const [autoOpenChatId, setAutoOpenChatId] = useState('')
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('floatingChatPos', JSON.stringify(pos))
    } catch (e) {
      // si falla storage, no rompemos la app
    }
  }, [pos])

  const token = auth?.token
  const myPersonal = auth?.user?.personal
  const myId = myPersonal?.id_personal

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '')
    const incomingChatId = String(sp.get('openChatId') || '').trim()
    if (!incomingChatId) return

    setAutoOpenChatId(incomingChatId)
    setOpen(true)

    sp.delete('openChatId')
    const nextSearch = sp.toString()
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash || ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [location.pathname, location.search, location.hash])

  // ✅ Conectar socket y cargar contador de notificaciones
  useEffect(() => {
    if (!token || !myId) return

    // Conectar socket si no está conectado
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
    if (!socketRef.current) {
      socketRef.current = io(API_URL, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        query: { id_personal: myId },
      })

      // Cuando se conecta, unirse a sala personal
      socketRef.current.on('connect', () => {
        socketRef.current.emit('user:join', { id_personal: myId })
      })

      // Escuchar notificaciones nuevas
      socketRef.current.on('notification:new', () => {
        if (openRef.current) return
        // Incrementar contador
        setNotificationCount(prev => prev + 1)
      })

      // Cuando se abre el chat, marcar como leídas
      socketRef.current.on('chat:opened', () => {
        setNotificationCount(0)
      })
    }

    return () => {
      // No desconectar aquí, puede causar problemas
    }
  }, [token, myId])

  // Limpiar socket al desmontar
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // Si no hay sesión, NO renderiza nada (pero hooks ya corrieron)
  if (!token || !myId) return null

  const onPointerDown = e => {
    if (isMobile) return
    draggingRef.current = true
    dragStartRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    dragDistanceRef.current = { x: 0, y: 0 }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = e => {
      if (!draggingRef.current) return
      const maxX = window.innerWidth - 64
      const maxY = window.innerHeight - 64
      const newX = clamp(e.clientX - dragStartRef.current.dx, 8, maxX)
      const newY = clamp(e.clientY - dragStartRef.current.dy, 8, maxY)

      dragDistanceRef.current.x += Math.abs(newX - pos.x)
      dragDistanceRef.current.y += Math.abs(newY - pos.y)

      setPos({ x: newX, y: newY })
    }

    const onUp = () => {
      draggingRef.current = false
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [pos.x, pos.y])

  const bubble = (
    <div
      style={{
        position: 'fixed',
        left: isMobile ? 'auto' : pos.x,
        top: isMobile ? 'auto' : pos.y,
        right: isMobile ? 12 : 'auto',
        bottom: isMobile ? 12 : 'auto',
        zIndex: 99999,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      }}
    >
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <button
          onPointerDown={onPointerDown}
          onClick={() => {
            // Solo abrir si no fue un drag significativo (< 5px de movimento)
            const dragDistance =
              dragDistanceRef.current.x + dragDistanceRef.current.y
            if (dragDistance < 5) {
              setOpen(v => !v)
              // Al abrir, marcar como leídas y resetear contador
              if (!open && socketRef.current) {
                setNotificationCount(0)
              }
            }
            dragDistanceRef.current = { x: 0, y: 0 }
          }}
          title='Chat'
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            border: '1px solid #cfe6ff',
            background: '#79b9ff',
            color: '#0f2a43',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            userSelect: 'none',
            fontSize: 20,
          }}
        >
          {!iconFailed ? (
            <img
              src={CUSTOM_CHAT_ICON_URL}
              alt='Chat'
              width='24'
              height='24'
              onError={() => setIconFailed(true)}
              style={{ objectFit: 'contain', pointerEvents: 'none' }}
            />
          ) : (
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              aria-hidden='true'
            >
              <path
                d='M4 6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V13.5C20 14.8807 18.8807 16 17.5 16H10.4142L7.70711 18.7071C7.07714 19.3371 6 18.8909 6 18V16H6.5C5.11929 16 4 14.8807 4 13.5V6.5Z'
                stroke='currentColor'
                strokeWidth='1.8'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <circle cx='9' cy='10' r='1.1' fill='currentColor' />
              <circle cx='12' cy='10' r='1.1' fill='currentColor' />
              <circle cx='15' cy='10' r='1.1' fill='currentColor' />
            </svg>
          )}
        </button>

        {/* ✅ Badge de notificaciones */}
        {notificationCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              background: '#ffbe8a',
              color: '#5a2f00',
              borderRadius: 999,
              width: 24,
              height: 24,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 'bold',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 8px rgba(255,190,138,0.35)',
            }}
          >
            {notificationCount > 99 ? '99+' : notificationCount}
          </div>
        )}
      </div>

      {open &&
        (() => {
          if (isMobile) {
            return (
              <div
                style={{
                  position: 'fixed',
                  inset: 8,
                  zIndex: 100000,
                }}
              >
                <ChatPanel
                  token={token}
                  myId={String(myId)}
                  myPersonal={myPersonal}
                  initialChatId={autoOpenChatId}
                  onInitialChatHandled={() => setAutoOpenChatId('')}
                  onClose={() => setOpen(false)}
                  isMobile={isMobile}
                />
              </div>
            )
          }

          const CHAT_WIDTH = 420
          const CHAT_HEIGHT = 600
          const BUBBLE_SIZE = 64
          const MARGIN = 12

          // Calcular espacio disponible en cada dirección
          const spaceBelow = window.innerHeight - (pos.y + BUBBLE_SIZE)
          const spaceAbove = pos.y - CHAT_HEIGHT
          const spaceRight = window.innerWidth - (pos.x + BUBBLE_SIZE)
          const spaceLeft = pos.x - CHAT_WIDTH

          // ✅ IMPORTANTE: Usar AND (&&) no OR (||) para lógica inteligente
          // Abrir ABAJO si: hay espacio suficiente ABAJO Y más espacio abajo que arriba
          const openBelow = spaceBelow >= CHAT_HEIGHT && spaceBelow > spaceAbove

          // Abrir DERECHA si: hay espacio suficiente DERECHA Y más espacio derecha que izquierda
          const openRight = spaceRight >= CHAT_WIDTH && spaceRight > spaceLeft

          // Fallback: si NO hay espacio arriba, abrir abajo de todas formas
          const finalOpenBelow = openBelow || spaceAbove < 0
          const finalOpenRight = openRight || spaceLeft < 0

          const styles = {
            position: 'absolute',
            top: finalOpenBelow ? pos.y + BUBBLE_SIZE + MARGIN : 'auto',
            bottom: finalOpenBelow ? 'auto' : MARGIN,
            left: finalOpenRight ? pos.x + BUBBLE_SIZE + MARGIN : 'auto',
            right: finalOpenRight ? 'auto' : MARGIN,
          }

          return (
            <div style={styles}>
              <ChatPanel
                token={token}
                myId={String(myId)}
                myPersonal={myPersonal}
                initialChatId={autoOpenChatId}
                onInitialChatHandled={() => setAutoOpenChatId('')}
                onClose={() => setOpen(false)}
                isMobile={isMobile}
              />
            </div>
          )
        })()}
    </div>
  )

  return createPortal(bubble, document.body)
}
