import React from 'react'
import './PerfilAdmin.css'
import ListaUsuarios from '../../components/perfilAdmin/ListaUsuarios.jsx'
import Sidebar from '../../components/Sidebar/Sidebar.jsx'

const PerfilAdmin = () => {
  return (
    <div className='perfil-admin-layout'>
      <Sidebar />

      <div className='perfil-admin-main'>
        <h1 className='perfil-admin-titulo'>Gestión de Permisos de Usuarios</h1>
        <p className='perfil-admin-descripcion'>
          Aquí puedes asignar qué usuarios tienen acceso a cada módulo,
          componente o tipo de información.
        </p>

        <ListaUsuarios />
      </div>
    </div>
  )
}

export default PerfilAdmin
