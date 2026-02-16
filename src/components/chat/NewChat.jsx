import { useMemo, useState } from 'react'
import { createFreeChat } from './chatApi'
import Avatar from './Avatar'

export default function NewChat({ token, myId, personas, onCreated }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  const filtered = useMemo(() => {
    const s = String(q || '')
      .trim()
      .toLowerCase()
    const list = (personas || []).filter(
      p => String(p?.Id_personal) !== String(myId)
    )
    if (!s) return list
    return list.filter(p => {
      const name = `${p?.Nombre || ''} ${p?.Apellido || ''}`.toLowerCase()
      const cargo = String(p?.Cargo || '').toLowerCase()
      const area = String(p?.Area || '').toLowerCase()
      return (
        name.includes(s) ||
        cargo.includes(s) ||
        area.includes(s) ||
        String(p?.Id_personal || '').includes(s)
      )
    })
  }, [q, personas, myId])

  const toggle = id => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const create = async () => {
    setErr('')
    const ids = Array.from(selected)
    if (ids.length === 0) {
      setErr('Selecciona al menos una persona.')
      return
    }

    setCreating(true)
    try {
      const participants = [String(myId), ...ids.map(String)]
      const created = await createFreeChat({
        token,
        id_personal: myId,
        title: ids.length > 1 ? 'Grupo' : '',
        participants,
      })

      if (!created || !created._id) {
        setErr('El backend no devolvió el chat creado (revisa respuesta).')
        return
      }

      onCreated(created)
    } catch (e) {
      setErr(
        e?.response?.data?.error || e?.message || 'No se pudo crear el chat'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 10, paddingBottom: 6 }}>
        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8 }}>
          Nuevo chat
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder='Buscar por nombre, cargo o área…'
          style={{
            width: '100%',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 12,
            padding: '10px 12px',
            outline: 'none',
            fontSize: 13,
          }}
        />
        {err && (
          <div style={{ color: '#b00020', fontSize: 13, marginTop: 8 }}>
            {err}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 10,
          paddingTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {filtered.map(p => {
          const id = String(p?.Id_personal || '')
          const name = `${p?.Nombre || ''} ${p?.Apellido || ''}`.trim()
          const isOn = selected.has(id)

          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              style={{
                textAlign: 'left',
                border: '1px solid rgba(0,0,0,0.08)',
                background: isOn ? 'rgba(11,95,255,0.10)' : 'white',
                borderRadius: 14,
                padding: 10,
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Avatar
                ruta_foto={p?.ruta_foto || null}
                name={name}
                size={40}
                token={token}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(0,0,0,0.60)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {(p?.Cargo || '') + (p?.Area ? ` • ${p.Area}` : '')}
                </div>
              </div>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: '2px solid rgba(11,95,255,0.55)',
                  background: isOn ? '#0b5fff' : 'transparent',
                }}
              />
            </button>
          )
        })}
      </div>

      <div
        style={{
          padding: 10,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          background: 'white',
        }}
      >
        <button
          onClick={create}
          disabled={creating}
          style={{
            width: '100%',
            border: 'none',
            background: '#0b5fff',
            color: 'white',
            borderRadius: 12,
            padding: '10px 14px',
            cursor: creating ? 'not-allowed' : 'pointer',
            fontWeight: 900,
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? 'Creando…' : 'Crear chat'}
        </button>
      </div>
    </div>
  )
}
