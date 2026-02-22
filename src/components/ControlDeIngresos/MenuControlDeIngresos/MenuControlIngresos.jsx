// src/components/ControlIngresos/MenuControlIngresos/MenuControlIngresos.jsx
import { useState } from 'react'
import './MenuControlIngresos.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuControlIngresos = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()
  const [openMobile, setOpenMobile] = useState(false)

  const botones = [
    {
      label: 'Registrar usuario',
      key: 'crearUsuario',
      protegido: true,
      permiso: 'crearUsuario',
    },
    {
      label: 'Marcación de horario',
      key: 'marcacion',
      protegido: true,
      permiso: 'marcacion',
    },
    {
      label: 'Reporte de horarios',
      key: 'reporte',
      protegido: true,
      permiso: 'reporte',
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
        className='control-ingresos-submenu-toggle'
        aria-label='Abrir menú de Control de Ingresos'
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(v => !v)}
      >
        ☰
      </button>

      <div
        className={`control-ingresos-submenu-overlay ${openMobile ? 'open' : ''}`}
        onClick={() => setOpenMobile(false)}
      />

      <div
        className={`menu-control-ingresos ${openMobile ? 'submenu-open' : ''}`}
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

export default MenuControlIngresos
