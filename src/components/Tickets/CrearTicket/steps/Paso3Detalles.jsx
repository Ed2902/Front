import React from 'react'

export default function Paso3Detalles({
  data,
  setData,
  loading,
  creadoPorLabel,
  resumen,
  personal = [],
}) {
  const toggleWatcher = idRaw => {
    const id = String(idRaw ?? '').trim()
    if (!id) return

    setData(s => {
      const curr = Array.isArray(s.watchers) ? s.watchers : []
      const set = new Set(curr.map(x => String(x ?? '').trim()).filter(Boolean))
      set.has(id) ? set.delete(id) : set.add(id)
      return { ...s, watchers: [...set] }
    })
  }

  const watchers = Array.isArray(data.watchers)
    ? data.watchers.map(x => String(x ?? '').trim()).filter(Boolean)
    : []

  return (
    <div>
      <h6 className='fw-bold mb-2'>Paso 3 — Detalles</h6>
      <p className='text-muted small mb-3'>
        Describe la tarea, define fecha estimada y quiénes pueden seguir el
        ticket.
      </p>

      <div className='row g-2'>
        <div className='col-12 col-md-8'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='mb-2 fw-bold'>Título</div>
              <input
                className='form-control'
                value={data.titulo}
                onChange={e => setData(s => ({ ...s, titulo: e.target.value }))}
                placeholder='Ej: Mantenimiento de PC en recepción'
                disabled={loading}
              />

              <div className='mt-3 mb-2 fw-bold'>Descripción</div>
              <textarea
                className='form-control'
                rows={5}
                value={data.descripcion}
                onChange={e =>
                  setData(s => ({ ...s, descripcion: e.target.value }))
                }
                placeholder='¿Qué pasa? ¿Dónde? ¿Desde cuándo? ¿Impacto?'
                disabled={loading}
              />

              {/* ✅ NUEVO: Fecha estimada */}
              <div className='mt-3 mb-2 fw-bold'>Fecha estimada</div>
              <input
                className='form-control'
                type='date'
                value={data.fecha_estimada || ''}
                onChange={e =>
                  setData(s => ({
                    ...s,
                    fecha_estimada: e.target.value || '',
                  }))
                }
                disabled={loading}
              />
              <div className='text-muted small mt-2'>
                Opcional. Fecha objetivo para resolver el ticket.
              </div>

              {/* ✅ NUEVO: Watchers */}
              <div className='mt-3 mb-2 fw-bold'>Watchers (seguidores)</div>
              <div
                className='border rounded p-2'
                style={{ maxHeight: 180, overflowY: 'auto' }}
              >
                {Array.isArray(personal) && personal.length ? (
                  personal.map(p => {
                    // ✅ Igual que Paso 1: soporta mayúsculas y minúsculas
                    const id = String(
                      p?.Id_personal ?? p?.id_personal ?? ''
                    ).trim()
                    if (!id) return null

                    const nombre = String(p?.Nombre ?? p?.nombre ?? '').trim()
                    const apellido = String(
                      p?.Apellido ?? p?.apellido ?? ''
                    ).trim()
                    const label = `${nombre} ${apellido}`.trim() || id

                    const checked = watchers.includes(id)

                    return (
                      <div key={id} className='form-check small'>
                        <input
                          className='form-check-input'
                          type='checkbox'
                          id={`watcher-${id}`}
                          checked={checked}
                          onChange={() => toggleWatcher(id)}
                          disabled={loading}
                        />
                        <label
                          className='form-check-label'
                          htmlFor={`watcher-${id}`}
                        >
                          {label}
                        </label>
                      </div>
                    )
                  })
                ) : (
                  <div className='text-muted small'>
                    Sin personal disponible.
                  </div>
                )}
              </div>
              <div className='text-muted small mt-2'>
                Personas que podrán ver el ticket aunque no lo hayan creado.
              </div>

              <div className='mt-3 mb-2 fw-bold'>Adjuntos (opcional)</div>
              <input
                className='form-control'
                type='file'
                multiple
                onChange={e =>
                  setData(s => ({
                    ...s,
                    files: Array.from(e.target.files || []),
                  }))
                }
                disabled={loading}
              />
              <div className='text-muted small mt-2'>
                {data.files?.length
                  ? `${data.files.length} archivo(s) seleccionado(s).`
                  : 'Sin archivos.'}
              </div>
            </div>
          </div>
        </div>

        <div className='col-12 col-md-4'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='fw-bold mb-2'>Resumen</div>

              <div className='small'>
                <div className='mb-2'>
                  <span className='text-muted'>Organización:</span>{' '}
                  <b>{resumen.org || '—'}</b>
                </div>
                <div className='mb-2'>
                  <span className='text-muted'>Asignado a:</span>
                  <div>
                    <b>{resumen.asignado || '—'}</b>
                  </div>
                </div>
                <div className='mb-2'>
                  <span className='text-muted'>Categoría:</span>
                  <div>
                    <b>{resumen.categoria || '—'}</b>
                  </div>
                </div>
                <div className='mb-2'>
                  <span className='text-muted'>Prioridad:</span>
                  <div>
                    <b>{resumen.prioridad || '—'}</b>
                  </div>
                </div>
                <div className='mb-2'>
                  <span className='text-muted'>Estado:</span>{' '}
                  <span className='badge text-bg-success'>
                    {resumen.estado || 'Nuevo'}
                  </span>
                </div>

                <hr />

                <div className='mb-1 text-muted'>Creador</div>
                <div className='fw-bold'>{creadoPorLabel || '—'}</div>
              </div>
            </div>
          </div>

          <div className='alert alert-light border mt-2 small mb-0'>
            Tip: agrega watchers si el ticket requiere visibilidad transversal.
          </div>
        </div>
      </div>
    </div>
  )
}
