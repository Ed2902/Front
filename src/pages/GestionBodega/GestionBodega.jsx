import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import MenuGestionBodega from '../../components/GestionBodega/MenuGestionBodega/MenuGestionBodega'
import SeccionDinamica from '../../components/GestionBodega/SeccionDinamica/SeccionDinamica'
import AuthContext from '../../context/AuthContext'
import './GestionBodega.css'

const GestionBodega = () => {
  const [selectedSection, setSelectedSection] = useState('inventario')

  const { token } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  return (
    <div className='page'>
      <MenuGestionBodega
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      <SeccionDinamica selectedSection={selectedSection} />
    </div>
  )
}

export default GestionBodega
