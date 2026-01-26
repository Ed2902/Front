import './PerfilAdmin.css'
import ListaUsuarios from '../../components/perfilAdmin/ListaUsuarios.jsx'

const PerfilAdmin = () => {
  return (
    <div className='page'>
      <h1 className='perfil-admin-titulo'>Gestión de Permisos de Usuarios</h1>

      <p className='perfil-admin-descripcion'>
        Aquí puedes asignar qué usuarios tienen acceso a cada módulo, componente
        o tipo de información.
      </p>

      <ListaUsuarios />
    </div>
  )
}

export default PerfilAdmin
