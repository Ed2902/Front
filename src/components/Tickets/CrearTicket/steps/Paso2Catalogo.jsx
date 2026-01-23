import React, { useMemo } from 'react'

const safeText = v => String(v ?? '').trim()

const buildLabel = (name, description, max = 40) => {
  const n = safeText(name)
  const d = safeText(description)

  if (!d) return n
  const shortDesc = d.length > max ? `${d.slice(0, max)}…` : d
  return `${n} (${shortDesc})`
}

export default function Paso2Catalogo({ data, setData, loading, cats, pris }) {
  const categorias = useMemo(() => {
    return Array.isArray(cats)
      ? cats
          .filter(c => c?.active === true)
          .sort((a, b) => (a?.order ?? 999) - (b?.order ?? 999))
      : []
  }, [cats])

  const prioridades = useMemo(() => {
    return Array.isArray(pris)
      ? pris
          .filter(p => p?.active === true)
          .sort((a, b) => (a?.order ?? 999) - (b?.order ?? 999))
      : []
  }, [pris])

  const selectedCategoria =
    categorias.find(c => c._id === data.categoria_id) || null
  const selectedPrioridad =
    prioridades.find(p => p._id === data.prioridad_id) || null

  const onCategoria = e => {
    const id = e.target.value
    const obj = categorias.find(c => c._id === id)

    setData(s => ({
      ...s,
      categoria_id: id,
      categoria_label: obj ? buildLabel(obj.name, obj.description) : '',
      categoria_color: obj?.color || '',
    }))
  }

  const onPrioridad = e => {
    const id = e.target.value
    const obj = prioridades.find(p => p._id === id)

    setData(s => ({
      ...s,
      prioridad_id: id,
      prioridad_label: obj ? buildLabel(obj.name, obj.description) : '',
      prioridad_color: obj?.color || '',
    }))
  }

  return (
    <div>
      <h6 className='fw-bold mb-2'>Paso 2 — Catálogo</h6>
      <p className='text-muted small mb-3'>
        Selecciona categoría y prioridad según la organización.
      </p>

      <div className='row g-3'>
        {/* Categoría */}
        <div className='col-12 col-md-6'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='fw-bold mb-2'>Categoría</div>

              <select
                className='form-select'
                value={data.categoria_id}
                onChange={onCategoria}
                disabled={loading}
              >
                <option value=''>-- selecciona --</option>
                {categorias.map(c => (
                  <option key={c._id} value={c._id}>
                    {buildLabel(c.name, c.description)}
                  </option>
                ))}
              </select>

              {selectedCategoria && (
                <div className='mt-2'>
                  <span
                    className='badge'
                    style={{
                      background: selectedCategoria.color,
                      color: '#fff',
                      borderRadius: 999,
                      fontWeight: 600,
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'inline-block',
                    }}
                  >
                    {buildLabel(
                      selectedCategoria.name,
                      selectedCategoria.description,
                      60
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prioridad */}
        <div className='col-12 col-md-6'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='fw-bold mb-2'>Prioridad</div>

              <select
                className='form-select'
                value={data.prioridad_id}
                onChange={onPrioridad}
                disabled={loading}
              >
                <option value=''>-- selecciona --</option>
                {prioridades.map(p => (
                  <option key={p._id} value={p._id}>
                    {buildLabel(p.name, p.description)}
                  </option>
                ))}
              </select>

              {selectedPrioridad && (
                <div className='mt-2'>
                  <span
                    className='badge'
                    style={{
                      background: selectedPrioridad.color,
                      color: '#fff',
                      borderRadius: 999,
                      fontWeight: 600,
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'inline-block',
                    }}
                  >
                    {buildLabel(
                      selectedPrioridad.name,
                      selectedPrioridad.description,
                      60
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Estado fijo */}
      <div className='alert alert-light border mt-3 mb-0'>
        <div className='fw-bold'>Estado</div>
        <div className='small text-muted'>Se crea automáticamente como</div>
        <span className='badge text-bg-success mt-1'>Nuevo</span>
      </div>
    </div>
  )
}
