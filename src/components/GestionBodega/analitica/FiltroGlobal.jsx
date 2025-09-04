import React, { useEffect, useState } from 'react'
import { getHistorialConLote } from './analitica.service'

const FiltroGlobal = ({
  mes,
  setMes,
  año,
  setAño,
  añoComparativo,
  setAñoComparativo,
  mesComparativo,
  setMesComparativo,
  modo,
  setModo,
  tipoProducto,
  setTipoProducto,
  tiposDisponibles,
}) => {
  const [aniosDisponibles, setAniosDisponibles] = useState([])

  const meses = [
    { value: '', label: 'Seleccione un mes' },
    { value: '00', label: 'Todos' },
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ]

  useEffect(() => {
    const cargarAnios = async () => {
      try {
        const datos = await getHistorialConLote()
        const años = datos
          .map(d => new Date(d.Fecha_movimiento).getFullYear())
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => a - b)

        setAniosDisponibles(años)

        // Mes y año actual del sistema
        const hoy = new Date()
        const mesActual = String(hoy.getMonth() + 1).padStart(2, '0')
        const añoActual = hoy.getFullYear()

        // Establecer valores si aún no están definidos
        if (!mes) setMes(mesActual)
        if (!año) setAño(añoActual)
        if (!mesComparativo) setMesComparativo(mesActual)
        if (!añoComparativo) setAñoComparativo(añoActual)
      } catch (error) {
        console.error('Error cargando años:', error)
      }
    }

    cargarAnios()
  }, [
    mes,
    año,
    mesComparativo,
    añoComparativo,
    setMes,
    setAño,
    setMesComparativo,
    setAñoComparativo,
  ])

  return (
    <div className='filtro-global'>
      <div>
        <label>
          Tipo de Producto:
          <select
            value={tipoProducto}
            onChange={e => setTipoProducto(e.target.value)}
          >
            <option value=''>Todos</option>
            {tiposDisponibles.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          Modo:
          <select value={modo} onChange={e => setModo(e.target.value)}>
            <option value='simple'>Mes/Año</option>
            <option value='comparar-mes'>Comparar mismo mes</option>
            <option value='comparar-año'>Comparar año completo</option>
          </select>
        </label>
      </div>

      <div>
        <label>
          Año base:
          <select value={año} onChange={e => setAño(e.target.value)}>
            <option value=''>Seleccione un año</option>
            {aniosDisponibles.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label>
          Mes base:
          <select value={mes} onChange={e => setMes(e.target.value)}>
            {meses.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(modo === 'comparar-mes' || modo === 'comparar-año') && (
        <div>
          <label>
            Año comparativo:
            <select
              value={añoComparativo}
              onChange={e => setAñoComparativo(e.target.value)}
            >
              <option value=''>Seleccione un año</option>
              {aniosDisponibles.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {modo === 'comparar-mes' && (
            <label>
              Mes comparativo:
              <select
                value={mesComparativo}
                onChange={e => setMesComparativo(e.target.value)}
              >
                {meses.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export default FiltroGlobal
