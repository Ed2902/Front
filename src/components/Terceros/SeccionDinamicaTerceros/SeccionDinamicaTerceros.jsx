// src/components/Terceros/SeccionDinamicaTerceros.jsx
import Cliente from '../Cliente/Cliente.jsx'
import Proveedor from '../Proveedor/Proveedor.jsx'
import PersonalExterno from '../Externos/Personalexterno.jsx'
import './SeccionDinamicaTerceros.css'
import { usePermisos } from '../../../hooks/usePermisos'

const SeccionDinamicaTerceros = ({ selectedSection }) => {
  const { tienePermiso } = usePermisos()

  let contenido = null

  switch (selectedSection) {
    case 'clientes':
      if (tienePermiso('clientes')) contenido = <Cliente />
      break

    case 'proveedores':
      if (tienePermiso('proveedores')) contenido = <Proveedor />
      break

    // ✅ Nueva sección: Personal Externo
    case 'personal_externo':
      if (tienePermiso('personal_externo')) contenido = <PersonalExterno />
      break

    default:
      contenido = null
  }

  return <div className='terceros-seccion'>{contenido}</div>
}

export default SeccionDinamicaTerceros
