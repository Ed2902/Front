import { useEffect, useMemo, useState } from 'react'
import { listarCatalogo, listarAreas, listarTeams } from './service.CrearTicket'
import './Filtros.css'

export default function Filtros({
  token,
  empresas = [], // [{orgId:'Fastway', name:'Fastway'}, ...]
  defaultOrgId = '', // '' => Todas
  onApply, // (filters) => void
}) {
  const [orgId, setOrgId] = useState(defaultOrgId)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado_id, setEstadoId] = useState('')
  const [prioridad_id, setPrioridadId] = useState('')
  const [categoria_id, setCategoriaId] = useState('')
  const [asignadoTipo, setAsignadoTipo] = useState('') // team | area | ''
  const [asignadoId, setAsignadoId] = useState('')
  const [activo, setActivo] = useState('') // '' todos | 'true' | 'false'

  const [estados, setEstados] = useState([])
  const [prioridades, setPrioridades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [areas, setAreas] = useState([])
  const [teams, setTeams] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pickItems = res => {
    if (!res) return []
    if (Array.isArray(res.items)) return res.items
    if (Array.isArray(res.data)) return res.data
    if (Array.isArray(res)) return res
    return []
  }

  useEffect(() => {
    const loadDeps = async () => {
      setError('')
      setEstados([])
      setPrioridades([])
      setCategorias([])
      setAreas([])
      setTeams([])
      setEstadoId('')
      setPrioridadId('')
      setCategoriaId('')
      setAsignadoTipo('')
      setAsignadoId('')

      if (!token) return
      if (!orgId) return // Todas

      try {
        setLoading(true)

        // ✅ NO mandamos "active" (evita 400)
        const [resE, resP, resC, resA, resT] = await Promise.all([
          listarCatalogo({ orgId, type: 'estado', page: 1, limit: 100 }, token),
          listarCatalogo(
            { orgId, type: 'prioridad', page: 1, limit: 100 },
            token
          ),
          listarCatalogo(
            { orgId, type: 'categoria', page: 1, limit: 100 },
            token
          ),
          listarAreas({ page: 1, limit: 100 }, token),
          listarTeams({ page: 1, limit: 100 }, token),
        ])

        setEstados(pickItems(resE))
        setPrioridades(pickItems(resP))
        setCategorias(pickItems(resC))
        setAreas(pickItems(resA))
        setTeams(pickItems(resT))
      } catch (e) {
        setError(
          e?.response?.data?.errors?.[0] ||
            e?.response?.data?.message ||
            e?.message ||
            'Error cargando filtros'
        )
      } finally {
        setLoading(false)
      }
    }

    loadDeps()
  }, [orgId, token])

  useEffect(() => {
    setAsignadoId('')
  }, [asignadoTipo])

  const empresaOptions = useMemo(() => {
    const opts = (empresas || []).map(e => ({
      value: e?.orgId || e?._id || '',
      label: e?.name || e?.nombre || e?.orgId || e?._id || '',
    }))
    return [{ value: '', label: 'Todas' }, ...opts]
  }, [empresas])

  const buildFilters = () => {
    const f = {}

    if (orgId) f.orgId = orgId
    if (search.trim()) f.search = search.trim()
    if (tipo) f.tipo = tipo
    if (activo !== '') f.activo = activo

    if (orgId) {
      if (estado_id) f.estado_id = estado_id
      if (prioridad_id) f.prioridad_id = prioridad_id
      if (categoria_id) f.categoria_id = categoria_id

      if (asignadoTipo === 'team' && asignadoId) f.team_id = asignadoId
      if (asignadoTipo === 'area' && asignadoId) f.area_id = asignadoId
    }

    return f
  }

  const limpiar = () => {
    setOrgId(defaultOrgId)
    setSearch('')
    setTipo('')
    setActivo('')
    setEstadoId('')
    setPrioridadId('')
    setCategoriaId('')
    setAsignadoTipo('')
    setAsignadoId('')
    onApply?.({})
  }

  const aplicar = () => onApply?.(buildFilters())

  const disabledDeps = !orgId || loading

  return (
    <div className='tickets-filtros'>
      <div className='tickets-filtros__row'>
        <div className='tickets-filtros__field'>
          <label>Empresa</label>
          <select
            className='form-select form-select-sm'
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
          >
            {empresaOptions.map(op => (
              <option key={op.value || 'ALL'} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Buscar</label>
          <input
            className='form-control form-control-sm'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Code, título, descripción…'
          />
        </div>

        <div className='tickets-filtros__field'>
          <label>Tipo</label>
          <select
            className='form-select form-select-sm'
            value={tipo}
            onChange={e => setTipo(e.target.value)}
          >
            <option value=''>Todos</option>
            <option value='operacion'>Operación</option>
            <option value='tarea'>Tarea</option>
            <option value='proyecto'>Proyecto</option>
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Activo</label>
          <select
            className='form-select form-select-sm'
            value={activo}
            onChange={e => setActivo(e.target.value)}
          >
            <option value=''>Todos</option>
            <option value='true'>Sí</option>
            <option value='false'>No</option>
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Estado</label>
          <select
            className='form-select form-select-sm'
            value={estado_id}
            onChange={e => setEstadoId(e.target.value)}
            disabled={disabledDeps}
          >
            <option value=''>Todos</option>
            {estados.map(x => (
              <option key={x._id} value={x._id}>
                {x.name || x.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Prioridad</label>
          <select
            className='form-select form-select-sm'
            value={prioridad_id}
            onChange={e => setPrioridadId(e.target.value)}
            disabled={disabledDeps}
          >
            <option value=''>Todas</option>
            {prioridades.map(x => (
              <option key={x._id} value={x._id}>
                {x.name || x.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Categoría</label>
          <select
            className='form-select form-select-sm'
            value={categoria_id}
            onChange={e => setCategoriaId(e.target.value)}
            disabled={disabledDeps}
          >
            <option value=''>Todas</option>
            {categorias.map(x => (
              <option key={x._id} value={x._id}>
                {x.name || x.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Asignado a</label>
          <select
            className='form-select form-select-sm'
            value={asignadoTipo}
            onChange={e => setAsignadoTipo(e.target.value)}
            disabled={disabledDeps}
          >
            <option value=''>—</option>
            <option value='team'>Team</option>
            <option value='area'>Área</option>
          </select>
        </div>

        <div className='tickets-filtros__field'>
          <label>Seleccionar</label>
          {asignadoTipo === '' ? (
            <input
              className='form-control form-control-sm'
              disabled
              value='—'
            />
          ) : asignadoTipo === 'team' ? (
            <select
              className='form-select form-select-sm'
              value={asignadoId}
              onChange={e => setAsignadoId(e.target.value)}
              disabled={disabledDeps}
            >
              <option value=''>—</option>
              {teams.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name || t.nombre || '—'}
                </option>
              ))}
            </select>
          ) : (
            <select
              className='form-select form-select-sm'
              value={asignadoId}
              onChange={e => setAsignadoId(e.target.value)}
              disabled={disabledDeps}
            >
              <option value=''>—</option>
              {areas.map(a => (
                <option key={a._id} value={a._id}>
                  {a.name || a.nombre || '—'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className='tickets-filtros__actions'>
          <button
            type='button'
            className='btn btn-sm btn-outline-secondary'
            onClick={limpiar}
            disabled={loading}
          >
            Limpiar
          </button>
          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={aplicar}
            disabled={loading}
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {!!error && <div className='tickets-filtros__error'>{error}</div>}
      {!orgId && (
        <div className='tickets-filtros__hint'>
          * Selecciona una Empresa para habilitar
          Estado/Prioridad/Categoría/Asignado.
        </div>
      )}
    </div>
  )
}
