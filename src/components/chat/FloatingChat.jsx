import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AuthContext from '../../context/AuthContext'
import ChatPanel from './ChatPanel'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function FloatingChat() {
  const auth = useContext(AuthContext)

  // ✅ Hooks SIEMPRE arriba (nada de return antes)
  const [open, setOpen] = useState(false)

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

  useEffect(() => {
    try {
      localStorage.setItem('floatingChatPos', JSON.stringify(pos))
    } catch (e) {
      // si falla storage, no rompemos la app
    }
  }, [pos])

  const onPointerDown = e => {
    draggingRef.current = true
    dragStartRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = e => {
      if (!draggingRef.current) return
      const maxX = window.innerWidth - 64
      const maxY = window.innerHeight - 64
      setPos({
        x: clamp(e.clientX - dragStartRef.current.dx, 8, maxX),
        y: clamp(e.clientY - dragStartRef.current.dy, 8, maxY),
      })
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

  // ✅ Ahora sí: leemos sesión (sin romper hooks)
  const token = auth?.token
  const myPersonal = auth?.user?.personal
  const myId = myPersonal?.id_personal

  // ✅ Si no hay sesión, NO renderiza nada (pero hooks ya corrieron)
  if (!token || !myId) return null

  const bubble = (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 99999,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      }}
    >
      <button
        onPointerDown={onPointerDown}
        onClick={() => setOpen(v => !v)}
        title='Chat'
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.08)',
          background: '#0b5fff',
          color: 'white',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          userSelect: 'none',
          fontSize: 20,
        }}
      >
        💬
      </button>

      {open && (
        <ChatPanel
          token={token}
          myId={String(myId)}
          myPersonal={myPersonal}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )

  return createPortal(bubble, document.body)
}
