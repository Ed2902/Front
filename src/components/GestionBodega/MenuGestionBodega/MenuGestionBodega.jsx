import { useState } from 'react'
import './MenuGestionBodega.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuGestionBodega = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()
  const [openMobile, setOpenMobile] = useState(false)

  const botones = [
    {
      label: 'Inventario',
      key: 'inventario',
      protegido: true,
      permiso: 'inventario',
    },
    { label: 'Movimientos', key: 'movimientos' },
    { label: 'En transfor...', key: 'transformaciones' },
    { label: 'Bodegas', key: 'bodegas' },
    { label: 'Productos', key: 'productos' },
    { label: 'Lotes', key: 'lotes' },
    {
      label: 'Dashboard',
      key: 'Dashboard',
      protegido: true,
      permiso: 'dashboard',
    },
  ]

  const handleSelect = key => {
    onSelectSection(key)
    setOpenMobile(false)
  }

  return (
    <>
      <button
        type='button'
        className='gestionbodega-submenu-toggle'
        aria-label='Abrir menú de Gestión Bodega'
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(v => !v)}
      >
        ☰
      </button>

      <div
        className={`gestionbodega-submenu-overlay ${openMobile ? 'open' : ''}`}
        onClick={() => setOpenMobile(false)}
      />

      <div
        className={`menu-gestion-bodega ${openMobile ? 'submenu-open' : ''}`}
      >
        {botones
          .filter(btn => !btn.protegido || tienePermiso(btn.permiso))
          .map(btn => (
            <button
              key={btn.key}
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

export default MenuGestionBodega
