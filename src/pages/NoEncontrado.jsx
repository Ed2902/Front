import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NoEncontrado = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const handleBack = () => {
    navigate(from)
  }

  return (
    <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
      <h1>Error 404</h1>
      <p>Página no encontrada o sin permisos para acceder.</p>
      <button
        onClick={handleBack}
        style={{
          marginTop: '1rem',
          padding: '10px 20px',
          backgroundColor: '#59A1F7',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Volver
      </button>
    </div>
  )
}

export default NoEncontrado
