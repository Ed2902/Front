// src/components/Usuarios/ListaUsuarios.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import DataTable from 'react-data-table-component'
import {
  obtenerUsuarios,
  actualizarPermisosUsuario,
} from './listaUsuarios.service'
import { BiUser, BiLock, BiBuilding, BiSave } from 'react-icons/bi'

// =================== Definición de secciones (pilares) ===================

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
      {
        clave: 'formatoEquivalente',
        label: 'Formato equivalente',
        padre: 'gestionBodega',
      },
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
      {
        clave: 'accesoGeneralOperaciones',
        label: 'Acceso general (Operaciones)',
      },
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
  // ===================== NUEVA SECCIÓN =====================
  {
    nombre: 'Gestión del Talento',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'gestionTalento', label: 'Acceso general' },

      {
        clave: 'hojasDeVidaPersonal',
        label: 'Hojas de vida del personal',
        padre: 'gestionTalento',
      },
      {
        clave: 'gestioniingresos',
        label: 'Control de ingresos',
        padre: 'gestionTalento',
      },
      {
        clave: 'awTiemposEnPc',
        label: 'Tiempos en PC',
        padre: 'gestionTalento',
      },
    ],
  },
  // =========================================================
  {
    nombre: 'News',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'news', label: 'Acceso general' },
      { clave: 'crearNoticia', label: 'Crear Noticia', padre: 'news' },
    ],
  },
  {
    nombre: 'Tickets',
    icono: <BiBuilding />,
    permisos: [
      // Acceso base
      { clave: 'tickets', label: 'Acceso general' },

      // Módulos de tickets (frontend)
      { clave: 'misCreaciones', label: 'Mis Creaciones', padre: 'tickets' },
      { clave: 'misTareas', label: 'Mis Tareas', padre: 'tickets' },

      //  Supervisor
      { clave: 'seguimiento', label: 'Seguimiento', padre: 'tickets' },

      // Administración de tickets
      {
        clave: 'adminCatalogos',
        label: 'Administrar Catálogos',
        padre: 'tickets',
      },
      { clave: 'adminAreas', label: 'Administrar Áreas', padre: 'tickets' },
      { clave: 'adminTeams', label: 'Administrar Teams', padre: 'tickets' },
    ],
  },

  // ===================== AJUSTE FINANCIERA (jerarquía) =====================
  {
    nombre: 'Financiera',
    icono: <BiBuilding />,
    permisos: [
      { clave: 'financiera', label: 'Acceso general' },

      {
        clave: 'tablaFinanciera',
        label: 'Tabla financiera',
        padre: 'financiera',
      },

      {
        clave: 'verPreciosFinanciera',
        label: 'Ver precios y valores',
        padre: 'financiera',
      },

      {
        clave: 'controlFacturas',
        label: 'Control facturas',
        padre: 'financiera',
      },

      { clave: 'factventas', label: 'Factventas', padre: 'controlFacturas' },
      { clave: 'factcompras', label: 'Factcompras', padre: 'controlFacturas' },
    ],
  },
]

// Lista plana de permisos para defaults
const PERMISOS_PLANOS = SECCIONES.flatMap(sec => sec.permisos.map(p => p.clave))

