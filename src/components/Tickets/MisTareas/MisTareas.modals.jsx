// MisTareas.modals.jsx
import { Modal as AntdModal } from 'antd'
import SecureArchivotikects from '../SecureArchivotikects.jsx'
import AgregarHistorialTicket from '../historial/AgregarHistorialTicket.jsx'

import { Ell } from './MisTareas.badges.jsx'
import { changedByLabel, toTicketAbsolute } from './MisTareas.utils'

export const ModalHistorial = ({ open, onClose, ticket, maps, onSuccess }) => {
  return (
    <AntdModal
      open={open}
      title={`Agregar al historial ${ticket?.code || ''}`}
      onCancel={onClose}
      footer={null}
      centered
      width={760}
      destroyOnHidden // ✅ nuevo reemplazo de destroyOnClose
    >
      {!ticket?._id ? (
        <div className='text-muted'>Selecciona un ticket.</div>
      ) : (
        <AgregarHistorialTicket
          ticketId={ticket._id}
          orgId={ticket.orgId}
          maps={maps}
          onSuccess={onSuccess}
          hideCerrado={true}
        />
      )}
    </AntdModal>
  )
}

export const ModalAdjuntos = ({
  open,
  onClose,
  title,
  adjuntos = [],
  personalMap = {},
}) => {
  return (
    <AntdModal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      centered
      width={720}
      destroyOnHidden // ✅ reemplazo moderno
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
    >
      {!adjuntos.length ? (
        <div className='text-muted'>No hay adjuntos.</div>
      ) : (
        <div className='d-flex flex-column gap-3'>
          {adjuntos.map((a, idx) => {
            const rel = a?.url
            const abs = toTicketAbsolute(a?.url)
            const rutaRelativa = /^https?:\/\//i.test(String(rel || ''))
              ? abs
              : rel

            const fileTitle = a?.name || a?.fileId || `Adjunto ${idx + 1}`

            return (
              <div
                key={`${a?.fileId || idx}`}
                className='border rounded bg-white p-2'
              >
                <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2'>
                  <div style={{ minWidth: 0 }}>
                    <div className='fw-semibold'>
                      <Ell title={fileTitle} maxWidth='520px'>
                        {fileTitle}
                      </Ell>
                    </div>
                    <div className='text-muted small'>
                      {a?.mime || '—'} ·{' '}
                      {typeof a?.size === 'number'
                        ? `${Math.round(a.size / 1024)} KB`
                        : '—'}
                    </div>
                  </div>

                  <span className='badge bg-dark-subtle text-dark'>
                    {a?.uploadedBy
                      ? changedByLabel(a.uploadedBy, personalMap)
                      : '—'}
                  </span>
                </div>

                <SecureArchivotikects
                  rutaRelativa={rutaRelativa}
                  nombreArchivo={fileTitle}
                />
              </div>
            )
          })}
        </div>
      )}
    </AntdModal>
  )
}
