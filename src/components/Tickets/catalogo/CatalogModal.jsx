import { useContext, useEffect, useState } from 'react'
import { Modal, Input, Switch, Alert, Select } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { createCatalog, updateCatalog } from './catalog.service'

const { TextArea } = Input
const norm = v => String(v || '').trim()

const ORGS = ['FastwaySAS', 'GreenWay', 'MetalHasrvest']
const TYPES = [
  'categoria',
  'prioridad',
  'estado',
  'servicio_operacion',
  'motivo_cancelacion',
]

export default function CatalogModal({
  item, // null = crear
  orgId,
  type,
  onClose,
  onSaved,
}) {
  const { token } = useContext(AuthContext)
  const isEdit = !!item?._id

  const [fOrgId, setFOrgId] = useState(item?.orgId || orgId || ORGS[0])
  const [fType, setFType] = useState(item?.type || type || 'estado')
  const [code, setCode] = useState(item?.code || '')
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [color, setColor] = useState(item?.color || '#16a34a')
  const [order, setOrder] = useState(item?.order ?? 1)
  const [active, setActive] = useState(item?.active ?? true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // si cambian orgId/type desde fuera (cuando abres modal desde otra pestaña)
  useEffect(() => {
    if (!isEdit) {
      setFOrgId(orgId || ORGS[0])
      setFType(type || 'estado')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, type])

  const title = isEdit ? 'Editar catálogo' : 'Crear catálogo'

  async function handleSubmit() {
    const payload = {
      orgId: norm(fOrgId),
      type: norm(fType),
      code: norm(code),
      name: norm(name),
      description: norm(description),
      color: norm(color),
      order: Number(order ?? 1),
      active: !!active,
    }

    // validaciones mínimas
    if (!payload.orgId) return setError('orgId es obligatorio.')
    if (!payload.type) return setError('type es obligatorio.')
    if (!payload.code) return setError('code es obligatorio.')
    if (!payload.name) return setError('name es obligatorio.')

    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        // PUT /catalog/:id?orgId=ID  (orgId obligatorio)
        await updateCatalog(item._id, payload.orgId, payload, token)
      } else {
        // POST /catalog
        await createCatalog(payload, token)
      }
      onSaved?.()
    } catch (e) {
      setError(getErrorMsg(e) || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      centered
      width={900}
      title={title}
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
        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold'>Empresa (orgId)</label>
          <Select
            value={fOrgId}
            onChange={setFOrgId}
            options={ORGS.map(o => ({ value: o, label: o }))}
            style={{ width: '100%' }}
            disabled={isEdit} // si quieres permitir cambiar orgId al editar, quita esto
          />
        </div>

        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold'>Tipo (type)</label>
          <Select
            value={fType}
            onChange={setFType}
            options={TYPES.map(t => ({ value: t, label: t }))}
            style={{ width: '100%' }}
            disabled={isEdit} // si quieres permitir cambiar type al editar, quita esto
          />
        </div>

        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold d-block'>Activo</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 6,
            }}
          >
            <Switch checked={!!active} onChange={setActive} />
            <span style={{ color: '#6c757d' }}>
              {active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold'>Código (code)</label>
          <Input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder='Ej: NUEVO'
          />
        </div>

        <div className='col-12 col-md-8'>
          <label className='form-label fw-semibold'>Nombre (name)</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='Ej: Nuevo'
          />
        </div>

        <div className='col-12'>
          <label className='form-label fw-semibold'>Descripción</label>
          <TextArea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold'>Color</label>
          <div className='d-flex gap-2 align-items-center'>
            <input
              type='color'
              className='form-control form-control-color'
              value={color}
              onChange={e => setColor(e.target.value)}
              title='Seleccionar color'
              style={{ width: 60 }}
            />
            <Input value={color} onChange={e => setColor(e.target.value)} />
          </div>
        </div>

        <div className='col-12 col-md-4'>
          <label className='form-label fw-semibold'>Orden</label>
          <Input
            type='number'
            value={order}
            min={0}
            onChange={e => setOrder(e.target.value)}
          />
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
