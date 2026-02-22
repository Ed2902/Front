import { useState } from 'react'
import './Menutickets.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTickets = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()
  const [openMobile, setOpenMobile] = useState(false)

  const botones = [
    // Usuario
    { label: 'Mis Tareas', key: 'misTareas', permiso: 'misTareas' },
    { label: 'Mis Creaciones', key: 'misCreaciones', permiso: 'misCreaciones' },

    // Supervisor / Control
    { label: 'Seguimiento', key: 'seguimiento', permiso: 'seguimiento' },

    // Admin
    { label: 'Catálogos', key: 'adminCatalogos', permiso: 'adminCatalogos' },
    { label: 'Áreas', key: 'adminAreas', permiso: 'adminAreas' },
    { label: 'Teams', key: 'adminTeams', permiso: 'adminTeams' },
  ]

  const visibles = botones.filter(btn => tienePermiso(btn.permiso))
  const finalBotones =
    visibles.length > 0
      ? visibles
      : botones.filter(b => b.key === 'misCreaciones' || b.key === 'misTareas')

  const handleSelect = key => {
    onSelectSection(key)
    setOpenMobile(false) // ✅ cierra en móvil al elegir
  }

  return (
    <>
      {/* ✅ Botón hamburguesa SOLO móvil (derecha) */}
      <button
        type='button'
        className='tickets-submenu-toggle'
        aria-label='Abrir menú de Tickets'
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(v => !v)}
      >
        ☰
      </button>

      {/* ✅ Overlay SOLO móvil */}
      <div
        className={`tickets-submenu-overlay ${openMobile ? 'open' : ''}`}
        onClick={() => setOpenMobile(false)}
      />

      {/* ✅ Menú normal en PC / Drawer en móvil */}
      <div className={`menu-tickets ${openMobile ? 'submenu-open' : ''}`}>
        {finalBotones.map(btn => (
          <button
            key={btn.key}
            type='button'
            className={`menu-button ${
              selectedSection === btn.key ? 'active' : ''
            }`}
            onClick={() => handleSelect(btn.key)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </>
  )
}

export default MenuTickets
