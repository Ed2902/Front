// src/components/Personal/MenuPersonal/MenuPersonal.jsx
import { useState } from 'react'
import './MenuPersonal.css'

const MenuPersonal = ({ selectedSection, onSelectSection }) => {
  const [openMobile, setOpenMobile] = useState(false)

  const botones = [
    { label: 'Mi perfil', key: 'mi-perfil' },
    { label: 'Perfiles de personal', key: 'perfiles-personal' },
  ]

  const handleSelect = key => {
    onSelectSection(key)
    setOpenMobile(false)
  }

  return (
    <>
      <button
        type='button'
        className='personal-submenu-toggle'
        aria-label='Abrir menú de Personal'
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(v => !v)}
      >
        ☰
      </button>

      <div
        className={`personal-submenu-overlay ${openMobile ? 'open' : ''}`}
        onClick={() => setOpenMobile(false)}
      />

      <div className={`menu-personal ${openMobile ? 'submenu-open' : ''}`}>
        {botones.map(btn => (
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

export default MenuPersonal
