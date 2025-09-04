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
  BiChevronDown,
  BiChevronUp,
  BiPackage,
  BiCog,
  BiBody,
  BiSolidUserVoice,
} from 'react-icons/bi'
import AuthContext from '../../context/AuthContext'
import { usePermisos } from '../../hooks/usePermisos'
import './Sidebar.css'

const Sidebar = ({ onToggleCollapse }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)

  const { logout, user } = useContext(AuthContext)
  const { tienePermiso } = usePermisos()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth > 768) {
        setIsMobileOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mantener abierto el submenu si estás en una de sus rutas
  useEffect(() => {
    if (['/gestion-bodega', '/operaciones'].includes(location.pathname)) {
      setIsSubmenuOpen(true)
    }
  }, [location.pathname])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen)
    } else {
      const newCollapsed = !isCollapsed
      setIsCollapsed(newCollapsed)
      if (onToggleCollapse) onToggleCollapse(newCollapsed)
    }
  }

  const toggleSubmenu = () => setIsSubmenuOpen(prev => !prev)
  const handleLinkClick = () => {
    if (isMobile) setIsMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const nombreUsuario = user?.personal?.nombre || ''
  const apellidoUsuario = user?.personal?.apellido || ''

  return (
    <div className='sidebar-container'>
      {isMobile && (
        <div className='mobile-menu-button' onClick={toggleSidebar}>
          <BiMenu size={30} />
        </div>
      )}

      <nav
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'open' : ''
        }`}
      >
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
            {/* 🏠 Inicio (/home) */}
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

            {/* Bodega (submenu) */}
            {tienePermiso('gestionBodega') && (
              <li className={`has-submenu ${isSubmenuOpen ? 'open' : ''}`}>
                <div className='submenu-toggle' onClick={toggleSubmenu}>
                  <div className='submenu-title'>
                    <BiHome size={20} />
                    <span
                      className={`${
                        isCollapsed && !isMobileOpen ? 'hide-text' : ''
                      }`}
                    >
                      Bodega
                    </span>
                  </div>
                  <span className='chevron-icon'>
                    {isSubmenuOpen ? (
                      <BiChevronUp size={16} />
                    ) : (
                      <BiChevronDown size={16} />
                    )}
                  </span>
                </div>

                <ul className='submenu'>
                  <li
                    className={
                      location.pathname === '/gestion-bodega' ? 'active' : ''
                    }
                  >
                    <Link to='/gestion-bodega' onClick={handleLinkClick}>
                      <BiPackage size={18} />
                      <span>Inventario</span>
                    </Link>
                  </li>

                  {/* Operaciones dentro de Bodega */}
                  {tienePermiso('accesoGeneralOperaciones') && (
                    <li
                      className={
                        location.pathname === '/operaciones' ? 'active' : ''
                      }
                    >
                      <Link to='/operaciones' onClick={handleLinkClick}>
                        <BiCog size={18} />
                        <span>Operaciones</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </li>
            )}

            {/* (Eliminado) Operaciones como ítem de nivel superior */}
            {/* Antes estaba aquí el li de Operaciones */}

            {/* Control de Ingresos */}
            {tienePermiso('gestioniingresos') && (
              <li
                className={
                  location.pathname === '/control-de-ingresos' ? 'active' : ''
                }
              >
                <Link to='/control-de-ingresos' onClick={handleLinkClick}>
                  <BiBody size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Control de Ingresos
                  </span>
                </Link>
              </li>
            )}

            {/* Perfil Admin */}
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

            {/* Terceros */}
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
            {/* Tickets */}
            {tienePermiso('tickets') && (
              <li className={location.pathname === '/tickets' ? 'active' : ''}>
                <Link to='/tickets' onClick={handleLinkClick}>
                  <BiGitMerge size={20} />
                  <span
                    className={`${
                      isCollapsed && !isMobileOpen ? 'hide-text' : ''
                    }`}
                  >
                    Tickets Soporte Técnico
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className='sidebar-bottom'>
          <div className='profile-logout'>
            <a href='#' className='logout' onClick={handleLogout}>
              <BiLogOut size={24} />
            </a>
          </div>

          {!isCollapsed && (
            <div className='sidebar-user'>
              <p className='sidebar-user-text'>
                Hola, {nombreUsuario} {apellidoUsuario}
              </p>
            </div>
          )}
        </div>
      </nav>

      {!isMobile && (
        <div className='toggle-tab' onClick={toggleSidebar}>
          {isCollapsed ? (
            <BiChevronRight size={24} />
          ) : (
            <BiChevronLeft size={24} />
          )}
        </div>
      )}
    </div>
  )
}

export default Sidebar
