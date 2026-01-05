import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar/Sidebar'
import MenuPersonal from '../../components/Personal/MenuPersonal/MenuPersonal'
import SeccionDinamicaPersonal from '../../components/Personal/SeccionDinamicaPersonal/SeccionDinamicaPersonal'
import AuthContext from '../../context/AuthContext'
import './Personal.css'

const Personal = () => {
  const [selectedSection, setSelectedSection] = useState('mi-perfil')
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
      <Sidebar onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)} />

      <div className='main-content'>
        <MenuPersonal
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        <SeccionDinamicaPersonal selectedSection={selectedSection} />
      </div>
    </div>
  )
}

export default Personal
