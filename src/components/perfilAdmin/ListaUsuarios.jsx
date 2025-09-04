// src/components/Usuarios/ListaUsuarios.jsx
import React, { useEffect, useState } from 'react'
import {
  obtenerUsuarios,
  actualizarPermisosUsuario,
} from './listaUsuarios.service'
import { BiUser, BiLock, BiBuilding, BiSave } from 'react-icons/bi'
import './ListaUsuarios.css'

const SECCIONES = [
  {
    nombre: 'Perfil Admin',
    icono: <BiLock />,
    permisos: [{ clave: 'perfilAdmin', label: 'Acceso a administración' }],
  },
  {
    nombre: 'Gestión de Bodega',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'gestionBodega', label: 'Acceso general' },
      { clave: 'ingreso', label: 'Ingreso', padre: 'gestionBodega' },
      { clave: 'salida', label: 'Salida', padre: 'gestionBodega' },
      {
        clave: 'transformacion',
        label: 'Transformación',
        padre: 'gestionBodega',
      },
      { clave: 'inventario', label: 'Inventario', padre: 'gestionBodega' },
      { clave: 'dashboard', label: 'Dashboard', padre: 'gestionBodega' },
      { clave: 'productosRS', label: 'Productos RS', padre: 'gestionBodega' },
      {
        clave: 'productosBodega',
        label: 'Productos Bodega',
        padre: 'gestionBodega',
      },
      {
        clave: 'lotesProveedor',
        label: 'Lotes Proveedor',
        padre: 'gestionBodega',
      },
      { clave: 'lotesCliente', label: 'Lotes Cliente', padre: 'gestionBodega' },
    ],
  },
  {
    nombre: 'Terceros',
    icono: <BiUser />,
    permisos: [
      { clave: 'terceros', label: 'Acceso general' },
      { clave: 'clientes', label: 'Clientes', padre: 'terceros' },
      { clave: 'proveedores', label: 'Proveedores', padre: 'terceros' },
      {
        clave: 'personal_externo',
        label: 'Personal Externo',
        padre: 'terceros',
      },
    ],
  },
  {
    nombre: 'Operaciones',
    icono: <BiBuilding />,
    permisos: [
      // 👇 Acceso general (Sidebar + ruta)
      {
        clave: 'accesoGeneralOperaciones',
        label: 'Acceso general (Operaciones)',
      },
      // 👇 Permisos del menú interno (hijos del acceso general)
      {
        clave: 'operaciones',
        label: 'Operaciones (Bodega)',
        padre: 'accesoGeneralOperaciones',
      },
      {
        clave: 'operador',
        label: 'Operador',
        padre: 'accesoGeneralOperaciones',
      },
      {
        clave: 'operacionRS',
        label: 'Operación RS',
        padre: 'accesoGeneralOperaciones',
      },
    ],
  },
  {
    nombre: 'Control de Ingresos',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'gestioniingresos', label: 'Acceso general' },
      {
        clave: 'crearUsuario',
        label: 'Crear usuario',
        padre: 'gestioniingresos',
      },
      { clave: 'marcacion', label: 'Marcación', padre: 'gestioniingresos' },
      { clave: 'reporte', label: 'Reporte', padre: 'gestioniingresos' },
    ],
  },
  {
    nombre: 'News',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'news', label: 'Acceso general' },
      { clave: 'crearNoticia', label: 'Crear Noticia', padre: 'news' },
    ],
  },
  {
    nombre: 'Tickets Soporte Técnico',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'tickets', label: 'Acceso general' },
      { clave: 'crearTicket', label: 'Crear Ticket', padre: 'tickets' },
      { clave: 'soporteTicket', label: 'Soporte Ticket', padre: 'tickets' },
    ],
  },
]

