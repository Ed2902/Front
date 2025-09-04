import { useCallback, useState } from 'react'
import { getOperaciones } from './operacion_service'
import { formatearFechaHora, calcularEstadoInventarioFila } from './inventario'

export const useOperaciones = () => {
  const [operaciones, setOperaciones] = useState([])

  const fetchOperaciones = useCallback(async () => {
    try {
      const dataProcesada = await getOperaciones()

      const operacionesParaTabla = dataProcesada.map(op => {
        let serviciosNorm = []
        if (Array.isArray(op.Servicios)) {
          serviciosNorm = op.Servicios
        } else if (typeof op.Servicios === 'string') {
          try {
            const obj = JSON.parse(op.Servicios)
            if (obj && typeof obj === 'object') {
              serviciosNorm = Object.entries(obj)
                .filter(([, v]) => !!v)
                .map(([k]) => k)
            }
          } catch {
            serviciosNorm = []
          }
        }

        const createdAt = op.fecha_creacion
          ? new Date(op.fecha_creacion).getTime()
          : 0
        const idNum =
          Number(String(op.id_operacion || '').replace(/\D/g, '')) || 0
        const id_tipo = op.id_tipo_operacion || ''
        const nombre_tipo = op?.TiposOperacion?.Nombre || ''

        return {
          id_operacion: op.id_operacion,
          tipo_operacion: nombre_tipo,
          id_tipo_operacion: id_tipo,
          tipo_operacion_display:
            id_tipo + (nombre_tipo ? ` (${nombre_tipo})` : ''),
          lote: op?.Lote?.id_lote || op.id_lote || '',
          cliente: op?.Cliente?.Nombre || '',
          operador: op?.operador?.nombre || '',
          gestion_inventario: op.Gestion_inventario,

          productos: Array.isArray(op.productos) ? op.productos : [],
          productos_ids: Array.isArray(op.productos_ids)
            ? op.productos_ids
            : [],
          productos_text: op.productos_text || '',
          cantidad_total_items: Number(op.cantidad_total_items ?? 0),

          fecha_creacion: formatearFechaHora(op.fecha_creacion),
          fecha_realizacion: formatearFechaHora(op.fecha_realizacion),
          fecha_fin: formatearFechaHora(op.fecha_fin),

          time_init: op.time_init ? new Date(op.time_init).toISOString() : null,
          time_end: op.time_end ? new Date(op.time_end).toISOString() : null,
          fecha_creacionISO: op.fecha_creacion || null,
          fecha_realizacionISO: op.fecha_realizacion || null,
          fecha_finISO: op.fecha_fin || null,

          id_lote: op.id_lote || op?.Lote?.id_lote || '',
          id_producto: op.id_producto || '',
          id_cliente: op.id_cliente || op?.Cliente?.id_Cliente || '',
          operador_fk: op.operador_fk || op?.operador?.Id_personal || '',

          tiempo_operacion: op.tiempo_operacion || '',

          personalesInternos: op.personalesInternos || [],
          personalesExternos: op.personalesExternos || [],
          servicios: serviciosNorm,

          _createdAt: createdAt,
          _idNum: idNum,
        }
      })

      operacionesParaTabla.sort((a, b) => {
        if (b._createdAt !== a._createdAt) return b._createdAt - a._createdAt
        return b._idNum - a._idNum
      })

      const operacionesConEstado = await Promise.all(
        operacionesParaTabla.map(async fila => {
          const estado = await calcularEstadoInventarioFila(fila)
          return { ...fila, gestion_inventario: estado }
        })
      )

      setOperaciones(operacionesConEstado)
    } catch (err) {
      console.error('Error al obtener operaciones:', err?.message)
    }
  }, [])

  return { operaciones, setOperaciones, fetchOperaciones }
}
