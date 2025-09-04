// src/data/servicios.js

// Catálogo base (booleans por defecto). Montacarga va primero.
export const SERVICIOS_CATALOGO = {
  montacarga: false,
  desengrase: false,
  desarmado: false,
  empaque: false,
  picking: false,
  packing: false,
  etiquetado: false,
  paletizado: false,
  almacenamiento: false,
  inventario: false,
  recepcion: false,
  despacho: false,
  crossdocking: false,
  consolidacion: false,
  verificacion_calidad: false,
  conteo_ciclico: false,
  limpieza: false,
  carga: false,
  descarga: false,
  traslado_interno: false,
  reempaque: false,
  reetiquetado: false,
  kitting: false,
  devoluciones: false,
  gestion_residuos: false,
}

// Devuelve un clon profundo del catálogo base (para no mutar el original)
export function getServiciosCatalogo() {
  return JSON.parse(JSON.stringify(SERVICIOS_CATALOGO))
}

// Devuelve lista de nombres de servicios con valor === true
export function serviciosActivos(servicios = {}) {
  return Object.entries(servicios)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
}

/**
 * Normaliza cualquier entrada a objeto tipo catálogo:
 * - Si pasas un ARRAY: ['picking', 'montacarga'] -> marca esos como true y el resto false
 * - Si pasas un OBJETO: { picking:true, etiquetado:false } -> lo fusiona sobre el catálogo base
 * - Si pasas undefined/null -> devuelve catálogo base (todo false)
 */
export function toServiciosObjeto(input) {
  const base = getServiciosCatalogo()

  if (Array.isArray(input)) {
    for (const key of Object.keys(base)) base[key] = false
    input.forEach(name => {
      const k = String(name || '')
        .trim()
        .toLowerCase()
      if (k && k in base) base[k] = true
    })
    return base
  }

  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      const key = String(k || '')
        .trim()
        .toLowerCase()
      if (key in base) base[key] = Boolean(v)
    }
    return base
  }

  return base
}

/**
 * Fusiona un catálogo base con overrides.
 * Útil cuando una operación trae `Servicios` (string u objeto) y quieres
 * asegurar todas las llaves del catálogo final.
 */
export function mergeServicios(baseServicios, overrides) {
  const base = toServiciosObjeto(baseServicios)
  const over = toServiciosObjeto(overrides)
  for (const k of Object.keys(base)) base[k] = over[k]
  return base
}

/**
 * Helpers de (de)serialización si guardas `Servicios` como JSON string en BD
 */
export function serializeServicios(servObj) {
  return JSON.stringify(toServiciosObjeto(servObj))
}
export function parseServicios(jsonLike) {
  if (!jsonLike) return getServiciosCatalogo()
  if (typeof jsonLike === 'string') {
    try {
      return toServiciosObjeto(JSON.parse(jsonLike))
    } catch {
      return getServiciosCatalogo()
    }
  }
  return toServiciosObjeto(jsonLike)
}
