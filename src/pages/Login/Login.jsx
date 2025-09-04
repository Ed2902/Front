import React, { useState, useContext } from 'react'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import { login as loginService } from '../../services/authService' // Importamos y renombramos loginService
import AuthContext from '../../context/AuthContext' // 🔥 Importamos el contexto

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()

  const { login } = useContext(AuthContext) // 🔥 Usamos login del contexto

  const handleSubmit = async e => {
    e.preventDefault()

    if (!username || !password) {
      setError(
        'Por favor, ingresa tanto el nombre de usuario como la contraseña.'
      )
      return
    }

    setError('')
    setSuccessMessage('')

    try {
      const response = await loginService(username, password)

      // 🔥 Guardar en el AuthContext
      login(response.user, response.token)

      // 🔥 No es necesario guardar manualmente en localStorage aquí, ya lo hace AuthContext

      // 🔥 Redirige
      navigate('/home')
    } catch (error) {
      setError(error.message)
    }
  }

  return (
    <div className='login-box'>
      <img src='/Genika.webp' alt='Logo GENIKA' className='logo' />
      <h2>Ingreso</h2>
      <form onSubmit={handleSubmit}>
        <div className='user-box'>
          <input
            type='text'
            name='username'
            required
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <label>Usuario</label>
        </div>
        <div className='user-box'>
          <input
            type='password'
            name='password'
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <label>Contraseña</label>
        </div>
        {error && <div className='error-message'>{error}</div>}
        {successMessage && (
          <div className='success-message'>{successMessage}</div>
        )}

        <a href='#' onClick={handleSubmit}>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          INGRESAR
        </a>
      </form>
    </div>
  )
}

export default Login
