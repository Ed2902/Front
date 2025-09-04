// src/components/News/NewsSection.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import { listarNoticias, eliminarNoticia } from './service_new.js'
import SecureImage from './SecureImage.jsx'
import { usePermisos } from '../../hooks/usePermisos'
import './NewsSection.css'

function groupByDate(items) {
  return items.reduce((acc, it) => {
    ;(acc[it.date] ||= []).push(it)
    return acc
  }, {})
}
function sortedDatesDesc(groups) {
  return Object.keys(groups).sort((a, b) => (a < b ? 1 : -1))
}

/** Props:
 *  - refreshKey?: cambia este valor desde la page cuando crees/edites para recargar
 */
export default function NewsSection({ refreshKey }) {
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')

  // Permisos:
  // - Ver listado: se controla desde Home con 'news'
  // - Crear y Eliminar: mismo permiso 'crearNoticia'
  const { tienePermiso } = usePermisos()
  const canCreateOrDelete = tienePermiso('crearNoticia')

  const load = useCallback(async () => {
    setLoadingList(true)
    setListError('')
    try {
      const data = await listarNoticias()
      setItems(data || [])
    } catch (e) {
      setListError(
        e?.response?.data?.error || e?.message || 'Error cargando noticias.'
      )
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (refreshKey !== undefined) load()
  }, [refreshKey, load])

  const grouped = useMemo(() => groupByDate(items), [items])
  const orderedDates = useMemo(() => sortedDatesDesc(grouped), [grouped])

  const onDelete = async id => {
    if (!canCreateOrDelete) {
      alert('No tienes permiso para eliminar noticias.')
      return
    }
    if (!confirm('¿Eliminar esta noticia?')) return
    try {
      await eliminarNoticia(id)
      setItems(prev => prev.filter(n => n.id !== id))
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'No se pudo eliminar.')
    }
  }

  return (
    <section className='news-section container-fluid py-3'>
      <div className='news-wrapper'>
        <div className='news-header'>
          <h2>Noticias / Eventos</h2>
          <small className='text-muted'>Máx. 2 por día</small>
        </div>

        <div className='news-scroll'>
          {loadingList && <p className='text-muted m-0'>Cargando noticias…</p>}
          {listError && !loadingList && (
            <div className='alert alert-danger py-2'>{listError}</div>
          )}
          {!loadingList && !listError && orderedDates.length === 0 && (
            <p className='text-muted m-0'>Aún no hay noticias.</p>
          )}

          {!loadingList &&
            !listError &&
            orderedDates.map(d => {
              const dayItems = grouped[d] || []
              const single = dayItems.length === 1

              return (
                <div key={d} className='news-day'>
                  <div className='news-day-title'>
                    <h5 className='m-0'>
                      {new Date(d + 'T00:00:00').toLocaleDateString()}
                    </h5>
                    <span className='badge text-bg-secondary'>
                      {dayItems.length}/2
                    </span>
                  </div>

                  {/* 🔥 UNA sola card por día; dentro van 1 o 2 noticias */}
                  <div className='card news-day-card'>
                    <div className={`news-day-grid ${single ? 'single' : ''}`}>
                      {dayItems.map(n => (
                        <div className='news-entry' key={n.id}>
                          <SecureImage
                            src={n.imageUrl}
                            alt={n.title || 'noticia'}
                            className='news-media'
                          />
                          <div className='news-entry-body'>
                            {n.title && (
                              <h6 className='news-title'>{n.title}</h6>
                            )}
                            <p className='news-text'>{n.text}</p>

                            {/* Acciones (Eliminar solo si tiene permiso) */}
                            {canCreateOrDelete && (
                              <div className='news-actions'>
                                <button
                                  className='btn btn-outline-danger btn-sm'
                                  onClick={() => onDelete(n.id)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hint para crear más solo si tiene permiso de crear */}
                  {canCreateOrDelete && dayItems.length < 2 && (
                    <div className='news-hint'>
                      Puedes agregar {2 - dayItems.length} noticia(s) más para
                      este día.
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    </section>
  )
}
