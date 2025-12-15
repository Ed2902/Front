// src/components/Personal/MenuPersonal/MenuPersonal.jsx
import './MenuPersonal.css'

const MenuPersonal = ({ selectedSection, onSelectSection }) => {
  const botones = [
    { label: 'Mi perfil', key: 'mi-perfil' },
    { label: 'Perfiles de personal', key: 'perfiles-personal' },
  ]

  return (
    <div className='menu-personal'>
      {botones.map(btn => (
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

export default MenuPersonal
