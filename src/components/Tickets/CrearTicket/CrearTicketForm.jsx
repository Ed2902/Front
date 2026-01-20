import { useEffect, useMemo, useState } from 'react'
import {
  crearTicket,
  listarCategorias,
  listarPrioridades,
  listarEstados,
  listarTeams,
  listarAreas,
} from './service.CrearTicket.js'

const initial = {
  orgId: '',
  creado_por: '',
  tipo: 'tarea', // tarea|proyecto|operacion

  titulo: '',
  descripcion: '',
  categoria_id: '',
  prioridad_id: '',
  estado_id: '',

  fecha_estimada: '',
  nota_estado: '',

  asignado_tipo: 'personal', // personal|area|team
  asignado_id: '',

  watchersText: '', // CSV
  files: [],

  // operación
  operacion_subtipo: 'comercio', // comercio|bodega
  operacion_cliente: '',
  operacion_lote: '',
  operacion_producto: '',
  operacion_apoyo_text: '', // CSV id_personal
  operacion_servicios_text: '', // CSV strings
}

export default function CrearTicketForm({ token }) {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [resp, setResp] = useState(null)
  const [err, setErr] = useState(null)

  const [cats, setCats] = useState([])
  const [pris, setPris] = useState([])
  const [ests, setEsts] = useState([])
  const [teams, setTeams] = useState([])
  const [areas, setAreas] = useState([])

  // Helpers
  const watchers = useMemo(() => {
    return (form.watchersText || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
  }, [form.watchersText])

  const operacion_apoyo_ids = useMemo(() => {
    return (form.operacion_apoyo_text || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
  }, [form.operacion_apoyo_text])

  const operacion_servicios_adicionales = useMemo(() => {
    return (form.operacion_servicios_text || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
  }, [form.operacion_servicios_text])

  const onChange = e => {
    const { name, value } = e.target
    setForm(s => ({ ...s, [name]: value }))
  }

  const onFiles = e => {
    const files = Array.from(e.target.files || [])
    setForm(s => ({ ...s, files }))
  }

  // Cargar catálogos cuando haya orgId
  useEffect(() => {
    let alive = true

    const run = async () => {
      setErr(null)
      setResp(null)
      if (!form.orgId || !token) return

      try {
        const [c, p, es, t, a] = await Promise.all([
          listarCategorias(form.orgId, token),
          listarPrioridades(form.orgId, token),
          listarEstados(form.orgId, token),
          listarTeams({ page: 1, limit: 100 }, token),
          listarAreas({ page: 1, limit: 100 }, token),
        ])

        if (!alive) return

        const pick = r =>
          r?.items ||
          r?.data ||
          r?.rows ||
          r?.results ||
          (Array.isArray(r) ? r : [])

        setCats(pick(c))
        setPris(pick(p))
        setEsts(pick(es))
        setTeams(pick(t))
        setAreas(pick(a))
      } catch (e) {
        if (!alive) return
        setErr(e?.response?.data || e?.message || 'Error cargando catálogos')
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [form.orgId, token])

  const assignOptions = useMemo(() => {
    if (form.asignado_tipo === 'team')
      return teams.map(x => ({ id: x._id, name: x.nombre || x.name || x._id }))
    if (form.asignado_tipo === 'area')
      return areas.map(x => ({ id: x._id, name: x.nombre || x.name || x._id }))
    return []
  }, [form.asignado_tipo, teams, areas])

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    setResp(null)

    try {
      const payload = {
        ...form,
        watchers,
        operacion_apoyo_ids,
        operacion_servicios_adicionales,
      }

      if (!payload.fecha_estimada) delete payload.fecha_estimada

      const res = await crearTicket(payload, token)
      setResp(res)

      setForm(s => ({
        ...initial,
        orgId: s.orgId,
        creado_por: s.creado_por,
      }))
    } catch (e) {
      setErr(e?.response?.data || e?.message || 'Error creando ticket')
    } finally {
      setLoading(false)
    }
  }

  const showOperacion = form.tipo === 'operacion'

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Crear Ticket</h2>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <fieldset style={{ border: '1px solid #ddd', padding: 12 }}>
          <legend>Base</legend>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <label>
              orgId *
              <input
                name='orgId'
                value={form.orgId}
                onChange={onChange}
                placeholder='ORG-001'
              />
            </label>

            <label>
              creado_por (id_personal) *
              <input
                name='creado_por'
                value={form.creado_por}
                onChange={onChange}
                placeholder='1032485205'
              />
            </label>

            <label>
              tipo *
              <select name='tipo' value={form.tipo} onChange={onChange}>
                <option value='tarea'>tarea</option>
                <option value='proyecto'>proyecto</option>
                <option value='operacion'>operacion</option>
              </select>
            </label>

            <label>
              fecha_estimada (opcional)
              <input
                name='fecha_estimada'
                value={form.fecha_estimada}
                onChange={onChange}
                placeholder='2026-02-15'
              />
            </label>
          </div>

          <label>
            titulo *
            <input name='titulo' value={form.titulo} onChange={onChange} />
          </label>

          <label>
            descripcion *
            <textarea
              name='descripcion'
              value={form.descripcion}
              onChange={onChange}
              rows={3}
            />
          </label>

          <label>
            nota_estado (opcional)
            <input
              name='nota_estado'
              value={form.nota_estado}
              onChange={onChange}
              placeholder='Nota inicial'
            />
          </label>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: 12 }}>
          <legend>Catálogo</legend>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <label>
              categoria_id *
              <select
                name='categoria_id'
                value={form.categoria_id}
                onChange={onChange}
              >
                <option value=''>-- selecciona --</option>
                {cats.map(x => (
                  <option key={x._id} value={x._id}>
                    {x.nombre || x.name || x._id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              prioridad_id *
              <select
                name='prioridad_id'
                value={form.prioridad_id}
                onChange={onChange}
              >
                <option value=''>-- selecciona --</option>
                {pris.map(x => (
                  <option key={x._id} value={x._id}>
                    {x.nombre || x.name || x._id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              estado_id *
              <select
                name='estado_id'
                value={form.estado_id}
                onChange={onChange}
              >
                <option value=''>-- selecciona --</option>
                {ests.map(x => (
                  <option key={x._id} value={x._id}>
                    {x.nombre || x.name || x._id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: 12 }}>
          <legend>Asignación</legend>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <label>
              asignado_tipo *
              <select
                name='asignado_tipo'
                value={form.asignado_tipo}
                onChange={onChange}
              >
                <option value='personal'>personal</option>
                <option value='area'>area</option>
                <option value='team'>team</option>
              </select>
            </label>

            {form.asignado_tipo === 'personal' ? (
              <label>
                asignado_id (id_personal) *
                <input
                  name='asignado_id'
                  value={form.asignado_id}
                  onChange={onChange}
                  placeholder='1032485205'
                />
              </label>
            ) : (
              <label>
                asignado_id *
                <select
                  name='asignado_id'
                  value={form.asignado_id}
                  onChange={onChange}
                >
                  <option value=''>-- selecciona --</option>
                  {assignOptions.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label>
            watchers (CSV id_personal) opcional
            <input
              name='watchersText'
              value={form.watchersText}
              onChange={onChange}
              placeholder='1032485205, 2222222'
            />
          </label>
        </fieldset>

        {showOperacion && (
          <fieldset style={{ border: '1px solid #ddd', padding: 12 }}>
            <legend>Operación</legend>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <label>
                subtipo *
                <select
                  name='operacion_subtipo'
                  value={form.operacion_subtipo}
                  onChange={onChange}
                >
                  <option value='comercio'>comercio</option>
                  <option value='bodega'>bodega</option>
                </select>
              </label>

              <label>
                cliente *
                <input
                  name='operacion_cliente'
                  value={form.operacion_cliente}
                  onChange={onChange}
                  placeholder='Cliente SA'
                />
              </label>

              <label>
                lote (opcional)
                <input
                  name='operacion_lote'
                  value={form.operacion_lote}
                  onChange={onChange}
                  placeholder='L-456'
                />
              </label>

              <label>
                producto (opcional)
                <input
                  name='operacion_producto'
                  value={form.operacion_producto}
                  onChange={onChange}
                  placeholder='Producto X'
                />
              </label>
            </div>

            <label>
              apoyo_ids (CSV id_personal) opcional
              <input
                name='operacion_apoyo_text'
                value={form.operacion_apoyo_text}
                onChange={onChange}
                placeholder='1032485205, 9999999'
              />
            </label>

            <label>
              servicios_adicionales (CSV) opcional
              <input
                name='operacion_servicios_text'
                value={form.operacion_servicios_text}
                onChange={onChange}
                placeholder='reempaque, etiquetado'
              />
            </label>
          </fieldset>
        )}

        <fieldset style={{ border: '1px solid #ddd', padding: 12 }}>
          <legend>Adjuntos</legend>
          <input type='file' multiple onChange={onFiles} />
          <div style={{ fontSize: 12, marginTop: 8 }}>
            {form.files.length ? (
              <ul>
                {form.files.map(f => (
                  <li key={f.name}>
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            ) : (
              <span>Sin archivos</span>
            )}
          </div>
        </fieldset>

        <button disabled={loading} type='submit'>
          {loading ? 'Creando...' : 'Crear Ticket'}
        </button>

        {err && (
          <pre style={{ background: '#fee', padding: 12, overflow: 'auto' }}>
            {typeof err === 'string' ? err : JSON.stringify(err, null, 2)}
          </pre>
        )}

        {resp && (
          <pre style={{ background: '#eef', padding: 12, overflow: 'auto' }}>
            {JSON.stringify(resp, null, 2)}
          </pre>
        )}
      </form>
    </div>
  )
}
