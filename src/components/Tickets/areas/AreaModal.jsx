import { useContext, useEffect, useMemo, useState } from 'react'
import { Modal, Select, Tag, Input, Switch, Alert, Divider } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { createArea, updateArea, getPersonal } from './area.service'

const { TextArea } = Input
const norm = v => String(v || '').trim()

export default function AreaModal({ area, onClose, onSaved }) {
  const { token } = useContext(AuthContext)
  const isEdit = !!area?._id

  const [nombre, setNombre] = useState(area?.nombre || '')
  const [descripcion, setDescripcion] = useState(area?.descripcion || '')
  const [activo, setActivo] = useState(area?.activo ?? true)
  const [personalIds, setPersonalIds] = useState(
    Array.isArray(area?.personal_ids) ? area.personal_ids.map(String) : []
  )

  const [personal, setPersonal] = useState([])
  const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    let mounted = true
    setLoadingPersonal(true)

    getPersonal(token)
      .then(p => {
        if (!mounted) return
        setPersonal(Array.isArray(p) ? p : [])
      })
      .catch(e => {
        if (!mounted) return
        setError(getErrorMsg(e) || 'Error cargando personal')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingPersonal(false)
      })

    return () => {
      mounted = false
    }
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

  async function handleSubmit() {
    const n = norm(nombre)
    if (!n) {
      setError('El nombre es requerido.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        nombre: n,
        descripcion: norm(descripcion),
        personal_ids: personalIds,
        activo: !!activo,
      }

      if (isEdit) await updateArea(area._id, payload, token)
      else await createArea(payload, token)

      onSaved?.()
    } catch (e) {
      setError(getErrorMsg(e) || 'No se pudo guardar el área.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      centered
      title={isEdit ? 'Editar área' : 'Crear área'}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear'}
      cancelText='Cancelar'
      confirmLoading={saving}
      width={920}
      destroyOnClose
    >
      {error && (
        <Alert
          type='error'
          message={error}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      <div className='row g-3'>
        <div className='col-12 col-md-7'>
          <label className='form-label fw-semibold'>Nombre</label>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder='Ej: Logística int'
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
            placeholder='Descripción del área…'
          />
        </div>

        <div className='col-12'>
          <Divider style={{ margin: '8px 0 12px' }} />

          <label className='form-label fw-semibold'>Personal asignado</label>

          <Select
            mode='multiple'
            allowClear
            showSearch
            loading={loadingPersonal}
            placeholder='Buscar por nombre o ID…'
            value={personalIds}
            onChange={vals => setPersonalIds((vals || []).map(String))}
            options={options}
            optionFilterProp='label'
            style={{ width: '100%' }}
            maxTagCount='responsive'
          />

          {selectedPeople.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className='text-muted small fw-semibold mb-2'>
                Seleccionados
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedPeople.map(p => {
                  const id = String(p.Id_personal)
                  return (
                    <Tag
                      key={id}
                      closable
                      onClose={e => {
                        e.preventDefault()
                        setPersonalIds(prev => prev.filter(x => x !== id))
                      }}
                      style={{ padding: '6px 10px', borderRadius: 999 }}
                    >
                      {p.Nombre} {p.Apellido}{' '}
                      <span style={{ color: '#6c757d' }}>({id})</span>
                    </Tag>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function getErrorMsg(e) {
  return (
    e?.response?.data?.error || e?.response?.data?.message || e?.message || ''
  )
}
