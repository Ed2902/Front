import './SeccionDinamicatickets.css'
import { usePermisos } from '../../../hooks/usePermisos'

// ✅ Mis Tareas
import MisTareas from '../MisTareas/MisTareas'

// ✅ Mis Creaciones
import MisCreaciones from '../MisCreaciones/MisCreaciones'

// ✅ Seguimiento
import SeguimientoTickets from '../Seguimiento/SeguimientoTickets.jsx'

// ✅ Áreas
import AreasTable from '../areas/AreasTable.jsx'

// ✅ Catálogos
import Catalogos from '../catalogo/Catalogos.jsx'

// ✅ Teams
import Teams from '../teams/Teams.jsx'

const SeccionDinamicaTickets = ({ selectedSection }) => {
  const { tienePermiso } = usePermisos()

  const NoAutorizado = () => (
    <div className='tickets-seccion__noauth'>
      No tienes permisos para ver esta sección.
    </div>
  )

  let contenido

  switch (selectedSection) {
    case 'misCreaciones':
      contenido = tienePermiso('misCreaciones') ? (
        <MisCreaciones />
      ) : (
        <NoAutorizado />
      )
      break

    case 'misTareas':
      contenido = tienePermiso('misTareas') ? <MisTareas /> : <NoAutorizado />
      break

    case 'seguimiento':
      contenido = tienePermiso('seguimiento') ? (
        <SeguimientoTickets />
      ) : (
        <NoAutorizado />
      )
      break

    case 'adminCatalogos':
      contenido = tienePermiso('adminCatalogos') ? (
        <Catalogos />
      ) : (
        <NoAutorizado />
      )
      break

    case 'adminAreas':
      contenido = tienePermiso('adminAreas') ? <AreasTable /> : <NoAutorizado />
      break

    case 'adminTeams':
      contenido = tienePermiso('adminTeams') ? <Teams /> : <NoAutorizado />
      break

    default:
      contenido = tienePermiso('misCreaciones') ? (
        <MisCreaciones />
      ) : (
        <NoAutorizado />
      )
  }

  return <div className='tickets-seccion'>{contenido}</div>
}

export default SeccionDinamicaTickets
