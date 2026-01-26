// src/pages/Home/Home.jsx
import { useState } from 'react'
import NewsSection from '../../components/News/NewsSection.jsx'
import NewsForm from '../../components/News/NewsForm.jsx'
import { usePermisos } from '../../hooks/usePermisos'
import './Home.css'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { tienePermiso } = usePermisos()

  const canViewNews = tienePermiso('news')
  const canCreateNews = tienePermiso('crearNoticia')

  const handleCreated = () => setRefreshKey(k => k + 1)

  return (
    <div className='page'>
      {canViewNews ? (
        <NewsSection refreshKey={refreshKey} />
      ) : (
        <div className='alert alert-warning my-3'>
          No tienes permiso para ver las noticias.
        </div>
      )}

      <div className='my-3' />

      {canCreateNews && <NewsForm onCreated={handleCreated} />}
    </div>
  )
}
