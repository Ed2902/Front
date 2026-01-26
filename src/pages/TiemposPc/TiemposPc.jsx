// src/pages/TiemposPc/TiemposPc.jsx
import { useEffect, useState } from 'react'
import './TiemposPc.css'

// 👉 importa tu servicio
import TiemposPcSrv from '../../components/TiemposPc/service.TiemposPc'

// 👉 componentes
import FiltroFechasBusqueda from '../../components/TiemposPc/FiltroFechasBusqueda'
import TablaUsuariosTiempos from '../../components/TiemposPc/TablaUsuariosTiempos'
import ModalDetalleApps from '../../components/TiemposPc/DetalleActividad.jsx'

// helpers fecha
const pad2 = n => String(n).padStart(2, '0')
const toYMD = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  return toYMD(d)
}

export default function TiemposPc() {
  // estado filtro
  const [date, setDate] = useState(yesterday())
  const [search, setSearch] = useState('')

  // datos
  const [users, setUsers] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // modal detalle
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleRow, setDetalleRow] = useState(null)

  // carga lista de usuarios
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const u = await TiemposPcSrv.getUsers()
        if (!cancel) setUsers(u)
      } catch (e) {
        if (!cancel) setError('No se pudo cargar la lista de usuarios')
        console.error(e)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const cargar = async () => {
    setLoading(true)
    setError('')
    setRows([])
    try {
      const out = []
      for (const user of users) {
        try {
          const latest = await TiemposPcSrv.getLatest(user)
          const hostname = latest?.hostname || null
          if (!hostname) {
            out.push({ user, date, error: 'Sin hostname en /reports/latest' })
            continue
          }
          const report = await TiemposPcSrv.getReportByDateHost({
            user,
            date,
            hostname,
          })
          const metrics = TiemposPcSrv.computeMetrics(report)
          out.push({ user, hostname, date, metrics })
        } catch (err) {
          out.push({ user, date, error: String(err?.message || err) })
        }
      }
      setRows(out)
    } catch (e) {
      setError('Error cargando métricas')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const verDetalle = row => {
    setDetalleRow(row)
    setDetalleOpen(true)
  }

  return (
    <div className='page'>
      <h2 className='mb-3'>Tiempos en PC</h2>

      {/* Filtros */}
      <div className='card p-3 mb-3'>
        <FiltroFechasBusqueda
          date={date}
          search={search}
          onDateChange={setDate}
          onSearchChange={setSearch}
          onCargar={cargar}
        />
      </div>

      {/* Tabla */}
      <div className='card p-3'>
        <TablaUsuariosTiempos
          rows={rows}
          loading={loading}
          error={error}
          search={search}
          onVerDetalle={verDetalle}
        />
      </div>

      {/* Modal */}
      <ModalDetalleApps
        open={detalleOpen}
        onClose={() => setDetalleOpen(false)}
        row={detalleRow}
      />
    </div>
  )
}
