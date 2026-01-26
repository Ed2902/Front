import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import MenuPersonal from '../../components/Personal/MenuPersonal/MenuPersonal'
import SeccionDinamicaPersonal from '../../components/Personal/SeccionDinamicaPersonal/SeccionDinamicaPersonal'
import AuthContext from '../../context/AuthContext'
import './Personal.css'

const Personal = () => {
  const [selectedSection, setSelectedSection] = useState('mi-perfil')

  const { token } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  return (
    <div className='page'>
      <MenuPersonal
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      <SeccionDinamicaPersonal selectedSection={selectedSection} />
    </div>
  )
}

export default Personal
