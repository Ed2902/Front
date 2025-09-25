import './MenuFinanciera.css'

const MenuFinanciera = ({ selectedSection, onSelectSection }) => {
  const botones = [
    {
      label: 'Financiera',
      key: 'financiera',
    },
  ]

  return (
    <div className='menu-financiera'>
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

export default MenuFinanciera
