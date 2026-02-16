// MisTareas.trazabilidad.jsx
import {
  changedByLabel,
  fmtDate,
  oidToString,
  resolveEstadoItem,
  textColorForUser,
} from './MisTareas.utils.js'
import { CatalogBadge } from './MisTareas.badges'

/**
 * ✅ Linkify simple:
 * - detecta http(s):// y www.
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)(?![^<]*>)/gi

const ensureHttp = url => {
  const s = String(url || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^www\./i.test(s)) return `https://${s}`
  return s
}

const LinkifyText = ({ text }) => {
  const raw = String(text || '')
  if (!raw.trim()) return <span className='text-muted'>—</span>

  const parts = raw.split(URL_RE)

  return (
    <>
      {parts.map((part, idx) => {
        const isUrl = /^(https?:\/\/|www\.)/i.test(part) && part.length > 3
        if (!isUrl) return <span key={idx}>{part}</span>

        const href = ensureHttp(part)
        return (
          <a
            key={idx}
            href={href}
            target='_blank'
            rel='noreferrer noopener'
            style={{
              textDecoration: 'underline',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {part}
          </a>
        )
      })}
    </>
  )
}

const ActionBtn = ({ children, onClick, disabled, title }) => {
  return (
    <button
      type='button'
      className='btn btn-sm'
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        padding: '6px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid #dee2e6',
        background: '#fff',
        color: '#495057',
        boxShadow: '0 1px 0 rgba(0,0,0,.06)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Props:
 * - ticket: el ticket completo (data)
 * - estadosMap
 * - personalMap
 * - onOpenAdjuntosEvento({ ticket, evento, adjuntos })
 */
export default function TrazabilidadEstado({
  ticket,
  estadosMap = {},
  personalMap = {},
  onOpenAdjuntosEvento,
}) {
  const historial = Array.isArray(ticket?.estado_historial)
    ? ticket.estado_historial
    : []

  const historialOrdenado = historial
    .slice()
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))

  return (
    <div className='col-12' style={{ minWidth: 0 }}>
      <div className='fw-bold mb-2'>Trazabilidad de estado</div>

      {/* ✅ Contenedor al 80% PERO alineado a la izquierda */}
      <div
        style={{
          width: '99%',
          maxWidth: 1150,
          minWidth: 0,
          marginLeft: 0, // ✅ izquierda
          marginRight: 'auto', // ✅ no lo centra
          overflowX: 'hidden',
        }}
      >
        {historialOrdenado.length ? (
          <div
            className='border rounded bg-white p-2'
            style={{
              overflowX: 'hidden',
              minWidth: 0,
            }}
          >
            {historialOrdenado.map((h, idx) => {
              const item = resolveEstadoItem(h?.estado_id, estadosMap) || null
              const adjuntosEvento = Array.isArray(h?.adjuntos)
                ? h.adjuntos
                : []

              const byText = changedByLabel(h.changedBy, personalMap)
              const byColor = textColorForUser(h.changedBy) // ✅ color por persona

              return (
                <div
                  key={`${oidToString(h?.estado_id)}-${h.changedAt}-${idx}`}
                  className='py-2'
                  style={{
                    borderBottom:
                      idx === historialOrdenado.length - 1
                        ? 'none'
                        : '1px solid #eee',
                    minWidth: 0,
                  }}
                >
                  <div
                    className='d-flex align-items-start gap-2 flex-wrap'
                    style={{ width: '100%', minWidth: 0 }}
                  >
                    {/* Estado */}
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <CatalogBadge item={item} fallback='—' maxW={240} />
                    </div>

                    {/* Derecha: adjuntos + autor + fecha */}
                    <div
                      style={{
                        flex: '0 1 320px',
                        marginLeft: 'auto',
                        minWidth: 0,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      {!!adjuntosEvento.length && (
                        <ActionBtn
                          onClick={() =>
                            onOpenAdjuntosEvento?.({
                              ticket,
                              evento: h,
                              adjuntos: adjuntosEvento,
                            })
                          }
                          title='Ver adjuntos de este cambio'
                        >
                          📎 <span>({adjuntosEvento.length})</span>
                        </ActionBtn>
                      )}

                      <div
                        style={{
                          minWidth: 0,
                          maxWidth: 220,
                          textAlign: 'right',
                        }}
                      >
                        {/* ✅ nombre con color (sin text-muted encima) */}
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: byColor,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {byText}
                        </div>

                        {/* ✅ fecha sí puede ir muted */}
                        <div
                          className='text-muted'
                          style={{
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fmtDate(h.changedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nota */}
                  <div className='mt-2' style={{ paddingLeft: 2, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#333',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%',
                        minWidth: 0,
                      }}
                    >
                      <b>Nota:</b>{' '}
                      <LinkifyText text={h?.nota?.trim() ? h.nota : ''} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='text-muted'>—</div>
        )}
      </div>
    </div>
  )
}
