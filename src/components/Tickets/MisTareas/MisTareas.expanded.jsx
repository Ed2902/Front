// MisTareas.expanded.jsx
import { CatalogBadge, OrgBadge } from './MisTareas.badges'
import TrazabilidadEstado from './MisTareas.trazabilidad.jsx'
import {
  computeCumplimientoUI,
  fmtDate,
  getAsignacionScope,
  getEstadoItemDesdeHistorial,
  oidToString,
  personaLabel,
  resolveAsignadoNombre,
} from './MisTareas.utils.js'

const ActionBtn = ({
  children,
  onClick,
  disabled,
  variant = 'primary',
  title,
}) => {
  const base = {
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    padding: '6px 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid transparent',
    boxShadow: '0 1px 0 rgba(0,0,0,.06)',
    whiteSpace: 'nowrap',
  }

  const variants = {
    primary: { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd' },
    light: { background: '#fff', color: '#0d6efd', borderColor: '#cfe2ff' },
    gray: { background: '#fff', color: '#495057', borderColor: '#dee2e6' },
  }

  return (
    <button
      type='button'
      className='btn btn-sm'
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...(variants[variant] || variants.primary) }}
    >
      {children}
    </button>
  )
}

export default function ExpandedTicket({
  data,
  maps,
  onOpenAdjuntos,
  onOpenUpdate,
  onOpenChat,
  onOpenAdjuntosEvento,
}) {
  const estadosMap = maps?.estadosMap || {}
  const personalMap = maps?.personalMap || {}

  const cierreInfo = computeCumplimientoUI(data, estadosMap)

  const prioridadId = oidToString(data?.prioridad_id)
  const categoriaId = oidToString(data?.categoria_id)

  const prioridadItem = maps?.prioridadesMap?.[prioridadId] || null
  const categoriaItem = maps?.categoriasMap?.[categoriaId] || null
  const estadoItem = getEstadoItemDesdeHistorial(data, estadosMap)

  const asignado = data?.asignado_a || {}
  const adjuntosTicket = Array.isArray(data?.adjuntos) ? data.adjuntos : []
  const scope = getAsignacionScope(data)

  const isOperacion = String(data?.tipo || '').toLowerCase() === 'operacion'
  const op = data?.operacion || {}

  const tipo = String(data?.tipo || '')
    .trim()
    .toLowerCase()
  const tipoAccent =
    tipo === 'operacion'
      ? '#0ea5e9'
      : tipo === 'proyecto'
        ? '#7c3aed'
        : '#22c55e'

  return (
    <div
      className='w-100 px-2 py-2'
      style={{ maxWidth: '100%', overflowX: 'hidden' }}
    >
      {/* ✅ Borde azul completo + línea izquierda dinámica */}
      <div
        className='border border-primary rounded bg-light p-3'
        style={{ borderLeft: `4px solid ${tipoAccent}` }}
      >
        {/* Acciones */}
        <div className='d-flex flex-wrap gap-2 mb-3'>
          <ActionBtn
            variant='light'
            onClick={() => onOpenChat?.(data)}
            disabled={cierreInfo.cerrado}
            title={
              cierreInfo.cerrado
                ? 'Ticket cerrado: chat deshabilitado'
                : 'Abrir chat'
            }
          >
            💬 <span>Abrir chat</span>
          </ActionBtn>

          <ActionBtn
            variant='gray'
            onClick={() => onOpenAdjuntos?.(data)}
            disabled={!adjuntosTicket.length}
            title={
              !adjuntosTicket.length
                ? 'Este ticket no tiene adjuntos'
                : 'Ver adjuntos'
            }
          >
            📎 <span>Adjuntos</span>
            {adjuntosTicket.length ? (
              <span
                className='badge bg-primary'
                style={{ borderRadius: 999, fontSize: 11, fontWeight: 900 }}
              >
                {adjuntosTicket.length}
              </span>
            ) : null}
          </ActionBtn>

          <ActionBtn
            variant='primary'
            onClick={() => onOpenUpdate?.(data)}
            disabled={cierreInfo.cerrado}
            title={
              cierreInfo.cerrado
                ? 'Ticket cerrado: no puedes agregar historial'
                : 'Agregar al historial'
            }
          >
            ➕ <span>Agregar historial</span>
          </ActionBtn>
        </div>

        <div className='row g-2'>
          <div className='col-12 col-lg-7'>
            <div className='fw-bold mb-1'>Descripción</div>
            <div
              className='text-muted'
              style={{
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {data?.descripcion || '—'}
            </div>
          </div>

          <div className='col-12 col-lg-5'>
            <div className='fw-bold mb-1'>Asignación</div>
            <div className='d-flex align-items-center gap-2 flex-wrap'>
              <span
                className={scope.cls}
                title={scope.detail || ''}
                style={{
                  fontWeight: 900,
                  borderRadius: 10,
                  padding: '0.20rem 0.45rem',
                }}
              >
                {scope.label}
              </span>
              <span className='text-muted' style={{ wordBreak: 'break-word' }}>
                {asignado?.tipo === 'personal'
                  ? personaLabel(asignado.id, personalMap).title
                  : resolveAsignadoNombre(asignado, maps)}
              </span>
            </div>
          </div>

          {isOperacion && (
            <div className='col-12'>
              <div className='fw-bold mb-1'>Operación</div>
              <div className='d-flex flex-wrap gap-2'>
                <span className='badge bg-white text-dark border'>
                  <b>Cliente:</b> {String(op?.cliente || '').trim() || '—'}
                </span>
                <span className='badge bg-white text-dark border'>
                  <b>Lote:</b> {String(op?.lote || '').trim() || '—'}
                </span>
                <span className='badge bg-white text-dark border'>
                  <b>Producto:</b> {String(op?.producto || '').trim() || '—'}
                </span>
              </div>
            </div>
          )}

          {/* Datos */}
          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Estado</div>
            <CatalogBadge item={estadoItem} fallback='—' maxW={160} />
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Categoría</div>
            <CatalogBadge item={categoriaItem} fallback='—' maxW={160} />
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Prioridad</div>
            <CatalogBadge item={prioridadItem} fallback='—' maxW={160} />
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Org</div>
            <OrgBadge orgId={data?.orgId} maxW={160} />
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Creado</div>
            <div className='text-muted'>{fmtDate(data?.createdAt)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Actualizado</div>
            <div className='text-muted'>{fmtDate(data?.updatedAt)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Fecha estimada</div>
            <div className='text-muted'>{fmtDate(data?.fecha_estimada)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Cumplimiento</div>
            <div className='text-muted'>{cierreInfo.label || '—'}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Cierre</div>
            <div className='text-muted'>
              {cierreInfo.cierreAt
                ? fmtDate(cierreInfo.cierreAt.toISOString())
                : '—'}
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Días de retraso</div>
            <div className='text-muted'>
              {typeof cierreInfo.retrasoDias === 'number'
                ? cierreInfo.retrasoDias
                : '—'}
            </div>
          </div>

          <TrazabilidadEstado
            ticket={data}
            estadosMap={estadosMap}
            personalMap={personalMap}
            onOpenAdjuntosEvento={onOpenAdjuntosEvento}
          />
        </div>
      </div>
    </div>
  )
}
