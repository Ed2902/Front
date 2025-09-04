// src/components/Tabladeoperacion/operacion_service.js
import axios from 'axios'

// ───────────────────────────────────────────────────────────────────────────────
//  Instancia base de Axios
// ───────────────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // p.ej. http://localhost:3000/api
  headers: { 'Content-Type': 'application/json' },
})

// ───────────────────────────────────────────────────────────────────────────────
//  Helpers de auth + Interceptores
// ───────────────────────────────────────────────────────────────────────────────
const getAuthToken = () => localStorage.getItem('token')

// Request: agrega siempre el Bearer token
api.interceptors.request.use(
  config => {
    const token = getAuthToken()
    if (!token) {
      throw new Error('No hay token en localStorage. Inicia sesión de nuevo.')
    }
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Response: logs claros por status
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response) {
      const { status, data } = err.response
      if (status === 400) {
        console.error('Solicitud inválida (400):', data)
      } else if (status === 401) {
        console.error('No autorizado (401). Token ausente/expirado.')
      } else if (status === 403) {
        console.error('Prohibido (403). Falta de permisos.')
      }
    }
    return Promise.reject(err)
  }
)

// ───────────────────────────────────────────────────────────────────────────────
//  SECCIÓN A) OPERACIONES
// ───────────────────────────────────────────────────────────────────────────────

export const getOperaciones = async () => {
  const response = await api.get('/operacion')
  const data = response.data

  const operacionesProcesadas = data.map(op => {
    // Normaliza Servicios (JSON/string -> array)
    let serviciosLista = []
    if (op.Servicios) {
      try {
        const serviciosObj =
          typeof op.Servicios === 'string'
            ? JSON.parse(op.Servicios)
            : op.Servicios
        if (serviciosObj && typeof serviciosObj === 'object') {
          serviciosLista = Object.entries(serviciosObj)
            .filter(([, esActivo]) => esActivo === true)
            .map(([nombreServicio]) => nombreServicio)
        }
      } catch (e) {
        console.error(
          `Error al parsear Servicios para la operación ${op.id_operacion}:`,
          e
        )
        serviciosLista = ['Formato inválido']
      }
    }

    // Calcula tiempo si hay time_init + time_end
    let tiempo_operacion = ''
    if (op.time_init && op.time_end) {
      const inicio = new Date(op.time_init)
      const fin = new Date(op.time_end)
      const diferenciaMs = fin - inicio
      const minutos = Math.floor(diferenciaMs / 60000)
      const segundos = Math.floor((diferenciaMs % 60000) / 1000)
      tiempo_operacion = `${minutos}m ${String(segundos).padStart(2, '0')}s`
    }

    // ── Normaliza ITEMS -> PRODUCTOS ───────────────────────────────────────────
    const rawItems = Array.isArray(op.items) ? op.items : []
    let productos = rawItems.map(it => ({
      id_producto: String(it?.id_producto ?? ''),
      nombre: String(it?.producto?.Nombre ?? it?.id_producto ?? ''),
      cantidad: Number(it?.cantidad ?? 0),
    }))

    // Compat hacia atrás: si NO hay items pero viene id_producto/cantidad sueltos
    if (productos.length === 0 && (op.id_producto || op.cantidad)) {
      productos = [
        {
          id_producto: String(op.id_producto ?? ''),
          nombre: String(op.Producto?.nombre ?? op.id_producto ?? ''),
          cantidad: Number(op.cantidad ?? 0),
        },
      ]
    }

    const productos_ids = productos.map(p => p.id_producto)
    const productos_text = productos
      .map(p => `${p.id_producto} - ${p.nombre} (${p.cantidad})`)
      .join('; ')
    const cantidad_total_items = productos.reduce(
      (acc, p) => acc + (Number.isFinite(p.cantidad) ? p.cantidad : 0),
      0
    )

    return {
      ...op,
      Servicios: serviciosLista,
      tiempo_operacion,
      // Campos normalizados para el front
      productos, // [{ id_producto, nombre, cantidad }]
      productos_ids, // ['1', 'producto 2', ...]
      productos_text, // "1 - 1 (5); producto 2 - prueba 2 (2.5)"
      cantidad_total_items, // suma de cantidades de items
    }
  })

  return operacionesProcesadas
}

/** Guarda una nueva operación en la base de datos. */
export const guardarOperacion = async operacion => {
  const response = await api.post('/operacion', operacion)
  return response.data
}

/** Obtiene la relación lote-producto. */
export const getLoteProducto = async () => {
  const response = await api.get('/lote-producto')
  return response.data
}

/** Obtiene lista de clientes. */
export const getClientes = async () => {
  const response = await api.get('/cliente')
  return response.data
}

/** Obtiene lista de tipos de operación. */
export const getTiposOperacion = async () => {
  const response = await api.get('/tipos-operacion')
  return response.data
}

/** Obtiene lista de personal interno. */
export const getPersonal = async () => {
  const response = await api.get('/personal')
  return response.data
}

/** Inicia una operación (PUT, sin body). */
export const iniciarOperacion = async idOperacion => {
  const response = await api.put(`/operacion/${idOperacion}/iniciar`)
  return response.data
}

/** Finaliza una operación (PUT, sin body). */
export const finalizarOperacion = async idOperacion => {
  const response = await api.put(`/operacion/${idOperacion}/finalizar`)
  return response.data
}

