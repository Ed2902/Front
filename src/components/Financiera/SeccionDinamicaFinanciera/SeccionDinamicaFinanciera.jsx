// src/components/Financiera/SeccionDinamicaFinanciera.jsx
import './SeccionDinamicaFinanciera.css'
import TablaFinanciera from '../TablaFinanciera/TablaFinanciera'
import Facturas from '../ControlFacturas/Facturas'
import { usePermisos } from '../../../hooks/usePermisos'

const SeccionDinamicaFinanciera = ({ selectedSection }) => {
  const { tienePermiso } = usePermisos()

  const NoAutorizado = () => (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>404</h2>
      <p style={{ marginTop: 8, marginBottom: 0 }}>Intenta más tarde.</p>
    </div>
  )

  // Bloqueo global del módulo
  if (!tienePermiso('financiera')) {
    return (
      <div className='financiera-seccion'>
        <NoAutorizado />
      </div>
    )
  }

  let contenido

  switch (selectedSection) {
    case 'tabla-financiera': {
      // Bloqueo por permiso específico
      if (!tienePermiso('tablaFinanciera')) {
        contenido = <NoAutorizado />
      } else {
        contenido = <TablaFinanciera />
      }
      break
    }

    case 'control-facturas': {
      if (!tienePermiso('controlFacturas')) {
        contenido = <NoAutorizado />
      } else {
        contenido = <Facturas />
      }
      break
    }

    default:
      // Si llega algo raro o no hay sección seleccionada
      contenido = <NoAutorizado />
  }

  return <div className='financiera-seccion'>{contenido}</div>
}

export default SeccionDinamicaFinanciera
