import { useContext, useEffect, useMemo, useState } from 'react'
import { Modal, Input, Switch, Alert, Select, Tag } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { createTeam, updateTeam, getPersonal } from './team.service'

const { TextArea } = Input
const norm = v => String(v || '').trim()

function decodeJwtPayload(token) {
  try {
    const part = token?.split?.('.')?.[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default function TeamModal({ team, onClose, onSaved }) {
  const auth = useContext(AuthContext)
  const token = auth?.token
  const isEdit = !!team?._id

  const [nombre, setNombre] = useState(team?.nombre || '')
  const [descripcion, setDescripcion] = useState(team?.descripcion || '')
  const [activo, setActivo] = useState(team?.activo ?? true)

  const [personalIds, setPersonalIds] = useState(
    Array.isArray(team?.personal_ids) ? team.personal_ids.map(String) : []
  )

  // ✅ ahora ES opcional
  const [liderId, setLiderId] = useState(
    team?.lider_id_personal ? String(team.lider_id_personal) : ''
  )

  // ✅ creador requerido por tu POST /teams
  const [creatorIdPersonal, setCreatorIdPersonal] = useState('')

  const [personal, setPersonal] = useState([])
  const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    let mounted = true

    setLoadingPersonal(true)
    setError(null)
    ;(async () => {
      try {
        const payload = decodeJwtPayload(token)
        const idUsuario = payload?.id_usuario

        const p = await getPersonal(token)
        const list = Array.isArray(p) ? p : []

        if (!mounted) return
        setPersonal(list)

        const me = list.find(x => Number(x?.id_usuario) === Number(idUsuario))
        const myPersonalId = me?.Id_personal ? String(me.Id_personal) : ''
        setCreatorIdPersonal(myPersonalId)

        if (!myPersonalId && !isEdit) {
          setError(
            'No pude asociar tu usuario a un Id_personal. Revisa que /personal tenga id_usuario para tu usuario logueado.'
          )
        }
      } catch (e) {
        if (!mounted) return
        setError(getErrorMsg(e) || 'Error cargando personal')
      } finally {
        if (!mounted) setLoadingPersonal(false)
      }
    })()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const personalById = useMemo(() => {
    const map = new Map()
    for (const p of personal) map.set(String(p.Id_personal), p)
    return map
  }, [personal])

  const options = useMemo(() => {
    return personal
      .slice()
      .sort((a, b) =>
        `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`)
      )
      .map(p => {
        const id = String(p.Id_personal)
        return { value: id, label: `${p.Nombre} ${p.Apellido} (${id})` }
      })
  }, [personal])

  const selectedPeople = useMemo(() => {
    return personalIds.map(id => personalById.get(String(id))).filter(Boolean)
  }, [personalIds, personalById])

  function onChangePersonal(vals) {
    const next = (vals || []).map(String)
    // si hay líder, lo forzamos dentro de miembros
    if (liderId && !next.includes(liderId)) next.push(liderId)
    setPersonalIds(next)
  }

  function onChangeLider(id) {
    const val = String(id || '')
    setLiderId(val)

    // si se elige líder, forzarlo dentro de miembros
    setPersonalIds(prev => {
      const arr = Array.isArray(prev) ? prev.map(String) : []
      if (!val) return arr
      return arr.includes(val) ? arr : [...arr, val]
    })
  }

  async function handleSubmit() {
    const n = norm(nombre)
    if (!n) return setError('El nombre es requerido.')

    // ✅ líder NO obligatorio
    if (liderId && !personalIds.includes(liderId)) {
      return setError('El líder debe estar dentro de los miembros.')
    }

    // ✅ en crear, tu API requiere id_personal (creador)
    if (!isEdit && !creatorIdPersonal) {
      return setError(
        'No se pudo determinar tu Id_personal (creador) desde /personal.'
      )
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        id_personal: creatorIdPersonal, // requerido en POST
        nombre: n,
        descripcion: norm(descripcion),
        personal_ids: personalIds,
        // opcional:
        lider_id_personal: liderId ? liderId : null,
        // si tu backend lo usa:
        activo: !!activo,
      }

      if (isEdit) {
        await updateTeam(team._id, payload, token)
      } else {
        await createTeam(payload, token)
      }

      onSaved?.()
    } catch (e) {
      setError(getErrorMsg(e) || 'No se pudo guardar el team.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      centered
      width={920}
      title={isEdit ? 'Editar team' : 'Crear team'}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear'}
      cancelText='Cancelar'
      confirmLoading={saving}
      destroyOnClose
    >
      {error && (
        <Alert
          type='error'
          showIcon
          message={error}
          style={{ marginBottom: 12 }}
        />
      )}

      <div className='row g-3'>
        <div className='col-12 col-md-7'>
          <label className='form-label fw-semibold'>Nombre</label>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder='Ej: Equipo Operaciones'
          />
        </div>

        <div className='col-12 col-md-5'>
          <label className='form-label fw-semibold d-block'>Estado</label>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            <Switch checked={!!activo} onChange={setActivo} />
            <span style={{ color: '#6c757d' }}>
              {activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className='col-12'>
          <label className='form-label fw-semibold'>Descripción</label>
          <TextArea
            rows={3}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
          />
        </div>

        {/* ✅ Lider opcional */}
        <div className='col-12 col-md-6'>
          <label className='form-label fw-semibold'>Líder (opcional)</label>
          <Select
            showSearch
            allowClear
            placeholder='(Opcional) Selecciona el líder…'
            loading={loadingPersonal}
            value={liderId || undefined}
            onChange={onChangeLider}
            options={options}
            optionFilterProp='label'
            style={{ width: '100%' }}
          />
          <div className='text-muted small mt-1'>
            Si eliges líder, se agrega automáticamente a los miembros.
          </div>
        </div>

        {/* Miembros */}
        <div className='col-12 col-md-6'>
          <label className='form-label fw-semibold'>
            Miembros (personal_ids)
          </label>
          <Select
            mode='multiple'
            allowClear
            showSearch
            loading={loadingPersonal}
            placeholder='Buscar por nombre o ID…'
            value={personalIds}
            onChange={onChangePersonal}
            options={options}
            optionFilterProp='label'
            style={{ width: '100%' }}
            maxTagCount='responsive'
          />
        </div>

        {selectedPeople.length > 0 && (
          <div className='col-12'>
            <div className='text-muted small fw-semibold mb-2'>
              Seleccionados
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedPeople.map(p => {
                const id = String(p.Id_personal)
                const isLeader = liderId && id === liderId
                return (
                  <Tag
                    key={id}
                    color={isLeader ? 'blue' : undefined}
                    closable={
                      !isLeader || !liderId /* si no hay lider, normal */
                    }
                    onClose={e => {
                      e.preventDefault()
                      setPersonalIds(prev => prev.filter(x => x !== id))
                    }}
                    style={{ padding: '6px 10px', borderRadius: 999 }}
                    title={`${p.Nombre} ${p.Apellido} (${id})`}
                  >
                    {p.Nombre} {p.Apellido}{' '}
                    <span style={{ color: '#6c757d' }}>({id})</span>
                    {isLeader ? ' · Líder' : ''}
                  </Tag>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function getErrorMsg(e) {
  return (
    e?.response?.data?.error || e?.response?.data?.message || e?.message || ''
  )
}
