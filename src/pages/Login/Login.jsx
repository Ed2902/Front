import React, { useState, useContext } from 'react'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import { login as loginService } from '../../services/authService'
import AuthContext from '../../context/AuthContext'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()

  const { login } = useContext(AuthContext)

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

      // Guardar en el AuthContext (token + user completo con personal)
      login(response.user, response.token)

      // Redirigir
      navigate('/home')
    } catch (error) {
      setError(error.message || 'Error al iniciar sesión.')
    }
  }

  return (
    <div className='login-box'>
      <img src='/Genika.webp' alt='Logo GENIKA' className='logo' />
      <h2>Ingreso</h2>

      <form onSubmit={handleSubmit} autoComplete='on'>
        <div className='user-box'>
          <input
            type='text'
            name='username'
            required
            autoComplete='username'
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
            autoComplete='current-password'
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <label>Contraseña</label>
        </div>

        {error && <div className='error-message'>{error}</div>}
        {successMessage && (
          <div className='success-message'>{successMessage}</div>
        )}

        {/* Cambiamos <a href="#"> por <button type="submit"> para evitar refrescos y warnings */}
        <button type='submit' className='login-submit'>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          INGRESAR
        </button>
      </form>
    </div>
  )
}

export default Login
