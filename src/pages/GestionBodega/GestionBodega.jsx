import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar/Sidebar'
import MenuGestionBodega from '../../components/GestionBodega/MenuGestionBodega/MenuGestionBodega'
import SeccionDinamica from '../../components/GestionBodega/SeccionDinamica/SeccionDinamica'
import AuthContext from '../../context/AuthContext'
import './GestionBodega.css'

const GestionBodega = () => {
  const [selectedSection, setSelectedSection] = useState('inventario')
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
        <MenuGestionBodega
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />
        <SeccionDinamica selectedSection={selectedSection} />
      </div>
    </div>
  )
}

export default GestionBodega