const ListaUsuarios = () => {
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const data = await obtenerUsuarios()
        const formateados = data.map(usuario => ({
          id: usuario.id_usuario,
          username: usuario.username,
          permisos: {
            // defaults

            // Perfil
            perfilAdmin: false,

            // Bodega
            gestionBodega: false,
            ingreso: false,
            salida: false,
            transformacion: false,
            inventario: false,
            dashboard: false,
            productosRS: false,
            productosBodega: false,
            lotesProveedor: false,
            lotesCliente: false,

            // Terceros
            terceros: false,
            clientes: false,
            proveedores: false,
            personal_externo: false,

            // Operaciones
            accesoGeneralOperaciones: false, // 👈 acceso general (Sidebar + ruta)
            operaciones: false, // 👈 menú: Operaciones Bodega
            operador: false, // 👈 menú: Operador
            operacionRS: false, // 👈 menú: Operaciones RS

            // Control de Ingresos
            gestioniingresos: false,
            crearUsuario: false,
            marcacion: false,
            reporte: false,

            // News
            news: false,
            crearNoticia: false,

            // merge con lo guardado en BD
            ...JSON.parse(usuario.permisos || '{}'),
          },
          editado: false,
        }))
        setUsuarios(formateados)
      } catch (error) {
        console.error('Error al cargar usuarios:', error)
      }
    }

    fetchUsuarios()
  }, [])

  // ---------- Helpers de "seleccionar todos" ----------
  const allUsersHavePermiso = permisoClave =>
    usuarios.length > 0 && usuarios.every(u => !!u.permisos[permisoClave])

  const togglePermisoAllUsers = (permisoClave, value) => {
    setUsuarios(prev =>
      prev.map(u => ({
        ...u,
        permisos: { ...u.permisos, [permisoClave]: value },
        editado: true,
      }))
    )
  }

  const getSectionKeys = seccion => seccion.permisos.map(p => p.clave)

  const getSectionParentKeys = seccion =>
    Array.from(new Set(seccion.permisos.map(p => p.padre).filter(Boolean)))

  const userHasEntireSection = (usuario, seccion) => {
    const keys = getSectionKeys(seccion)
    return keys.every(k => !!usuario.permisos[k])
  }

  const toggleSectionForUser = (userId, seccion, value) => {
    const keys = getSectionKeys(seccion)
    const parentKeys = getSectionParentKeys(seccion)

    setUsuarios(prev =>
      prev.map(u => {
        if (u.id !== userId) return u
        const nuevosPermisos = { ...u.permisos }
        // set de todos los permisos de la sección
        keys.forEach(k => {
          nuevosPermisos[k] = value
        })
        // Si NO quieres que "Seleccionar todo" toque el acceso general,
        // comenta este bloque de padres:
        parentKeys.forEach(pk => {
          nuevosPermisos[pk] = value
        })
        return { ...u, permisos: nuevosPermisos, editado: true }
      })
    )
  }
  // -----------------------------------------------------

  const handleCheckboxChange = (id, permiso) => {
    setUsuarios(prev =>
      prev.map(usuario =>
        usuario.id === id
          ? {
              ...usuario,
              permisos: {
                ...usuario.permisos,
                [permiso]: !usuario.permisos[permiso],
              },
              editado: true,
            }
          : usuario
      )
    )
  }

  const handleGuardar = async id => {
    const usuario = usuarios.find(u => u.id === id)
    try {
      await actualizarPermisosUsuario(id, usuario.permisos)
      setUsuarios(prev =>
        prev.map(u => (u.id === id ? { ...u, editado: false } : u))
      )
      alert('Permisos actualizados correctamente.')
    } catch (error) {
      console.error('Error al guardar permisos:', error)
      alert('Error al guardar cambios.')
    }
  }

  return (
    <div className='container mt-4'>
      <h2 className='mb-4'>Control de Permisos</h2>

      <table className='table table-bordered text-center tabla-transpuesta'>
        <thead>
          <tr>
            <th>Permisos</th>
            {usuarios.map(usuario => (
              <th key={usuario.id}>
                <div className='usuario-header'>
                  <strong>{usuario.username}</strong>
                  <button
                    className='btn-actualizar'
                    disabled={!usuario.editado}
                    onClick={() => handleGuardar(usuario.id)}
                    title='Guardar cambios'
                  >
                    <BiSave size={20} />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECCIONES.map((seccion, idx) => (
            <React.Fragment key={seccion.nombre}>
              {/* Encabezado de sección (acordeón) */}
              <tr className='bg-light'>
                <td colSpan={usuarios.length + 1}>
                  <button
                    className='accordion-button collapsed seccion-toggle'
                    type='button'
                    data-bs-toggle='collapse'
                    data-bs-target={`#collapse-${idx}`}
                    aria-expanded='false'
                  >
                    <span className='me-2'>{seccion.icono}</span>{' '}
                    {seccion.nombre}
                  </button>
                </td>
              </tr>

              {/* Fila de control por sección: "Seleccionar todo en la sección" por usuario */}
              <tr className='collapse' id={`collapse-${idx}`}>
                <td className='fw-bold text-start'>
                  Seleccionar todo en sección
                </td>
                {usuarios.map(usuario => {
                  const checked = userHasEntireSection(usuario, seccion)
                  return (
                    <td key={`all_${seccion.nombre}_${usuario.id}`}>
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={e =>
                          toggleSectionForUser(
                            usuario.id,
                            seccion,
                            e.target.checked
                          )
                        }
                      />
                    </td>
                  )
                })}
              </tr>

              {/* Filas de cada permiso dentro de la sección */}
              {seccion.permisos.map(permiso => (
                <tr
                  key={permiso.clave}
                  className='collapse'
                  id={`collapse-${idx}`}
                >
                  <td
                    className={
                      permiso.padre ? 'ps-4 text-start' : 'fw-bold text-start'
                    }
                  >
                    {/* Checkbox maestro para marcar este permiso en TODOS los usuarios */}
                    <div className='d-flex align-items-center gap-2'>
                      <span>{permiso.label}</span>
                      <input
                        type='checkbox'
                        title='Aplicar a todos los usuarios'
                        checked={allUsersHavePermiso(permiso.clave)}
                        onChange={e =>
                          togglePermisoAllUsers(permiso.clave, e.target.checked)
                        }
                      />
                    </div>
                  </td>

                  {usuarios.map(usuario => {
                    const padreInactivo =
                      permiso.padre && !usuario.permisos[permiso.padre]
                    return (
                      <td key={usuario.id + permiso.clave}>
                        <input
                          type='checkbox'
                          checked={usuario.permisos[permiso.clave] || false}
                          onChange={() =>
                            handleCheckboxChange(usuario.id, permiso.clave)
                          }
                          disabled={padreInactivo}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ListaUsuarios
