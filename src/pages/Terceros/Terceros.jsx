import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar/Sidebar'
import MenuTerceros from '../../components/Terceros/MenuTerceros/MenuTerceros.jsx'
import SeccionDinamicaTerceros from '../../components/Terceros/SeccionDinamicaTerceros/SeccionDinamicaTerceros.jsx'
import AuthContext from '../../context/AuthContext'
import './Terceros.css'

const Terceros = () => {
  const [selectedSection, setSelectedSection] = useState('clientes')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const { token } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  return (
    <div className={`layout ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className='main-content'>
        <MenuTerceros
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />
        <div className='main-scrollable'>
          <SeccionDinamicaTerceros selectedSection={selectedSection} />
        </div>
      </div>
    </div>
  )
}

export default Terceros
