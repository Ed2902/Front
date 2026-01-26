import './Menutickets.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTickets = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  const botones = [
    // Usuario
    { label: 'Mis Tareas', key: 'misTareas', permiso: 'misTareas' },
    { label: 'Mis Creaciones', key: 'misCreaciones', permiso: 'misCreaciones' },

    // Admin
    { label: 'Catálogos', key: 'adminCatalogos', permiso: 'adminCatalogos' },
    { label: 'Áreas', key: 'adminAreas', permiso: 'adminAreas' },
    { label: 'Teams', key: 'adminTeams', permiso: 'adminTeams' },
  ]

  const visibles = botones.filter(btn => tienePermiso(btn.permiso))

  // ✅ fallback: si no tiene permisos, intenta Mis Creaciones, si no, Mis Tareas
  const finalBotones =
    visibles.length > 0
      ? visibles
      : botones.filter(b => b.key === 'misCreaciones' || b.key === 'misTareas')

  return (
    <div className='menu-tickets'>
      {finalBotones.map(btn => (
        <button
          key={btn.key}
          className={`menu-button ${selectedSection === btn.key ? 'active' : ''}`}
          onClick={() => onSelectSection(btn.key)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

export default MenuTickets
