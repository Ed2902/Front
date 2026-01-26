import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { listTeams, deactivateTeam, getPersonal } from './team.service'
import TeamModal from './TeamModal'

export default function Teams() {
  const { token } = useContext(AuthContext)

  const [teams, setTeams] = useState([])
  const [personal, setPersonal] = useState([])

  const [meta, setMeta] = useState({ page: 1, limit: 9, pages: 1, total: 0 })
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState(null)

  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState(null)

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
      await loadTeams(1, meta.limit)
    } catch (e) {
      showAlert('danger', getErrorMsg(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadTeams(page = meta.page, limit = meta.limit) {
    setLoading(true)
    setAlert(null)
    try {
      const res = await listTeams({ page, limit }, token)
      const items = Array.isArray(res?.items) ? res.items : []
      const m = res?.meta || {}

      setTeams(items)
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

  function confirmarDesactivar(team) {
    AntdModal.confirm({
      centered: true,
      title: 'Desactivar team',
      content: `¿Seguro que deseas desactivar "${team?.nombre}"?`,
      okText: 'Sí, desactivar',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deactivateTeam(team._id, token)
        showAlert('success', 'Team desactivado.')
        await loadTeams(meta.page, meta.limit)
      },
    })
  }

  // pagination bootstrap numbers
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
          <h3 className='mb-0'>Teams</h3>
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
            onChange={e => loadTeams(1, Number(e.target.value))}
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
              setEditing(null)
              setOpenModal(true)
            }}
          >
            + Crear team
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type} py-2`}>{alert.text}</div>
      )}

      <div className='row g-3'>
        {teams.map(t => (
          <div key={t._id} className='col-12 col-md-6 col-xl-4'>
            <div className='card h-100 shadow-sm'>
              <div className='card-body d-flex flex-column'>
                <div className='d-flex justify-content-between align-items-start gap-2'>
                  <div style={{ minWidth: 0 }}>
                    <div className='fw-bold' style={{ fontSize: 16 }}>
                      {t.nombre}
                    </div>
                    <div className='text-muted small'>
                      {t.descripcion || '—'}
                    </div>
                  </div>

                  <span
                    className={`badge ${t.activo ? 'bg-success' : 'bg-secondary'}`}
                  >
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <hr className='my-3' />

                <div className='text-muted small fw-semibold mb-1'>
                  Miembros
                </div>
                <div className='d-flex flex-wrap gap-1'>
                  {(Array.isArray(t.personal_ids) ? t.personal_ids : [])
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
                  {Array.isArray(t.personal_ids) &&
                    t.personal_ids.length > 6 && (
                      <span className='badge bg-dark'>
                        +{t.personal_ids.length - 6} más
                      </span>
                    )}
                  {(!Array.isArray(t.personal_ids) ||
                    t.personal_ids.length === 0) && (
                    <span className='text-muted small'>—</span>
                  )}
                </div>

                <div className='mt-auto d-flex gap-2 pt-3'>
                  <button
                    className='btn btn-outline-primary btn-sm'
                    onClick={() => {
                      setEditing(t)
                      setOpenModal(true)
                    }}
                  >
                    Editar
                  </button>

                  {/* ✅ solo desactivar si está activo */}
                  {t.activo ? (
                    <button
                      className='btn btn-outline-danger btn-sm'
                      onClick={() => confirmarDesactivar(t)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <span className='text-muted small align-self-center'>
                      (Sin activar)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && teams.length === 0 && (
          <div className='col-12'>
            <div className='card shadow-sm'>
              <div className='card-body text-center text-muted py-5'>
                No hay teams registrados.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className='d-flex justify-content-end mt-3'>
        <nav>
          <ul className='pagination mb-0'>
            <li
              className={`page-item ${page <= 1 || loading ? 'disabled' : ''}`}
            >
              <button
                className='page-link'
                onClick={() => loadTeams(page - 1, meta.limit)}
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
                    onClick={() => loadTeams(1, meta.limit)}
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
                  onClick={() => loadTeams(p, meta.limit)}
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
                    onClick={() => loadTeams(pages, meta.limit)}
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
                onClick={() => loadTeams(page + 1, meta.limit)}
                disabled={page >= pages || loading}
              >
                Siguiente
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {openModal && (
        <TeamModal
          team={editing}
          onClose={() => setOpenModal(false)}
          onSaved={async () => {
            setOpenModal(false)
            showAlert(
              'success',
              editing?._id ? 'Team actualizado.' : 'Team creado.'
            )
            await loadTeams(meta.page, meta.limit)
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
