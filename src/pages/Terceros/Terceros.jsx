import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import MenuTerceros from '../../components/Terceros/MenuTerceros/MenuTerceros.jsx'
import SeccionDinamicaTerceros from '../../components/Terceros/SeccionDinamicaTerceros/SeccionDinamicaTerceros.jsx'
import AuthContext from '../../context/AuthContext'
import './Terceros.css'

const Terceros = () => {
  const [selectedSection, setSelectedSection] = useState('clientes')

  const { token } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  return (
    <div className='page'>
      <MenuTerceros
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      {/* scroll interno SOLO si lo necesitas */}
      <div className='terceros-scroll'>
        <SeccionDinamicaTerceros selectedSection={selectedSection} />
      </div>
    </div>
  )
}

export default Terceros
