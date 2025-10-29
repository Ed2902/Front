// src/components/ControlIngresos/Marcacion/AprobacionSlider.jsx
import React, { useMemo } from 'react'
import './AprobacionSlider.css'

const ESTADOS = ['RECHAZADO', 'PENDIENTE', 'APROBADO']

export default function AprobacionSlider({
  value = 'PENDIENTE',
  onChange,
  disabled = false,
  size = 'md', // 'sm' | 'md' | 'lg' (puedes ajustar tamaños con CSS)
}) {
  const estado = useMemo(() => {
    return ESTADOS.includes(value) ? value : 'PENDIENTE'
  }, [value])

  const colorClass =
    estado === 'RECHAZADO'
      ? 'tri-red'
      : estado === 'PENDIENTE'
      ? 'tri-yellow'
      : 'tri-green'

  const pos = estado === 'RECHAZADO' ? 0 : estado === 'PENDIENTE' ? 1 : 2

  const handleClick = () => {
    if (disabled) return
    let next
    if (estado === 'PENDIENTE') {
      // desde PENDIENTE solo se pasa a APROBADO (no se puede volver a PENDIENTE)
      next = 'APROBADO'
    } else if (estado === 'APROBADO') {
      // alterna con RECHAZADO
      next = 'RECHAZADO'
    } else {
      // estado === 'RECHAZADO' → alterna con APROBADO
      next = 'APROBADO'
    }
    onChange?.(next)
  }

  return (
    <div
      className={`tri-toggle ${colorClass} ${
        disabled ? 'disabled' : ''
      } size-${size}`}
      role='button'
      aria-label={`Aprobación: ${estado}`}
      title={estado}
      onClick={handleClick}
    >
      <div className='tri-track'>
        <div className='tri-thumb' data-pos={pos} />
        <div className='tri-sep' />
        <div className='tri-sep' />
      </div>
      <span className='tri-label'>{estado}</span>
    </div>
  )
}
