// src/components/Operaciones/utils/inventario.js
import { getEstadoInventarioPorOperacion } from './operacion_service' // ajusta si tu ruta cambia

// ---------- Utils ----------
export const formatearFechaHora = fecha => {
  if (!fecha) return ''
  const f = new Date(fecha)
  const yyyy = f.getFullYear()
  const MM = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  const hh = String(f.getHours()).padStart(2, '0')
  const mm = String(f.getMinutes()).padStart(2, '0')
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}`
}

export const formatDuration = ms => {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

// ---------- Reglas ----------
export const TIPOS_GESTION = new Set([
  'ENTRADA',
  'SALIDA',
  'TRANSFORMACION',
  'EMPAQUE',
  'PACKING',
  'PICKING',
  'REUBICACION',
])

export const TIPOS_MOVIMIENTO = new Set(['REUBICACION', 'TRANSFERENCIA_BODEGA'])

export const TIPOS_SECUNDARIOS = new Set([
  'EMPAQUE',
  'PACKING',
  'PICKING',
  'REUBICACION',
  'TRANSFORMACION',
])

export const getIdTipo = op =>
  String(op?.id_tipo_operacion || '')
    .trim()
    .toUpperCase()

export const requiereGestionInventario = op => TIPOS_GESTION.has(getIdTipo(op))

// --- Alias de movimiento con y sin tildes ---
const TIPO_TO_LABEL = {
  ENTRADA: ['Entrada', 'ENTRADA', 'entrada'],
  SALIDA: ['Salida', 'SALIDA', 'salida'],
  TRANSFORMACION: [
    'Transformación',
    'TRANSFORMACION',
    'Transformacion',
    'transformación',
  ],
  EMPAQUE: ['Empaque', 'EMPAQUE', 'empaque'],
  PACKING: ['Packing', 'PACKING', 'packing'],
  PICKING: ['Picking', 'PICKING', 'picking'],
  REUBICACION: ['Reubicación', 'REUBICACION', 'Reubicacion', 'reubicación'],
  TRANSFERENCIA_BODEGA: [
    'Transferencia Bodega',
    'TRANSFERENCIA_BODEGA',
    'transferencia bodega',
  ],
}

const movimientoTipoAliases = op => {
  const id = getIdTipo(op)
  const fromNombre = (op?.TiposOperacion?.Nombre || '').trim()
  const lista = new Set()

  // 1) Si viene el nombre “bonito” desde BD, pruébalo primero (p.ej. “Transformación / Ensamble” → toma la primera palabra)
  if (fromNombre) {
    const base = fromNombre.split('/')[0].trim()
    if (base) lista.add(base)
  }

  // 2) Alias conocidos por id
  if (TIPO_TO_LABEL[id]) {
    TIPO_TO_LABEL[id].forEach(a => lista.add(a))
  }

  // 3) Variantes genéricas
  const idTitle = id.charAt(0) + id.slice(1).toLowerCase()
  lista.add(idTitle)
  lista.add(id)
  lista.add(id.toLowerCase())

  return Array.from(lista)
}

// --- Modo cantidades ---
// EXACTA: requiere match exacto
// AL_MENOS: movido >= esperado
const MODO_CANTIDADES_BY_TIPO = {
  DEFAULT: 'EXACTA',
  TRANSFORMACION: 'AL_MENOS',
  // Si quieres flexible para empaque/packing/picking, descomenta:
  // EMPAQUE: 'AL_MENOS',
  // PACKING: 'AL_MENOS',
  // PICKING: 'AL_MENOS',
}
const getModoCantidades = tipo =>
  MODO_CANTIDADES_BY_TIPO[tipo] || MODO_CANTIDADES_BY_TIPO.DEFAULT

const TOLERANCIA = 0 // 0 exacto; p.ej. 0.02 = 2%
const cumple = (movida, esperada, modo) => {
  if (modo === 'AL_MENOS') return movida + 1e-9 >= esperada
  return Math.abs(movida - esperada) <= Math.max(1, esperada) * TOLERANCIA
}

// ---------- Items esperados ----------
export const buildItemsEsperados = fila => {
  if (Array.isArray(fila?.productos) && fila.productos.length > 0) {
    return fila.productos
      .map(p => {
        const id = p.id_producto ?? p.id ?? p.codigo ?? p.sku ?? null
        const cant = Number(p.cantidad ?? p.qty ?? p.cant ?? 0)
        return id
          ? { id: String(id), cantidad: isFinite(cant) && cant > 0 ? cant : 0 }
          : null
      })
      .filter(Boolean)
      .filter(it => it.cantidad > 0)
  }

  if (Array.isArray(fila?.productos_ids) && fila.productos_ids.length > 0) {
    return fila.productos_ids.map(id => ({ id: String(id), cantidad: 1 }))
  }

  if (fila?.id_producto) {
    const cant = Number(fila.cantidad_total_items ?? 1)
    return [
      {
        id: String(fila.id_producto),
        cantidad: isFinite(cant) && cant > 0 ? cant : 1,
      },
    ]
  }

  return []
}

// ---------- Cálculo de estado ----------
export const calcularEstadoInventarioFila = async fila => {
  if (!requiereGestionInventario(fila)) return 'No aplica'

  const tipo = getIdTipo(fila)
  const modo = getModoCantidades(tipo)
  const itemsEsperados = buildItemsEsperados(fila)
  if (itemsEsperados.length === 0)
    return fila.gestion_inventario || 'Sin estado'

  const ids = itemsEsperados.map(it => it.id)
  const candidatos = movimientoTipoAliases(fila)

  // Intenta con varios alias de movimientoTipo hasta lograr un estado/detalle
  for (const movimientoTipo of candidatos) {
    try {
      const resp = await getEstadoInventarioPorOperacion(
        fila.id_operacion,
        ids,
        { movimientoTipo, itemsEsperados, comparacionCantidades: modo }
      )

      if (resp?.estado) return resp.estado

      // Fallback local con detalle de cantidades o presencia
      const detalle =
        resp?.detalle || resp?.cantidadesMovidas || resp?.movimientos
      if (Array.isArray(detalle)) {
        const movidas = new Map()
        detalle.forEach(d => {
          const id = String(d.id || d.id_producto || d.producto_id || '')
          const cant = Number(d.cantidad || d.movida || d.qty || 0)
          if (!id) return
          movidas.set(id, (movidas.get(id) || 0) + (isFinite(cant) ? cant : 0))
        })

        let totalCumplen = 0
        let totalConMovimiento = 0
        for (const it of itemsEsperados) {
          const m = movidas.get(String(it.id)) || 0
          if (m > 0) totalConMovimiento++
          if (cumple(m, it.cantidad, modo)) totalCumplen++
        }

        if (totalCumplen === itemsEsperados.length) return 'Completado'
        if (totalConMovimiento > 0) return 'Parcial'
        // si no hay movimientos para este alias, sigue probando con el siguiente
      }

      // Para modos flexibles (TRANSFORMACION) intenta segunda vez sin cantidades
      if (modo === 'AL_MENOS') {
        const resp2 = await getEstadoInventarioPorOperacion(
          fila.id_operacion,
          ids,
          { movimientoTipo }
        )
        if (resp2?.estado) return resp2.estado

        const lista = resp2?.movimientos || resp2?.idsConMovimiento
        if (Array.isArray(lista) && lista.length > 0) {
          const setIds = new Set(lista.map(x => String(x.id || x)))
          const totalConMov = itemsEsperados.filter(it =>
            setIds.has(String(it.id))
          ).length
          if (totalConMov === itemsEsperados.length) return 'Completado'
          if (totalConMov > 0) return 'Parcial'
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // prueba siguiente alias
      // console.warn('Alias falló:', movimientoTipo, e)
    }
  }

  return fila.gestion_inventario || 'Pendiente'
}
