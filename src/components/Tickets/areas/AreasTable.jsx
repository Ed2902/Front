import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'

import {
  listAreas,
  getPersonal,
  deactivateArea,
  updateArea,
} from './area.service'

import AreaModal from './AreaModal' // ✅ ESTE ES EL NUEVO

export default function AreasTable() {
  const { token } = useContext(AuthContext)

  const [areas, setAreas] = useState([])
  const [personal, setPersonal] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 9, pages: 1, total: 0 })
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState(null)

  const [openModal, setOpenModal] = useState(false)
  const [editingArea, setEditingArea] = useState(null)

  const didInit = useRef(false)

  useEffect(() => {
    if (!token) return
    if (didInit.current) return
    didInit.current = true
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function boot() {
    setLoading(true)
    setAlert(null)
    try {
      const p = await getPersonal(token)
      setPersonal(Array.isArray(p) ? p : [])
      await loadAreas(1, meta.limit)
    } catch (e) {
      showAlert('danger', getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadAreas(page = meta.page, limit = meta.limit) {
    setLoading(true)
    setAlert(null)
    try {
      const res = await listAreas({ page, limit }, token)
      const items = Array.isArray(res?.items) ? res.items : []
      const m = res?.meta || {}

      setAreas(items)
      setMeta(prev => ({
        ...prev,
        page: Number(m.page ?? page),
        limit: Number(m.limit ?? limit),
        pages: Number(m.pages ?? 1),
        total: Number(m.total ?? items.length ?? 0),
      }))
    } catch (e) {
      showAlert('danger', getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  function showAlert(type, text) {
    setAlert({ type, text })
    window.clearTimeout(showAlert._t)
    showAlert._t = window.setTimeout(() => setAlert(null), 2500)
  }

  // ===== Personal label helper (para chips en cards) =====
  const personalMap = useMemo(() => {
    const map = new Map()
    for (const p of personal) map.set(String(p.Id_personal), p)
    return map
  }, [personal])

  const personalLabel = id => {
    const p = personalMap.get(String(id))
    return p
      ? `${p.Nombre} ${p.Apellido} (${p.Id_personal})`
      : `Desconocido (${id})`
  }

  // ===== activate/deactivate confirm =====
  function confirmarDesactivar(area) {
    AntdModal.confirm({
      centered: true,
      title: 'Desactivar área',
      content: `¿Seguro que deseas desactivar "${area?.nombre}"?`,
      okText: 'Sí, desactivar',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deactivateArea(area._id, token)
        showAlert('success', 'Área desactivada.')
        await loadAreas(meta.page, meta.limit)
      },
    })
  }

  function confirmarActivar(area) {
    AntdModal.confirm({
      centered: true,
      title: 'Activar área',
      content: `¿Seguro que deseas activar "${area?.nombre}"?`,
      okText: 'Sí, activar',
      cancelText: 'Cancelar',
      onOk: async () => {
        await updateArea(
          area._id,
          {
            nombre: area.nombre,
            descripcion: area.descripcion,
            personal_ids: area.personal_ids || [],
            activo: true,
          },
          token
        )
        showAlert('success', 'Área activada.')
        await loadAreas(meta.page, meta.limit)
      },
    })
  }

  // ===== pagination bootstrap numbers =====
  const pages = Math.max(1, Number(meta.pages || 1))
  const page = Math.min(Math.max(1, Number(meta.page || 1)), pages)

  const pageArr = useMemo(() => {
    const windowSize = 5
    let start = Math.max(1, page - Math.floor(windowSize / 2))
    let end = Math.min(pages, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    const arr = []
    for (let i = start; i <= end; i++) arr.push(i)
    return { start, end, arr }
  }, [page, pages])

  return (
    <div className='container-fluid p-0'>
      <div className='d-flex flex-wrap gap-2 justify-content-between align-items-end mb-3'>
        <div>
          <h3 className='mb-0'>Áreas</h3>
          <div className='text-muted small'>
            Página <b>{page}</b> de {pages} · Total {meta.total || 0}
          </div>
        </div>

        <div className='d-flex gap-2 align-items-center'>
          <select
            className='form-select'
            style={{ width: 170 }}
            value={meta.limit}
            disabled={loading}
            onChange={e => loadAreas(1, Number(e.target.value))}
          >
            {[6, 9, 12, 18].map(n => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>

          <button
            className='btn btn-primary'
            onClick={() => {
              setEditingArea(null)
              setOpenModal(true)
            }}
          >
            + Crear área
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type} py-2`}>{alert.text}</div>
      )}

      {/* Cards */}
      <div className='row g-3'>
        {areas.map(a => (
          <div key={a._id} className='col-12 col-md-6 col-xl-4'>
            <div className='card h-100 shadow-sm'>
              <div className='card-body d-flex flex-column'>
                <div className='d-flex justify-content-between align-items-start gap-2'>
                  <div style={{ minWidth: 0 }}>
                    <div className='fw-bold' style={{ fontSize: 16 }}>
                      {a.nombre}
                    </div>
                    <div className='text-muted small'>
                      {a.descripcion || '—'}
                    </div>
                  </div>

                  <span
                    className={`badge ${a.activo ? 'bg-success' : 'bg-secondary'}`}
                  >
                    {a.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <hr className='my-3' />

                <div className='text-muted small fw-semibold mb-1'>
                  Personal
                </div>
                <div className='d-flex flex-wrap gap-1'>
                  {(Array.isArray(a.personal_ids) ? a.personal_ids : [])
                    .slice(0, 6)
                    .map(id => (
                      <span
                        key={id}
                        className='badge bg-light text-dark border'
                        title={personalLabel(id)}
                        style={{ borderRadius: 12 }}
                      >
                        {personalLabel(id)}
                      </span>
                    ))}
                  {Array.isArray(a.personal_ids) &&
                    a.personal_ids.length > 6 && (
                      <span className='badge bg-dark'>
                        +{a.personal_ids.length - 6} más
                      </span>
                    )}
                  {(!Array.isArray(a.personal_ids) ||
                    a.personal_ids.length === 0) && (
                    <span className='text-muted small'>—</span>
                  )}
                </div>

                <div className='mt-auto d-flex gap-2 pt-3'>
                  <button
                    className='btn btn-outline-primary btn-sm'
                    onClick={() => {
                      setEditingArea(a)
                      setOpenModal(true)
                    }}
                  >
                    Editar
                  </button>

                  {a.activo ? (
                    <button
                      className='btn btn-outline-danger btn-sm'
                      onClick={() => confirmarDesactivar(a)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      className='btn btn-outline-success btn-sm'
                      onClick={() => confirmarActivar(a)}
                    >
                      Activar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && areas.length === 0 && (
          <div className='col-12'>
            <div className='card shadow-sm'>
              <div className='card-body text-center text-muted py-5'>
                No hay áreas registradas.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className='d-flex justify-content-end mt-3'>
        <nav>
          <ul className='pagination mb-0'>
            <li
              className={`page-item ${page <= 1 || loading ? 'disabled' : ''}`}
            >
              <button
                className='page-link'
                onClick={() => loadAreas(page - 1, meta.limit)}
                disabled={page <= 1 || loading}
              >
                Anterior
              </button>
            </li>

            {pageArr.start > 1 && (
              <>
                <li className='page-item'>
                  <button
                    className='page-link'
                    onClick={() => loadAreas(1, meta.limit)}
                    disabled={loading}
                  >
                    1
                  </button>
                </li>
                {pageArr.start > 2 && (
                  <li className='page-item disabled'>
                    <span className='page-link'>…</span>
                  </li>
                )}
              </>
            )}

            {pageArr.arr.map(p => (
              <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                <button
                  className='page-link'
                  onClick={() => loadAreas(p, meta.limit)}
                  disabled={loading}
                >
                  {p}
                </button>
              </li>
            ))}

            {pageArr.end < pages && (
              <>
                {pageArr.end < pages - 1 && (
                  <li className='page-item disabled'>
                    <span className='page-link'>…</span>
                  </li>
                )}
                <li className='page-item'>
                  <button
                    className='page-link'
                    onClick={() => loadAreas(pages, meta.limit)}
                    disabled={loading}
                  >
                    {pages}
                  </button>
                </li>
              </>
            )}

            <li
              className={`page-item ${page >= pages || loading ? 'disabled' : ''}`}
            >
              <button
                className='page-link'
                onClick={() => loadAreas(page + 1, meta.limit)}
                disabled={page >= pages || loading}
              >
                Siguiente
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* ✅ Aquí se abre el modal nuevo */}
      {openModal && (
        <AreaModal
          area={editingArea}
          onClose={() => setOpenModal(false)}
          onSaved={async () => {
            setOpenModal(false)
            showAlert(
              'success',
              editingArea?._id ? 'Área actualizada.' : 'Área creada.'
            )
            await loadAreas(meta.page, meta.limit)
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