const ListaUsuarios = () => {
  const [usuarios, setUsuarios] = useState([])
  const [busqueda, setBusqueda] = useState('')

  // ====== Cargar usuarios ======
  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const data = await obtenerUsuarios()
        const formateados = data.map(usuario => {
          const base = Object.fromEntries(PERMISOS_PLANOS.map(k => [k, false]))
          let guardados = {}
          try {
            guardados = JSON.parse(usuario.permisos || '{}')
          } catch {
            guardados = {}
          }
          return {
            id: usuario.id_usuario,
            username: usuario.username,
            permisos: { ...base, ...guardados },
            editado: false,
          }
        })
        setUsuarios(formateados)
      } catch (error) {
        console.error('Error al cargar usuarios:', error)
      }
    }
    fetchUsuarios()
  }, [])

  // ====== Helpers de edición / toggles ======
  const togglePermisoUsuario = useCallback((userId, clave) => {
    setUsuarios(prev =>
      prev.map(u =>
        u.id === userId
          ? {
              ...u,
              permisos: { ...u.permisos, [clave]: !u.permisos[clave] },
              editado: true,
            }
          : u
      )
    )
  }, [])

  const allUsersHavePermiso = useCallback(
    clave => usuarios.length > 0 && usuarios.every(u => !!u.permisos[clave]),
    [usuarios]
  )

  const togglePermisoAll = useCallback((clave, checked) => {
    setUsuarios(prev =>
      prev.map(u => ({
        ...u,
        permisos: { ...u.permisos, [clave]: checked },
        editado: true,
      }))
    )
  }, [])

  const getSectionKeys = useCallback(
    seccion => seccion.permisos.map(p => p.clave),
    []
  )
  const getSectionParentKeys = useCallback(
    seccion =>
      Array.from(new Set(seccion.permisos.map(p => p.padre).filter(Boolean))),
    []
  )

  const userHasEntireSection = useCallback(
    (usuario, seccion) =>
      getSectionKeys(seccion).every(k => !!usuario.permisos[k]),
    [getSectionKeys]
  )

  const toggleSectionForUser = useCallback(
    (userId, seccion, value) => {
      const keys = getSectionKeys(seccion)
      const parentKeys = getSectionParentKeys(seccion)
      setUsuarios(prev =>
        prev.map(u => {
          if (u.id !== userId) return u
          const nuevos = { ...u.permisos }
          keys.forEach(k => {
            nuevos[k] = value
          })
          parentKeys.forEach(pk => {
            nuevos[pk] = value
          })
          return { ...u, permisos: nuevos, editado: true }
        })
      )
    },
    [getSectionKeys, getSectionParentKeys]
  )

  const handleGuardar = useCallback(
    async id => {
      const usuario = usuarios.find(u => u.id === id)
      if (!usuario) return
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
    },
    [usuarios]
  )

  // ====== Datos del DataTable padre (secciones) ======
  const seccionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return SECCIONES
    return SECCIONES.filter(
      sec =>
        sec.nombre.toLowerCase().includes(q) ||
        sec.permisos.some(p => p.label.toLowerCase().includes(q))
    )
  }, [busqueda])

  const parentColumns = useMemo(
    () => [
      {
        name: 'Sección',
        selector: r => r.nombre,
        sortable: true,
        grow: 2,
        minWidth: '280px',
        cell: r => (
          <div className='d-flex align-items-center gap-2'>
            <span>{r.icono}</span>
            <span className='fw-semibold'>{r.nombre}</span>
          </div>
        ),
      },
      {
        name: 'Permisos',
        selector: r => r.permisos.length,
        sortable: true,
        right: true,
        width: '130px',
      },
      {
        name: 'Usuarios',
        selector: () => usuarios.length,
        sortable: false,
        right: true,
        width: '120px',
      },
    ],
    [usuarios]
  )

  // ====== Columnas de la subtabla (por sección) ======
  const buildChildColumns = useCallback(
    seccion => {
      const isSectionSelectorRow = row => row.__tipo === 'SELECCION_SECCION'

      const baseCols = [
        {
          name: 'Permiso',
          selector: row => row.label || 'Seleccionar todo en sección',
          sortable: false,
          grow: 3,
          minWidth: '340px',
          cell: row => (
            <span className={row.padre ? 'ps-3' : 'fw-semibold'}>
              {isSectionSelectorRow(row)
                ? 'Seleccionar todo en sección'
                : row.label}
            </span>
          ),
        },
        {
          name: 'Todos',
          width: '120px',
          right: true,
          cell: row => {
            if (isSectionSelectorRow(row))
              return <span className='text-muted'>—</span>
            return (
              <input
                type='checkbox'
                title='Aplicar a todos los usuarios'
                checked={allUsersHavePermiso(row.clave)}
                onChange={e => togglePermisoAll(row.clave, e.target.checked)}
              />
            )
          },
          ignoreRowClick: true,
          button: true,
        },
      ]

      const userCols = usuarios.map(u => ({
        name: (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              rowGap: '12px',
              minWidth: '120px',
            }}
          >
            <strong style={{ lineHeight: 1.1, textAlign: 'center' }}>
              {u.username}
            </strong>
            <button
              className='btn btn-sm btn-primary'
              style={{ padding: '4px 8px' }}
              disabled={!u.editado}
              onClick={() => handleGuardar(u.id)}
              title='Guardar cambios'
            >
              <BiSave />
            </button>
          </div>
        ),
        width: '160px',
        right: true,
        cell: row => {
          if (isSectionSelectorRow(row)) {
            const checked = userHasEntireSection(u, seccion)
            return (
              <input
                type='checkbox'
                checked={checked}
                onChange={e =>
                  toggleSectionForUser(u.id, seccion, e.target.checked)
                }
              />
            )
          }
          const padreInactivo = row.padre && !u.permisos[row.padre]
          return (
            <input
              type='checkbox'
              checked={u.permisos[row.clave] || false}
              disabled={padreInactivo}
              onChange={() => togglePermisoUsuario(u.id, row.clave)}
            />
          )
        },
        ignoreRowClick: true,
        button: true,
      }))

      return [...baseCols, ...userCols]
    },
    [
      usuarios,
      allUsersHavePermiso,
      togglePermisoAll,
      handleGuardar,
      userHasEntireSection,
      toggleSectionForUser,
      togglePermisoUsuario,
    ]
  )

  // ====== Componente expandible (subtabla por sección) ======
  const ExpandedComponent = useCallback(
    ({ data: seccion }) => {
      const selectorSeccion = {
        __tipo: 'SELECCION_SECCION',
        id: `__sel_${seccion.nombre}`,
      }
      const rows = [selectorSeccion, ...seccion.permisos]
      const childColumns = buildChildColumns(seccion)

      return (
        <div className='w-100 px-2 py-2'>
          <DataTable
            columns={childColumns}
            data={rows}
            dense
            responsive
            highlightOnHover
            noHeader
            pagination={false}
          />
        </div>
      )
    },
    [buildChildColumns]
  )

  // ====== SubHeader (buscador) ======
  const SubHeader = useMemo(
    () => (
      <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
        <div className='input-group' style={{ maxWidth: 360 }}>
          <span className='input-group-text'>Buscar</span>
          <input
            type='text'
            className='form-control'
            placeholder='Sección o permiso…'
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>
    ),
    [busqueda]
  )

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'></div>

      <div className='card-body'>
        <DataTable
          columns={parentColumns}
          data={seccionesFiltradas}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 50]}
          highlightOnHover
          dense
          responsive
          subHeader
          subHeaderComponent={SubHeader}
          persistTableHead
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>
    </div>
  )
}

export default ListaUsuarios
