import './SeccionDinamicatickets.css'
import { usePermisos } from '../../../hooks/usePermisos'

// ✅ módulo real existente
import TablaCrearTicket from '../CrearTicket/TablaCrearTicket'

// ✅ NUEVO: Mis Tareas
import MisTareas from '../MisTareas/MisTareas'

const SeccionDinamicaTickets = ({ selectedSection }) => {
  const { tienePermiso } = usePermisos()

  const NoAutorizado = () => (
    <div className='tickets-seccion__noauth'>
      No tienes permisos para ver esta sección.
    </div>
  )

  const Hola = ({ titulo }) => (
    <div className='tickets-seccion__placeholder'>
      <h3>{titulo}</h3>
      <p>Hola mundo 🚧</p>
    </div>
  )

  const renderTablaCreaciones = () => (
    <TablaCrearTicket
      rows={[]}
      loading={false}
      maps={{
        estadosMap: {},
        prioridadesMap: {},
        categoriasMap: {},
        areasMap: {},
        teamsMap: {},
      }}
      options={{ estados: [] }}
      onRefresh={() => {}}
      onOpenChat={() => {}}
    />
  )

  let contenido

  switch (selectedSection) {
    case 'misCreaciones':
      contenido = tienePermiso('tickets') ? (
        renderTablaCreaciones()
      ) : (
        <NoAutorizado />
      )
      break

    case 'misTareas':
      contenido = tienePermiso('MisTareas') ? <MisTareas /> : <NoAutorizado />
      break

    case 'adminCatalogos':
      contenido = tienePermiso('perfilAdmin') ? (
        <Hola titulo='Administrar Catálogos' />
      ) : (
        <NoAutorizado />
      )
      break

    case 'adminAreas':
      contenido = tienePermiso('perfilAdmin') ? (
        <Hola titulo='Administrar Áreas' />
      ) : (
        <NoAutorizado />
      )
      break

    case 'adminTeams':
      contenido = tienePermiso('perfilAdmin') ? (
        <Hola titulo='Administrar Teams' />
      ) : (
        <NoAutorizado />
      )
      break

    default:
      contenido = tienePermiso('tickets') ? (
        renderTablaCreaciones()
      ) : (
        <NoAutorizado />
      )
  }

  return <div className='tickets-seccion'>{contenido}</div>
}

export default SeccionDinamicaTickets
