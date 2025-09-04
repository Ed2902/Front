import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar/Sidebar'
import MenuOperaciones from '../../components/Operacion/MenuOperaciones/MenuOperaciones'
import SeccionDinamicaOperaciones from '../../components/Operacion/SeccionDinamicaOperaciones/SeccionDinamicaOperaciones'
import AuthContext from '../../context/AuthContext'
import './Operaciones.css'

const Operaciones = () => {
  const [selectedSection, setSelectedSection] = useState('bodega')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const { token, user } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  useEffect(() => {
    if (user && user.permisos && user.permisos.operaciones === false) {
      navigate('/no-autorizado')
    }
  }, [user, navigate])

  return (
    <div className={`layout ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className='main-content'>
        <MenuOperaciones
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />
        <SeccionDinamicaOperaciones selectedSection={selectedSection} />
      </div>
    </div>
  )
}

export default Operaciones
