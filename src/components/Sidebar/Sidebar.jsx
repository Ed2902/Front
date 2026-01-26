// src/components/Sidebar/Sidebar.jsx
import { useState, useEffect, useContext } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  BiChevronLeft,
  BiChevronRight,
  BiHome,
  BiLogOut,
  BiMenu,
  BiLock,
  BiGitMerge,
  BiSolidUserVoice,
  BiTimeFive,
  BiDollar,
  BiGroup,
  BiIdCard,
  BiDoorOpen,
  BiPackage,
} from 'react-icons/bi'
import AuthContext from '../../context/AuthContext'
import { usePermisos } from '../../hooks/usePermisos'
import SecureAvatar from '../Shared/SecureAvatar'
import NotificationsBell from '../notifications/NotificationsBell'
import './Sidebar.css'

const Sidebar = ({ onToggleCollapse }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Submenú Talento (se mantiene)
  const [isTalentSubmenuOpen, setIsTalentSubmenuOpen] = useState(false)

  const { logout, user } = useContext(AuthContext)
  const { tienePermiso } = usePermisos()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setIsMobileOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mantener abierto Talento según la ruta
  useEffect(() => {
    if (
      ['/hojas-de-vida', '/control-de-ingresos', '/tiempos-pc'].includes(
        location.pathname
      )
    ) {
      setIsTalentSubmenuOpen(true)
    }
  }, [location.pathname])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(prev => !prev)
    } else {
      const newCollapsed = !isCollapsed
      setIsCollapsed(newCollapsed)
      if (onToggleCollapse) onToggleCollapse(newCollapsed)

      // si colapsa, cerramos submenús para evitar que queden “raros”
      if (newCollapsed) {
        setIsTalentSubmenuOpen(false)
      }
    }
  }

  const toggleTalentSubmenu = () => setIsTalentSubmenuOpen(prev => !prev)

  const handleLinkClick = () => {
    if (isMobile) setIsMobileOpen(false)
  }

  const handleLogout = e => {
    e.preventDefault()
    logout()
    navigate('/login')
  }

  const nombreUsuario = user?.personal?.nombre || ''
  const apellidoUsuario = user?.personal?.apellido || ''

  const iniciales =
    (nombreUsuario?.[0] || '').toUpperCase() +
    (apellidoUsuario?.[0] || '').toUpperCase()

  const goToPerfil = () => {
    navigate('/hojas-de-vida')
    if (isMobile) setIsMobileOpen(false)
  }

  return (
    <div
      className={`sidebar-container ${isCollapsed ? 'collapsed' : ''} ${
        isMobile ? 'is-mobile' : ''
      }`}
    >
      {isMobile && (
        <button
          type='button'
          className='mobile-menu-button'
          onClick={toggleSidebar}
          aria-label='Abrir menú'
        >
          <BiMenu size={30} />
        </button>
      )}

      {isMobile && isMobileOpen && (
        <div
          className='sidebar-overlay'
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'open' : ''
        }`}
      >
        {/* ✅ Toggle (arriba solo cuando está expandido) */}
        {!isMobile && !isCollapsed && (
          <button
            type='button'
            className='toggle-inside toggle-top'
            onClick={toggleSidebar}
            aria-label='Colapsar sidebar'
          >
            <BiChevronLeft size={22} />
          </button>
        )}

        <div className='sidebar-top'>
          <div className='logo-wrapper'>
            <img src='/Genika.webp' alt='Logo Empresa' className='logo-image' />
            <p
              className={`sidebar-subtitle ${
                isCollapsed && !isMobileOpen ? 'hide-text' : ''
              }`}
            >
              <span className='by-text'>By:</span>{' '}
              <span className='fastway-text'>Fastwaysas</span>
            </p>
          </div>
        </div>

        <div className='sidebar-links'>
          <h6>Menú</h6>
          <ul>
            <li className={location.pathname === '/home' ? 'active' : ''}>
              <Link to='/home' onClick={handleLinkClick}>
                <BiSolidUserVoice size={20} />
                <span
                  className={`${
                    isCollapsed && !isMobileOpen ? 'hide-text' : ''
                  }`}
                >
                  News
                </span>
              </Link>
            </li>

            {/* ✅ Bodega: ahora es SOLO link directo (sin desplegable) */}
            {tienePermiso('gestionBodega') && (
              <li
                className={
                  location.pathname === '/gestion-bodega' ? 'active' : ''
                }
              >
                <Link to='/gestion-bodega' onClick={handleLinkClick}>
                  <BiPackage size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Gestión Bodega
                  </span>
                </Link>
              </li>
            )}

            {tienePermiso('gestionTalento') && (
              <li
                className={`has-submenu ${isTalentSubmenuOpen ? 'open' : ''}`}
              >
                <button
                  type='button'
                  className='submenu-toggle'
                  onClick={toggleTalentSubmenu}
                >
                  <div className='submenu-title'>
                    <BiGroup size={20} />
                    <span
                      className={`${
                        isCollapsed && !isMobileOpen ? 'hide-text' : ''
                      }`}
                    >
                      Gestión del Talento
                    </span>
                  </div>

                  {/* si está colapsado, el CSS ya oculta chevron */}
                  <span className='chevron-icon'>
                    {isTalentSubmenuOpen ? (
                      <BiChevronLeft size={0} />
                    ) : (
                      <BiChevronRight size={0} />
                    )}
                  </span>
                </button>

                <ul className='submenu'>
                  {tienePermiso('hojasDeVidaPersonal') && (
                    <li
                      className={
                        location.pathname === '/hojas-de-vida' ? 'active' : ''
                      }
                    >
                      <Link to='/hojas-de-vida' onClick={handleLinkClick}>
                        <BiIdCard size={18} />
                        <span>Hojas de vida personal</span>
                      </Link>
                    </li>
                  )}

                  {tienePermiso('gestioniingresos') && (
                    <li
                      className={
                        location.pathname === '/control-de-ingresos'
                          ? 'active'
                          : ''
                      }
                    >
                      <Link to='/control-de-ingresos' onClick={handleLinkClick}>
                        <BiDoorOpen size={18} />
                        <span>Control de Ingresos</span>
                      </Link>
                    </li>
                  )}

                  {tienePermiso('awTiemposEnPc') && (
                    <li
                      className={
                        location.pathname === '/tiempos-pc' ? 'active' : ''
                      }
                    >
                      <Link to='/tiempos-pc' onClick={handleLinkClick}>
                        <BiTimeFive size={18} />
                        <span>Tiempos en PC</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </li>
            )}

            {tienePermiso('financiera') && (
              <li
                className={location.pathname === '/financiera' ? 'active' : ''}
              >
                <Link to='/financiera' onClick={handleLinkClick}>
                  <BiDollar size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Financiera
                  </span>
                </Link>
              </li>
            )}

            {tienePermiso('perfilAdmin') && (
              <li
                className={
                  location.pathname === '/perfil-admin' ? 'active' : ''
                }
              >
                <Link to='/perfil-admin' onClick={handleLinkClick}>
                  <BiLock size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Perfil Admin
                  </span>
                </Link>
              </li>
            )}

            {tienePermiso('terceros') && (
              <li className={location.pathname === '/terceros' ? 'active' : ''}>
                <Link to='/terceros' onClick={handleLinkClick}>
                  <BiGitMerge size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Gestión de Terceros
                  </span>
                </Link>
              </li>
            )}

            {tienePermiso('tickets') && (
              <li className={location.pathname === '/tickets' ? 'active' : ''}>
                <Link to='/tickets' onClick={handleLinkClick}>
                  <BiGitMerge size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Tickets, Proyectos y Operaciones
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* ✅ Toggle (abajo del último icono cuando está colapsado) */}
        {!isMobile && isCollapsed && (
          <div className='toggle-bottom-wrapper'>
            <button
              type='button'
              className='toggle-inside toggle-bottom'
              onClick={toggleSidebar}
              aria-label='Expandir sidebar'
            >
              <BiChevronRight size={22} />
            </button>
          </div>
        )}

        <div className='sidebar-bottom'>
          <div
            className={`sidebar-bottom-actions ${isCollapsed ? 'collapsed' : ''}`}
          >
            <div className='sidebar-notifications'>
              <NotificationsBell placement='end' />
            </div>

            <div className='profile-logout'>
              <a href='#' className='logout' onClick={handleLogout}>
                <BiLogOut size={24} />
              </a>
            </div>
          </div>

          {!isCollapsed && (
            <div
              className='sidebar-user'
              onClick={goToPerfil}
              role='button'
              tabIndex={0}
            >
              <div className='sidebar-user-avatar'>
                <SecureAvatar
                  rutaFoto={user?.personal?.ruta_foto}
                  alt={`${nombreUsuario} ${apellidoUsuario}`}
                  fallback={
                    <span className='sidebar-user-initials'>{iniciales}</span>
                  }
                />
              </div>
              <div className='sidebar-user-info'>
                <span className='sidebar-user-profile-label'>Mi perfil</span>
                <p className='sidebar-user-text'>
                  {nombreUsuario} {apellidoUsuario}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}

export default Sidebar
