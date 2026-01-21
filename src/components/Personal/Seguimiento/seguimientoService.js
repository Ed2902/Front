// src/services/seguimientoService.js
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL
const API_URL_2 = import.meta.env.VITE_API_URL_2

const authHeaders = token => ({
  Authorization: `Bearer ${token}`,
})

/* =========================================================
   LISTADO DE PERSONAL (BASE + EXTENDIDO) PARA EL SELECT
   - BASE:  VITE_API_URL    → /personal
   - EXTRA: VITE_API_URL_2  → /app/personal
   Se fusionan por: documento === Id_personal
========================================================= */

// 🔹 /personal en API_URL (lo que ya tenías)
const getPersonalBase = async token => {
  const url = `${API_URL}/personal`

  const { data } = await axios.get(url, {
    headers: authHeaders(token),
  })

  return data // array con Id_personal, Nombre, Apellido, Cargo, Area, etc.
}

// 🔹 /app/personal en API_URL_2 (detalle extra: correo, tel, horarios, etc.)
const getPersonalExtendido = async token => {
  const url = `${API_URL_2}/app/personal`

  const { data } = await axios.get(url, {
    headers: authHeaders(token),
  })

  if (!Array.isArray(data)) {
    throw new Error('Respuesta inesperada en /app/personal')
  }

  return data // array con documento, nombres, apellidos, email, telefono, etc.
}

// 🔹 Fusión de ambos
export const listarPersonal = async token => {
  const base = await getPersonalBase(token)
  const extra = await getPersonalExtendido(token)

  // Mapeamos extra por documento para buscar rápido
  const extraMap = new Map(extra.map(p => [p.documento, p]))

  const fusionado = base.map(p => {
    const more = extraMap.get(p.Id_personal) || {}

    return {
      ...p, // datos de /personal (Id_personal, Nombre, Apellido, Cargo, Area, etc.)
      ...more, // datos de /app/personal (documento, nombres, apellidos, email, telefono, estado, horario_int, horario_off)

      // Normalizamos nombres completos (prioridad a los de /app/personal)
      nombres: more.nombres || p.Nombre,
      apellidos: more.apellidos || p.Apellido,
      email: more.email || null,
      telefono: more.telefono || null,
      estado: more.estado || null,
      horario_int: more.horario_int || null,
      horario_off: more.horario_off || null,
    }
  })

  return fusionado
}

export const listarPersonalComoOpciones = async token => {
  const personal = await listarPersonal(token)

  return personal.map(p => {
    const labelBase = `${p.Id_personal} - ${p.nombres} ${p.apellidos}`
    const cargo = p.Cargo ? ` - ${p.Cargo}` : ''
    const area = p.Area ? ` | ${p.Area}` : ''

    return {
      value: p.Id_personal,
      label: `${labelBase}${cargo}${area}`,
      raw: p, // objeto COMPLETO fusionado
    }
  })
}

/* =========================================================
   SUBIR DOCUMENTOS DEL PERSONAL
   Postman: POST /api/personal/1032485205/documentos
   Body: form-data → key = files (File)
========================================================= */

export const subirDocumentosPersonal = async (idPersonal, files, token) => {
  const url = `${API_URL}/personal/${idPersonal}/documentos`
  const form = new FormData()

  const lista = Array.isArray(files) ? files : [files]

  lista.forEach(file => {
    if (file) {
      // 👈 nombre EXACTO como en Postman
      form.append('files', file)
    }
  })

  const { data } = await axios.post(url, form, {
    headers: {
      ...authHeaders(token),
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}

/* =========================================================
   ACTUALIZAR FOTO DEL PERSONAL
   Postman: PUT /api/personal/1032485205/foto
   Body: form-data → key = foto (File)
========================================================= */

export const actualizarFotoPersonal = async (idPersonal, file, token) => {
  const url = `${API_URL}/personal/${idPersonal}/foto`
  const form = new FormData()

  if (file) {
    // 👈 nombre EXACTO como en Postman
    form.append('foto', file)
  }

  const { data } = await axios.put(url, form, {
    headers: {
      ...authHeaders(token),
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}

/* =========================================================
   ACTUALIZAR DATOS DEL PERSONAL
   Postman: PUT /api/personal/1032485205/
   Body: raw JSON (ej.)
   {
     "fecha_ingreso": "2025-02-28",
     "Area": "Innovasion"
   }
========================================================= */

export const actualizarDatosPersonal = async (idPersonal, payload, token) => {
  const url = `${API_URL}/personal/${idPersonal}/`

  // Solo mandamos los campos definidos (evitamos nulls raros)
  const body = {}
  ;[
    'Cargo',
    'Area',
    'fecha_ingreso',
    'fecha_retiro',
    'tiene_papeleria',
  ].forEach(key => {
    if (
      payload[key] !== undefined &&
      payload[key] !== null &&
      payload[key] !== ''
    ) {
      body[key] = payload[key]
    }
  })

  const { data } = await axios.put(url, body, {
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
  })

  return data
}

/* =========================================================
   CREAR NUEVO HISTORIAL DEL PERSONAL
   Postman: POST /api/personal-historial
   Body: form-data
   - id_personal (Text)
   - tipo_evento (Text)
   - tipo_documento (Text)
   - titulo (Text)
   - descripcion (Text)
   - fecha_documento (Text)
   - id_usuario_registra (Text)
   - archivo (File)
========================================================= */

export const crearHistorialPersonal = async (datos, archivo, token) => {
  const url = `${API_URL}/personal-historial`
  const form = new FormData()

  // Campos de texto EXACTOS como en Postman
  const camposTexto = [
    'id_personal',
    'tipo_evento',
    'tipo_documento',
    'titulo',
    'descripcion',
    'fecha_documento',
    'id_usuario_registra',
  ]

  camposTexto.forEach(campo => {
    if (datos[campo] !== undefined && datos[campo] !== null) {
      form.append(campo, datos[campo])
    }
  })

  // Archivo
  if (archivo) {
    // 👈 nombre EXACTO como en Postman
    form.append('archivo', archivo)
  }

  const { data } = await axios.post(url, form, {
    headers: {
      ...authHeaders(token),
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}
