import { useEffect, useMemo, useState } from 'react'
import { Card, Container, Modal } from 'react-bootstrap'
import { FiTrash2 } from 'react-icons/fi'

import './Facturas.css'
import FactCompraTable from './FactCompraTable'
import FactVentaTable from './FactVentaTable'
import Papelera from './papelera'
import { usePermisos } from '../../../hooks/usePermisos'

const TABS = {
  COMPRA: 'compra',
  VENTA: 'venta',
}

export default function Facturas() {
  const { tienePermiso } = usePermisos()

  const [tab, setTab] = useState(null) // OJO: ahora inicia null (no forzamos compra)
  const [verBorrados, setVerBorrados] = useState(false)
  const [showPapelera, setShowPapelera] = useState(false)

  const NoAutorizado = () => (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>404</h2>
      <p style={{ marginTop: 8, marginBottom: 0 }}>Intenta más tarde.</p>
    </div>
  )

  // Bloqueo global: si no tiene acceso a Financiera o a Control Facturas, no entra
  const puedeEntrarModulo = useMemo(() => {
    return tienePermiso('financiera') && tienePermiso('controlFacturas')
  }, [tienePermiso])

  // Tabs permitidas por sub-permiso
  const tabsPermitidas = useMemo(() => {
    if (!puedeEntrarModulo) return []

    const t = []
    if (tienePermiso('factcompras')) t.push(TABS.COMPRA)
    if (tienePermiso('factventas')) t.push(TABS.VENTA)
    return t
  }, [puedeEntrarModulo, tienePermiso])

  // Si el tab actual no es permitido (o está null), seleccionar el primero permitido
  useEffect(() => {
    if (!tabsPermitidas.length) return
    if (!tab || !tabsPermitidas.includes(tab)) {
      setTab(tabsPermitidas[0])
    }
  }, [tabsPermitidas, tab])

  // Si no puede entrar al módulo o no tiene ningún subpermiso, 404
  if (!puedeEntrarModulo || !tabsPermitidas.length) {
    return (
      <div className='financiera-seccion'>
        <NoAutorizado />
      </div>
    )
  }

  const title = tab === TABS.COMPRA ? 'Facturas de compra' : 'Facturas de venta'

  return (
    <Container fluid className='py-3'>
      <Card className='shadow-sm'>
        <Card.Header className='bg-white facturas-header'>
          {/* IZQUIERDA */}
          <div className='facturas-left'>
            <div className='facturas-segment'>
              {tabsPermitidas.includes(TABS.COMPRA) && (
                <button
                  className={`facturas-segbtn ${
                    tab === TABS.COMPRA ? 'active' : ''
                  }`}
                  onClick={() => setTab(TABS.COMPRA)}
                  type='button'
                >
                  Compra
                </button>
              )}

              {tabsPermitidas.includes(TABS.VENTA) && (
                <button
                  className={`facturas-segbtn ${
                    tab === TABS.VENTA ? 'active' : ''
                  }`}
                  onClick={() => setTab(TABS.VENTA)}
                  type='button'
                >
                  Venta
                </button>
              )}
            </div>

            <div className='facturas-text'>
              <div className='facturas-title'>{title}</div>
              <div className='facturas-subtitle'>
                Cambia entre compra/venta o borrados para ver la papelera
              </div>
            </div>
          </div>

          {/* DERECHA */}
          <button
            className={`facturas-trashchip ${verBorrados ? 'active' : ''}`}
            type='button'
            onClick={() => {
              setVerBorrados(v => !v) // se mantiene
              setShowPapelera(true) // abre modal papelera
            }}
          >
            <FiTrash2 />
            <span>Borrados</span>
          </button>
        </Card.Header>

        <Card.Body className='bg-light'>
          {tab === TABS.COMPRA ? (
            tabsPermitidas.includes(TABS.COMPRA) ? (
              <FactCompraTable verBorrados={verBorrados} />
            ) : (
              <NoAutorizado />
            )
          ) : tabsPermitidas.includes(TABS.VENTA) ? (
            <FactVentaTable verBorrados={verBorrados} />
          ) : (
            <NoAutorizado />
          )}
        </Card.Body>
      </Card>

      {/* MODAL PAPELERA (mínimo 1200px) */}
      <Modal
        show={showPapelera}
        onHide={() => setShowPapelera(false)}
        centered
        dialogClassName='modal-papelera'
      >
        <Modal.Body style={{ padding: 0 }}>
          <Papelera />
        </Modal.Body>
      </Modal>
    </Container>
  )
}
