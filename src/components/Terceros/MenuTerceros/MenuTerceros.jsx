// src/components/Terceros/MenuTerceros.jsx
import { useState } from 'react'
import './MenuTerceros.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTerceros = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()
  const [openMobile, setOpenMobile] = useState(false)

  const handleSelect = key => {
    onSelectSection(key)
    setOpenMobile(false)
  }

  return (
    <>
      <button
        type='button'
        className='terceros-submenu-toggle'
        aria-label='Abrir menú de Terceros'
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(v => !v)}
      >
        ☰
      </button>

      <div
        className={`terceros-submenu-overlay ${openMobile ? 'open' : ''}`}
        onClick={() => setOpenMobile(false)}
      />

      <div className={`menu-terceros ${openMobile ? 'submenu-open' : ''}`}>
        {tienePermiso('clientes') && (
          <button
            className={`menu-button ${selectedSection === 'clientes' ? 'active' : ''}`}
            onClick={() => handleSelect('clientes')}
          >
            Gestión de Clientes
          </button>
        )}

        {tienePermiso('proveedores') && (
          <button
            className={`menu-button ${selectedSection === 'proveedores' ? 'active' : ''}`}
            onClick={() => handleSelect('proveedores')}
          >
            Gestión de Proveedores
          </button>
        )}

        {tienePermiso('personal_externo') && (
          <button
            className={`menu-button ${
              selectedSection === 'personal_externo' ? 'active' : ''
            }`}
            onClick={() => handleSelect('personal_externo')}
          >
            Personal Externo
          </button>
        )}
      </div>
    </>
  )
}

export default MenuTerceros
