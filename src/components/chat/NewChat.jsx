import { useMemo, useState } from 'react'
import { createFreeChat } from './chatApi'
import Avatar from './Avatar'

export default function NewChat({
  token,
  myId,
  personas,
  existingChats = [],
  onCreated,
}) {
  const palette = {
    blue: '#79b9ff',
    blueSoft: '#eaf4ff',
    blueBorder: '#cfe6ff',
    orange: '#ffbe8a',
    orangeSoft: '#fff3e8',
    orangeBorder: '#ffd8b8',
    text: '#19324d',
  }

  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [groupName, setGroupName] = useState('')
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

    if (ids.length > 1 && !groupName.trim()) {
      setErr('Por favor ingresa un nombre para el grupo.')
      return
    }

    // Validar chat duplicado 1 a 1 (no aplica para grupales)
    if (ids.length === 1) {
      const otherId = ids[0]
      const exists = existingChats.some(chat => {
        const participants = chat?.participants || []
        // Chat 1 a 1: exactamente 2 participantes
        if (participants.length !== 2) return false
        // Verificar si incluye ambos IDs
        return (
          participants.includes(String(myId)) &&
          participants.includes(String(otherId))
        )
      })

      if (exists) {
        setErr('Ya tienes un chat con esta persona. Búscalo en "Libres".')
        return
      }
    }

    setCreating(true)
    try {
      const participants = [String(myId), ...ids.map(String)]
      const created = await createFreeChat({
        token,
        id_personal: myId,
        title: ids.length > 1 ? groupName.trim() : '',
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
        {selected.size > 1 && (
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder='Nombre del grupo'
            style={{
              width: '100%',
              border: `1px solid ${palette.orangeBorder}`,
              borderRadius: 12,
              padding: '10px 12px',
              outline: 'none',
              fontSize: 13,
              marginBottom: 8,
              background: palette.orangeSoft,
            }}
          />
        )}
        {selected.size > 0 && (
          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
              padding: 8,
              background: palette.blueSoft,
              borderRadius: 8,
              border: `1px solid ${palette.blueBorder}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Participantes ({selected.size}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Array.from(selected).map(id => {
                const p = personas.find(
                  per => String(per?.Id_personal) === String(id)
                )
                const name = p
                  ? `${p.Nombre || ''} ${p.Apellido || ''}`.trim()
                  : id
                return (
                  <span
                    key={id}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      background: palette.blue,
                      color: '#0f2a43',
                      borderRadius: 12,
                    }}
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder='Buscar por nombre, cargo o área…'
          style={{
            width: '100%',
            border: `1px solid ${palette.blueBorder}`,
            borderRadius: 12,
            padding: '10px 12px',
            outline: 'none',
            fontSize: 13,
            marginBottom: 8,
          }}
        />
        <button
          onClick={create}
          disabled={creating || selected.size === 0}
          style={{
            width: '100%',
            border: 'none',
            background: palette.orange,
            color: '#5a2f00',
            borderRadius: 12,
            padding: '10px 14px',
            cursor: creating || selected.size === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 900,
            opacity: creating || selected.size === 0 ? 0.5 : 1,
          }}
        >
          {creating ? 'Creando…' : 'Crear chat'}
        </button>
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
                border: `1px solid ${
                  isOn ? palette.blueBorder : palette.orangeBorder
                }`,
                background: isOn ? palette.blueSoft : palette.orangeSoft,
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
                  border: `2px solid ${palette.blue}`,
                  background: isOn ? palette.blue : 'transparent',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
