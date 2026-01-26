import React, { useMemo } from 'react'

const ASSIGN_TYPES = [
  {
    value: 'personal',
    label: 'Personal',
    desc: 'Asignar a una persona específica.',
  },
  {
    value: 'area',
    label: 'Área',
    desc: 'Asignar a un área (cola de trabajo).',
  },
  { value: 'team', label: 'Team', desc: 'Asignar a un equipo.' },
]

// ✅ Tipos de ticket
const TICKET_TYPES = [
  {
    value: 'tarea',
    label: 'Tarea',
    desc: 'Trabajo puntual / requerimiento.',
  },
  {
    value: 'proyecto',
    label: 'Proyecto',
    desc: 'Igual a tarea, pero con enfoque de proyecto.',
  },
  {
    value: 'operacion',
    label: 'Operación',
    desc: 'Incluye cliente + lote + producto (si aplica).',
  },
]

const norm = v =>
  String(v ?? '')
    .trim()
    .toLowerCase()

// Colores fijos (no los cambio):
// FastwaySAS: naranja
// MetalHarvest: verde
// GreenWay: azul aguamarina
const ORG_THEME = {
  fastwaysas: { accent: '#ff7a18' },
  metalharvest: { accent: '#1f9d55' },
  greenway: { accent: '#11b5c9' },
}

function getOrgTheme(org) {
  const key = norm(org?.label) || norm(org?.value)
  if (key.includes('fastway')) return ORG_THEME.fastwaysas
  if (key.includes('metalharvest') || key.includes('metal'))
    return ORG_THEME.metalharvest
  if (key.includes('greenway')) return ORG_THEME.greenway
  return { accent: '#6c757d' }
}

/**
 * /personal llega con keys en mayúscula:
 * Id_personal, Nombre, Apellido, Cargo, Area
 */
const toPersonalOptions = (items = []) =>
  items
    .map(p => {
      const id = String(p?.Id_personal ?? p?.id_personal ?? '').trim()
      if (!id) return null

      const nombre = String(p?.Nombre ?? p?.nombre ?? '').trim()
      const apellido = String(p?.Apellido ?? p?.apellido ?? '').trim()
      const cargo = String(p?.Cargo ?? p?.cargo ?? '').trim()
      const area = String(p?.Area ?? p?.area ?? '').trim()

      const fullName = [nombre, apellido].filter(Boolean).join(' ').trim()
      const metaParts = [cargo, area].filter(Boolean)
      const meta = metaParts.join(' — ').trim()

      const base = fullName || id
      const label = meta ? `${base} — ${meta} (${id})` : `${base} (${id})`

      return { value: id, label }
    })
    .filter(Boolean)

const toGenericOptions = (items = []) =>
  items
    .map(x => {
      const id = x?._id
      const label = x?.name || x?.nombre || x?._id
      if (!id) return null
      return { value: id, label }
    })
    .filter(Boolean)

