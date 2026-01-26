// src/pages/ControlDeIngresos/ControlDeIngresos.jsx
import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthContext from '../../context/AuthContext'

// ✅ imports del módulo
import MenuControlIngresos from '../../components/ControlDeIngresos/MenuControlDeIngresos/MenuControlIngresos.jsx'
import SeccionDinamicaControlDeIngresos from '../../components/ControlDeIngresos/SeccionDinamicaControlDeIngresos/SeccionDinamicaControlDeIngresos.jsx'

const ControlDeIngresos = () => {
  const [selectedSection, setSelectedSection] = useState(null) // 'crearUsuario' | 'marcacion' | 'reporte'

  const { token, user } = useContext(AuthContext)
  const navigate = useNavigate()

  // Si no hay token → login
  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  // Si no tiene permiso → no autorizado
  useEffect(() => {
    if (user && user.permisos && user.permisos.gestioniingresos === false) {
      navigate('/no-autorizado')
    }
  }, [user, navigate])

  return (
    <div className='page'>
      {/* 🧭 Menú de Control de Ingresos */}
      <MenuControlIngresos
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      {/* 🔁 Sección dinámica según la opción seleccionada */}
      <SeccionDinamicaControlDeIngresos selectedSection={selectedSection} />
    </div>
  )
}

export default ControlDeIngresos
