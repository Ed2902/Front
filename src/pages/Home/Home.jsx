// src/pages/Home/Home.jsx
import { useState } from 'react'
import Sidebar from '../../components/Sidebar/Sidebar'
import NewsSection from '../../components/News/NewsSection.jsx'
import NewsForm from '../../components/News/NewsForm.jsx'
import { usePermisos } from '../../hooks/usePermisos'
import './Home.css'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { tienePermiso } = usePermisos()

  const canViewNews = tienePermiso('news') // Ver listado
  const canCreateNews = tienePermiso('crearNoticia') // Ver formulario de creación

  const handleCreated = () => setRefreshKey(k => k + 1)

  return (
    <section className='layout'>
      <Sidebar />
      <div className='body'>
        {/* Lista de noticias (solo si tiene permiso 'news') */}
        {canViewNews ? (
          <NewsSection refreshKey={refreshKey} />
        ) : (
          <div className='alert alert-warning my-3'>
            No tienes permiso para ver las noticias.
          </div>
        )}

        <div className='my-3' />

        {/* Formulario de creación (solo si tiene permiso 'crearNoticia') */}
        {canCreateNews && <NewsForm onCreated={handleCreated} />}
      </div>
    </section>
  )
}