export default function Paso1OrgAsignacion({
  ORGS,
  data,
  setData,
  loading,
  lists,
  paging,
}) {
  const assignOptions = useMemo(() => {
    if (data.asignado_tipo === 'personal')
      return toPersonalOptions(lists.personal)
    if (data.asignado_tipo === 'area') return toGenericOptions(lists.areas)
    if (data.asignado_tipo === 'team') return toGenericOptions(lists.teams)
    return []
  }, [data.asignado_tipo, lists.personal, lists.areas, lists.teams])

  const canLoadMore =
    data.asignado_tipo === 'personal'
      ? paging.hasMorePersonal
      : data.asignado_tipo === 'area'
        ? paging.hasMoreAreas
        : paging.hasMoreTeams

  const loadMore =
    data.asignado_tipo === 'personal'
      ? paging.loadMorePersonal
      : data.asignado_tipo === 'area'
        ? paging.loadMoreAreas
        : paging.loadMoreTeams

  const onSelectAsignado = e => {
    const value = e.target.value
    const opt = assignOptions.find(o => o.value === value)
    setData(s => ({
      ...s,
      asignado_id: value,
      asignado_label: opt?.label || '',
    }))
  }

  const onSelectTipo = tipo => {
    setData(s => ({
      ...s,
      tipo,
    }))
  }

  const seleccionLabel =
    data.asignado_tipo === 'area'
      ? 'Seleccionar área'
      : data.asignado_tipo === 'team'
        ? 'Seleccionar team'
        : 'Seleccionar personal'

  const placeholderLabel =
    data.asignado_tipo === 'area'
      ? '-- selecciona un área --'
      : data.asignado_tipo === 'team'
        ? '-- selecciona un team --'
        : '-- selecciona una persona --'

  return (
    <div>
      <h6 className='fw-bold mb-2'>Paso 1 — Tipo, organización y asignación</h6>
      <p className='text-muted small mb-3'>
        Elige qué vas a crear, para qué organización y a quién se asigna.
      </p>

      {/* Tipo de ticket */}
      <div className='mb-3'>
        <div className='fw-bold mb-2'>Tipo de ticket</div>

        <div className='row g-2'>
          {TICKET_TYPES.map(t => {
            const selected = (data.tipo || 'tarea') === t.value

            const style = selected
              ? {
                  border: '2px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 8px 18px rgba(37,99,235,.18)',
                  transform: 'translateY(-1px)',
                }
              : {
                  border: '1px solid rgba(37,99,235,.18)',
                  background: '#eff6ff',
                  color: '#0f172a',
                }

            return (
              <div className='col-12 col-md-4' key={t.value}>
                <div
                  className='card h-100'
                  role='button'
                  onClick={() => onSelectTipo(t.value)}
                  style={{
                    ...style,
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                    borderRadius: 14,
                    minHeight: 64,
                  }}
                >
                  <div className='card-body py-2 px-3'>
                    <div className='d-flex align-items-start justify-content-between'>
                      <div>
                        <div className='fw-bold' style={{ lineHeight: 1.1 }}>
                          {t.label}
                        </div>
                        <div
                          className='small'
                          style={{
                            opacity: selected ? 0.9 : 0.75,
                            fontSize: 12,
                          }}
                        >
                          {t.desc}
                        </div>
                      </div>

                      <span
                        className='badge'
                        style={{
                          borderRadius: 999,
                          fontWeight: 700,
                          background: selected
                            ? 'rgba(255,255,255,.22)'
                            : '#dbeafe',
                          color: selected ? '#fff' : '#1e3a8a',
                          border: selected
                            ? '1px solid rgba(255,255,255,.35)'
                            : '1px solid rgba(30,58,138,.12)',
                        }}
                      >
                        {selected ? 'Elegido' : 'Elegir'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className='text-muted small mt-2'>
          <span>
            <b>Proyecto</b> funciona igual que tarea (solo cambia el tipo).
          </span>
          <br />
          <span>
            <b>Operación</b> habilita cliente/lote/producto en el Paso 2.
          </span>
        </div>
      </div>

      {/* Organización */}
      <div className='mb-3'>
        <div className='fw-bold mb-2'>
          Organización (Selecciona la empresa del ticket.)
        </div>

        <div className='row g-2'>
          {ORGS.map(org => {
            const selected = data.orgId === org.value
            const theme = getOrgTheme(org)

            const cardStyle = {
              cursor: 'pointer',
              transition: 'all .15s ease',
              borderRadius: 14,
              minHeight: 58,
              background: '#ffffff',
              border: selected
                ? `2px solid ${theme.accent}`
                : `1px solid ${theme.accent}`,
              boxShadow: selected ? '0 8px 18px rgba(0,0,0,.08)' : 'none',
            }

            const titleStyle = {
              color: theme.accent,
              fontWeight: 600,
              lineHeight: 1.1,
            }

            const badgeStyle = selected
              ? {
                  background: theme.accent,
                  color: '#fff',
                  border: `1px solid ${theme.accent}`,
                }
              : {
                  background: '#ffffff',
                  color: theme.accent,
                  border: `1px solid ${theme.accent}`,
                }

            return (
              <div className='col-12 col-md-4' key={org.value}>
                <div
                  className='card h-100'
                  role='button'
                  onClick={() =>
                    setData(s => ({
                      ...s,
                      orgId: org.value,
                      orgLabel: org.label,
                    }))
                  }
                  style={cardStyle}
                >
                  <div className='card-body py-2 px-3'>
                    <div className='d-flex align-items-center justify-content-between'>
                      <div className='d-flex align-items-center gap-2'>
                        <span
                          aria-hidden='true'
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: selected ? theme.accent : '#ffffff',
                            border: `2px solid ${theme.accent}`,
                            display: 'inline-block',
                          }}
                        />
                        <div style={titleStyle}>{org.label}</div>
                      </div>

                      <span
                        className='badge'
                        style={{
                          ...badgeStyle,
                          borderRadius: 999,
                          fontWeight: 600,
                        }}
                      >
                        {selected ? 'Elegida' : 'Elegir'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ¿Es para? */}
      <div className='mb-3'>
        <div className='fw-bold mb-2'>¿Es para?</div>

        <div className='row g-2'>
          {ASSIGN_TYPES.map(t => {
            const selected = data.asignado_tipo === t.value

            const style = selected
              ? {
                  border: '2px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 8px 18px rgba(37,99,235,.18)',
                  transform: 'translateY(-1px)',
                }
              : {
                  border: '1px solid rgba(37,99,235,.18)',
                  background: '#eff6ff',
                  color: '#0f172a',
                }

            return (
              <div className='col-12 col-md-4' key={t.value}>
                <div
                  className='card h-100'
                  role='button'
                  onClick={() =>
                    setData(s => ({
                      ...s,
                      asignado_tipo: t.value,
                      asignado_id: '',
                      asignado_label: '',
                    }))
                  }
                  style={{
                    ...style,
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                    borderRadius: 14,
                    minHeight: 64,
                  }}
                >
                  <div className='card-body py-2 px-3'>
                    <div className='d-flex align-items-start justify-content-between'>
                      <div>
                        <div className='fw-bold' style={{ lineHeight: 1.1 }}>
                          {t.label}
                        </div>
                        <div
                          className='small'
                          style={{
                            opacity: selected ? 0.9 : 0.75,
                            fontSize: 12,
                          }}
                        >
                          {t.desc}
                        </div>
                      </div>

                      <span
                        className='badge'
                        style={{
                          borderRadius: 999,
                          fontWeight: 700,
                          background: selected
                            ? 'rgba(255,255,255,.22)'
                            : '#dbeafe',
                          color: selected ? '#fff' : '#1e3a8a',
                          border: selected
                            ? '1px solid rgba(255,255,255,.35)'
                            : '1px solid rgba(30,58,138,.12)',
                        }}
                      >
                        {selected ? 'Elegido' : 'Elegir'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selección */}
      <div className='mb-2'>
        <div className='fw-bold mb-2'>{seleccionLabel}</div>

        <select
          className='form-select'
          value={data.asignado_id}
          onChange={onSelectAsignado}
          disabled={loading}
          style={{
            borderRadius: 12,
            borderColor: data.asignado_id ? '#2563eb' : undefined,
            boxShadow: data.asignado_id
              ? '0 0 0 .15rem rgba(37,99,235,.15)'
              : undefined,
          }}
        >
          <option value=''>{placeholderLabel}</option>
          {assignOptions.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        <div className='d-flex align-items-center justify-content-between mt-2'>
          <div className='text-muted small'>(Lista paginada)</div>

          <button
            type='button'
            className='btn btn-sm'
            onClick={loadMore}
            disabled={loading || !canLoadMore}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(37,99,235,.35)',
              background: canLoadMore ? '#eff6ff' : '#f8fafc',
              color: '#1e40af',
              fontWeight: 700,
            }}
          >
            {canLoadMore ? 'Cargar más' : 'No hay más'}
          </button>
        </div>
      </div>
    </div>
  )
}
