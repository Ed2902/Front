import './Menutickets.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTickets = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  const botones = [
    // Usuario
    { label: 'Mis Tareas', key: 'misTareas', permiso: 'MisTareas' },
    { label: 'Mis Creaciones', key: 'misCreaciones', permiso: 'tickets' },

    // Admin
    { label: 'Catálogos', key: 'adminCatalogos', permiso: 'perfilAdmin' },
    { label: 'Áreas', key: 'adminAreas', permiso: 'perfilAdmin' },
    { label: 'Teams', key: 'adminTeams', permiso: 'perfilAdmin' },
  ]

  const visibles = botones.filter(btn => tienePermiso(btn.permiso))
  const finalBotones = visibles.length
    ? visibles
    : botones.filter(b => b.key === 'misTareas')

  return (
    <div className='menu-tickets'>
      {finalBotones.map(btn => (
        <button
          key={btn.key}
          className={`menu-button ${
            selectedSection === btn.key ? 'active' : ''
          }`}
          onClick={() => onSelectSection(btn.key)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

export default MenuTickets