/** Actualiza una operación (PUT /operacion/:id). */
export const actualizarOperacion = async (idOperacion, payload) => {
  const response = await api.put(`/operacion/${idOperacion}`, payload)
  return response.data
}

/** Elimina una operación (DELETE /operacion/:id). */
export const eliminarOperacion = async idOperacion => {
  const response = await api.delete(`/operacion/${idOperacion}`)
  return response.data
}

// ───────────────────────────────────────────────────────────────────────────────
//  SECCIÓN C) ASIGNACIÓN DE PERSONAL INTERNO
// ───────────────────────────────────────────────────────────────────────────────
export const asignarPersonalInterno = async (idOperacion, idPersonal) => {
  const payload = {
    id_operacion: String(idOperacion).trim().toUpperCase(),
    id_personal: String(idPersonal).trim(),
  }
  const res = await api.post('/asignacion-personal/interno', payload)
  return res.data
}

export const asignarPersonalInternoBatch = async (
  idOperacion,
  idsPersonales = [],
  { onProgress } = {}
) => {
  const results = { ok: [], fail: [] }
  const total = idsPersonales.length

  for (let i = 0; i < total; i++) {
    const id = idsPersonales[i]
    try {
      await asignarPersonalInterno(idOperacion, id)
      results.ok.push(id)
      onProgress?.({ done: i + 1, total, id, status: 'ok' })
    } catch (err) {
      const item = {
        id,
        status: err?.response?.status,
        error:
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido',
      }
      results.fail.push(item)
      onProgress?.({
        done: i + 1,
        total,
        id,
        status: 'fail',
        error: item.error,
      })
    }
  }

  return results
}
// ───────────────────────────────────────────────────────────────────────────────
//  SECCIÓN B) PERSONAL EXTERNO + ASIGNACIÓN DE CUADRILLA (EXTERNO)
// ───────────────────────────────────────────────────────────────────────────────

/** Lista todo el personal externo. */
export const getPersonalExterno = async () => {
  const res = await api.get('/personal-externo')
  return res.data
}

/** Obtiene un externo por ID (EX123). */
export const getPersonalExternoById = async idExterno => {
  const res = await api.get(`/personal-externo/${idExterno}`)
  return res.data
}

export const asignarCuadrilla = async (idOperacion, idExterno) => {
  const payload = {
    id_operacion: String(idOperacion).trim().toUpperCase(),
    id_externo: String(idExterno).trim().toUpperCase(), // 👈 clave correcta
  }
  const res = await api.post('/asignacion-personal/externo', payload)
  return res.data
}

export const asignarCuadrillaBatch = async (idOperacion, idsExternos = []) => {
  const results = { ok: [], fail: [] }
  for (const id of idsExternos) {
    try {
      await asignarCuadrilla(idOperacion, id)
      results.ok.push(id)
    } catch (err) {
      results.fail.push({
        id,
        status: err?.response?.status,
        error:
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido',
      })
    }
  }
  return results
}

/** Consulta movimientos de inventario por operación. */
export const getMovimientosInventarioPorOperacion = async idOperacion => {
  const res = await api.get(`/operacion/${idOperacion}/movimientos-inventario`)
  return res.data // { operacion, existeMovimiento, total, items: [...] }
}

export const getEstadoInventarioPorOperacion = async (
  idOperacion,
  productosEsperados = [], // ej: ["1","2","3"]
  { movimientoTipo = 'Entrada' } = {}
) => {
  const data = await getMovimientosInventarioPorOperacion(idOperacion)

  // Si no hay movimientos aún → Pendiente directo
  if (
    !data?.existeMovimiento ||
    !Array.isArray(data?.items) ||
    data.items.length === 0
  ) {
    return {
      operacion: idOperacion,
      estado: 'Pendiente',
      productosEsperados,
      productosConMovimiento: [],
      productosSinMovimiento: productosEsperados.slice(),
      totalMovimientos: 0,
      raw: data,
    }
  }

  // Normaliza ids a string
  const exp = new Set(productosEsperados.map(p => String(p)))

  // Productos con al menos un movimiento válido (por defecto, tipo Entrada)
  const productosConMovSet = new Set(
    data.items
      .filter(
        it =>
          String(it?.operacion) === String(idOperacion) &&
          (!movimientoTipo ||
            String(it?.Movimiento_tipo).toLowerCase() ===
              String(movimientoTipo).toLowerCase())
      )
      .map(it => String(it?.id_producto))
      .filter(idp => exp.has(idp))
  )

  const productosConMovimiento = [...productosConMovSet]
  const productosSinMovimiento = productosEsperados
    .map(String)
    .filter(idp => !productosConMovSet.has(idp))

  let estado = 'Pendiente'
  if (productosConMovimiento.length === 0) {
    estado = 'Pendiente'
  } else if (
    productosConMovimiento.length === productosEsperados.length &&
    productosEsperados.length > 0
  ) {
    estado = 'Completado'
  } else {
    estado = 'Parcial'
  }

  return {
    operacion: idOperacion,
    estado, // "Completado" | "Parcial" | "Pendiente"
    productosEsperados: productosEsperados.map(String),
    productosConMovimiento,
    productosSinMovimiento,
    totalMovimientos: data.total ?? data.items.length ?? 0,
    raw: data,
  }
}

export const actualizarServiciosOperacion = async (
  idOperacion,
  serviciosObj = {}
) => {
  const payload = { Servicios: serviciosObj }
  const res = await api.put(`/operacion/${idOperacion}/servicios`, payload)
  return res.data
}

export default api
