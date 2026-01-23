import { useContext, useEffect, useRef, useState } from 'react'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'
import {
  deactivateCatalog,
  listCatalog,
  listCatalogAll,
} from './catalog.service'
import CatalogModal from './CatalogModal'

const ORGS = ['FastwaySAS', 'GreenWay', 'MetalHasrvest']
const TYPES = [
  'categoria',
  'prioridad',
  'estado',
  'servicio_operacion',
  'motivo_cancelacion',
]

export default function Catalogos() {
  const { token } = useContext(AuthContext)

  const [orgId, setOrgId] = useState('FastwaySAS')
  const [type, setType] = useState('estado')

  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, pages: 1, total: 0 })
  const [alert, setAlert] = useState(null)

  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const didInit = useRef(false)

  const isAllOrg = orgId === '__ALL__'
  const isAllType = type === '__ALL__'
  const isAllMode = isAllOrg || isAllType

  useEffect(() => {
    if (!token) return
    if (didInit.current) return
    didInit.current = true
    load(1, meta.limit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token || !didInit.current) return
    load(1, meta.limit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, type])

  function showAlert(kind, text) {
    setAlert({ kind, text })
    window.clearTimeout(showAlert._t)
    showAlert._t = window.setTimeout(() => setAlert(null), 2500)
  }

  async function load(page = 1, limit = 20) {
    try {
      if (isAllMode) {
        const orgIds = isAllOrg ? ORGS : [orgId]
        const types = isAllType ? TYPES : [type]

        const merged = await listCatalogAll(
          { orgIds, types, perQueryLimit: 100 },
          token
        )

        const total = merged.length
        const pages = Math.max(1, Math.ceil(total / limit))
        const safePage = Math.min(Math.max(1, page), pages)

        setItems(merged.slice((safePage - 1) * limit, safePage * limit))
        setMeta({ page: safePage, limit, pages, total })
      } else {
        const res = await listCatalog({ orgId, type, page, limit }, token)

        const list = Array.isArray(res?.items) ? res.items : []
        const m = res?.meta || {}

        setItems(list)
        setMeta({
          page: Number(m.page ?? page),
          limit: Number(m.limit ?? limit),
          pages: Number(m.pages ?? 1),
          total: Number(m.total ?? list.length ?? 0),
        })
      }
    } catch (e) {
      showAlert('danger', getErrorMsg(e))
    }
  }

  function openCreate() {
    setEditing(null)
    setOpenModal(true)
  }

  function openEdit(it) {
    setEditing(it)
    setOpenModal(true)
  }

  function confirmDeactivate(it) {
    const org = it.orgId || it._orgId || orgId

    AntdModal.confirm({
      centered: true,
      title: 'Desactivar ítem',
      content: `¿Seguro que deseas desactivar "${it?.name}" (${it?.code})?`,
      okText: 'Sí, desactivar',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deactivateCatalog(it._id, org, token)
          showAlert('success', 'Ítem desactivado.')
          await load(meta.page, meta.limit)
        } catch (e) {
          showAlert('danger', getErrorMsg(e))
        }
      },
    })
  }

  const pages = Math.max(1, Number(meta.pages || 1))
  const page = Math.min(Math.max(1, Number(meta.page || 1)), pages)

  return (
    <div className='container-fluid p-0'>
      <div className='d-flex flex-wrap gap-2 justify-content-between align-items-end mb-3'>
        <div>
          <h3 className='mb-0'>Catálogos</h3>
          <div className='text-muted small'>
            {isAllOrg ? 'Todas las empresas' : orgId} ·{' '}
            {isAllType ? 'Todos los tipos' : type} · Página <b>{page}</b> de{' '}
            {pages} · Total {meta.total}
          </div>
        </div>

        <div className='d-flex flex-wrap gap-2 align-items-center'>
          <select
            className='form-select'
            style={{ width: 200 }}
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
          >
            <option value='__ALL__'>Todas las empresas</option>
            {ORGS.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            className='form-select'
            style={{ width: 240 }}
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value='__ALL__'>Todos los tipos</option>
            {TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button className='btn btn-primary' onClick={openCreate}>
            + Crear
          </button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.kind}`}>{alert.text}</div>}

      <div className='row g-3'>
        {items.map(it => (
          <div key={it._id} className='col-12 col-md-6 col-xl-4'>
            <div className='card h-100 shadow-sm'>
              <div className='card-body d-flex flex-column'>
                <div className='fw-bold'>
                  {it.name} <span className='text-muted'>({it.code})</span>
                </div>

                <div className='text-muted small mb-2'>
                  {it.description || '—'}
                </div>

                <span
                  className={`badge ${it.active ? 'bg-success' : 'bg-secondary'}`}
                >
                  {it.active ? 'Activo' : 'Inactivo'}
                </span>

                <div className='mt-auto d-flex gap-2 pt-3'>
                  <button
                    className='btn btn-outline-primary btn-sm'
                    onClick={() => openEdit(it)}
                  >
                    Editar
                  </button>

                  {it.active && (
                    <button
                      className='btn btn-outline-danger btn-sm'
                      onClick={() => confirmDeactivate(it)}
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className='col-12'>
            <div className='card shadow-sm'>
              <div className='card-body text-center text-muted py-5'>
                No hay ítems para esta selección.
              </div>
            </div>
          </div>
        )}
      </div>

      {openModal && (
        <CatalogModal
          item={editing}
          orgId={orgId === '__ALL__' ? ORGS[0] : orgId}
          type={type === '__ALL__' ? TYPES[0] : type}
          onClose={() => setOpenModal(false)}
          onSaved={async () => {
            setOpenModal(false)
            showAlert(
              'success',
              editing ? 'Catálogo actualizado.' : 'Catálogo creado.'
            )
            await load(meta.page, meta.limit)
          }}
        />
      )}
    </div>
  )
}

function getErrorMsg(e) {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    'Error inesperado'
  )
}
