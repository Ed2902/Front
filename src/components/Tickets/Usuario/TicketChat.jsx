// src/components/Tickets/Usuario/TicketChat.jsx
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react'
import axios from 'axios'
import AuthContext from '../../../context/AuthContext'
import { getMessages, sendMessage, markMessagesSeen } from './tickets_service'
import './TicketChat.css'

const POLL_MS = 500
const MAX_FILES = 1
const MAX_MB = 20
const MESSAGE_REQUIRED = true

// ➜ true = invierte lados (otros a la derecha)
const INVERT_SIDES = false

// Base del host quitando SOLO /api o /api/
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
// Prefijo de archivos en prod (ej: /backendfastway); en local vacío
const FILES_PREFIX = import.meta.env.VITE_FILES_PREFIX ?? '/backendfastway'
const DEBUG = import.meta.env.VITE_DEBUG_FILES === '1'

// Endpoint de personal
const API_URL = import.meta.env.VITE_API_URL
const PERSONAL_ENDPOINT = `${API_URL}/personal`

/* ---------------- Helpers ---------------- */
const prettyDate = v => {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString()
}
const coerceDate = m =>
  m?.Fecha_Hora || m?.fecha_hora || m?.Fecha || m?.created_at || null
const isMine = (m, myId) =>
  String(m?.Id_personal || m?.id_personal || '') === String(myId || '')
const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('') || 'U'

// adjunto: string plano o "\"uploads/...\"" o objeto con path...
const normalizeAttachmentToPath = att => {
  if (!att) return ''
  if (typeof att === 'string') {
    try {
      const parsed = JSON.parse(att)
      if (typeof parsed === 'string') return parsed
      // eslint-disable-next-line no-unused-vars
    } catch (_) {
      return att
    }
  }
  return att.path || att.url || att.link || att.src || att.ruta || ''
}

/* ---------------- Archivos (url + tipo) ---------------- */
function buildUrl(base, prefix, rel) {
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  const pfx = prefix && prefix !== '/' ? prefix : ''
  return `${base}${pfx}${rel.startsWith('/') ? '' : '/'}${rel}`
}
function buildCandidates(base, prefix, rel) {
  if (/^https?:\/\//i.test(rel)) return [rel]
  const out = []
  if (prefix && prefix !== '/') out.push(buildUrl(base, prefix, rel)) // prod
  out.push(buildUrl(base, '', rel)) // local fallback
  return [...new Set(out)]
}
function getExt(nameOrPath = '') {
  const n = String(nameOrPath).toLowerCase()
  const m = /\.([a-z0-9]+)(?:\?.*)?$/.exec(n)
  return m ? m[1] : ''
}
function inferKindFromExt(ext) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
    return 'image'
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xls'
  if (['ppt', 'pptx'].includes(ext)) return 'ppt'
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip'
  if (ext === 'txt') return 'txt'
  return 'file'
}
function kindLabel(kind) {
  return (
    {
      image: 'IMG',
      video: 'VID',
      audio: 'AUD',
      pdf: 'PDF',
      doc: 'DOC',
      xls: 'XLS',
      ppt: 'PPT',
      zip: 'ZIP',
      txt: 'TXT',
      file: 'FILE',
    }[kind] || 'FILE'
  )
}

/* ---------- CHIP de adjunto (fuera de la burbuja) ---------- */
function AttachmentChip({ src, fileName }) {
  const cleanSrc = useMemo(() => {
    if (!src) return ''
    try {
      const parsed = JSON.parse(src)
      if (typeof parsed === 'string') return parsed
      // eslint-disable-next-line no-empty, no-unused-vars
    } catch (_) {}
    return String(src)
  }, [src])

  const [thumbUrl, setThumbUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const baseName = cleanSrc ? cleanSrc.split('/').pop() : 'archivo'
  const ext = getExt(baseName)
  const kind = inferKindFromExt(ext)
  const label = kindLabel(kind)

  // miniatura (solo imágenes) 48x48
  useEffect(() => {
    let revoke = ''
    let cancelled = false
    async function loadThumb() {
      setThumbUrl('')
      setError('')
      if (!cleanSrc || kind !== 'image') return
      const token = localStorage.getItem('token') || ''
      const candidates = buildCandidates(API_BASE, FILES_PREFIX, cleanSrc)
      for (const url of candidates) {
        try {
          const res = await axios.get(url, {
            responseType: 'blob',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (cancelled) return
          const obj = URL.createObjectURL(res.data)
          revoke = obj
          setThumbUrl(obj)
          if (DEBUG) console.log('[Chip] thumb OK:', url)
          return
        } catch (e) {
          if (DEBUG)
            console.warn(
              '[Chip] thumb FAIL:',
              url,
              e?.response?.status || e?.message
            )
          continue
        }
      }
    }
    loadThumb()
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [cleanSrc, kind])

  const handleDownload = async () => {
    if (!cleanSrc || downloading) return
    setDownloading(true)
    setError('')
    const token = localStorage.getItem('token') || ''
    const candidates = buildCandidates(API_BASE, FILES_PREFIX, cleanSrc)

    let lastStatus = 0
    for (const url of candidates) {
      try {
        const res = await axios.get(url, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` },
        })
        const blob = res.data
        const a = document.createElement('a')
        const href = URL.createObjectURL(blob)
        a.href = href
        a.download = fileName || baseName || 'archivo'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(href)
        setDownloading(false)
        return
      } catch (e) {
        lastStatus = e?.response?.status || 0
        continue
      }
    }
    if (lastStatus === 404) setError('No encontrado')
    else if (lastStatus === 401 || lastStatus === 403) setError('No autorizado')
    else if (lastStatus >= 500) setError(`Error ${lastStatus}`)
    else setError('Error de red')
    setDownloading(false)
  }

  return (
    <button
      type='button'
      className='chip'
      onClick={handleDownload}
      title={fileName || baseName}
      disabled={downloading}
    >
      {kind === 'image' && thumbUrl ? (
        <img className='chip-thumb' src={thumbUrl} alt={fileName || baseName} />
      ) : (
        <span className={`chip-icon chip-${kind}`}>{label}</span>
      )}
      <span className='chip-name'>{fileName || baseName}</span>
      {error && <span className='chip-err'>{error}</span>}
    </button>
  )
}

/* ========================= COMPONENTE PRINCIPAL ========================= */
export default function TicketChat({ ticket, onClose }) {
  const { user } = useContext(AuthContext)
  // >>> Id desde AuthContext (como pediste)
  const idPersonal = user?.personal?.id_personal || user?.id_personal || ''

  const idTicket = ticket?.id_tiket
  const isClosed = ticket?.Estado === 'Cerrado'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])

  // Mapa: Id_personal -> "Nombre Apellido"
  const [nameById, setNameById] = useState(new Map())

  // composer
  const [texto, setTexto] = useState('')
  const [files, setFiles] = useState([]) // máx 1
  const [fileErrors, setFileErrors] = useState('')

  // envío
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const bottomRef = useRef(null)
  const pollRef = useRef(null)
  const inputRef = useRef(null)

  // Cargar catálogo de personal
  useEffect(() => {
    let cancelled = false
    async function loadPersonal() {
      try {
        const token = localStorage.getItem('token') || ''
        const { data } = await axios.get(PERSONAL_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        const map = new Map()
        ;(Array.isArray(data) ? data : []).forEach(p => {
          const id = String(p?.Id_personal || '')
          const nombre = [p?.Nombre, p?.Apellido].filter(Boolean).join(' ')
          if (id) map.set(id, nombre || id)
        })
        setNameById(map)
      } catch (e) {
        if (DEBUG) console.warn('No se pudo cargar /api/personal', e?.message)
      }
    }
    loadPersonal()
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = pid => {
    if (!pid) return 'Desconocido'
    const id = String(pid)
    if (id === String(idPersonal)) return 'Tú'
    return nameById.get(id) || id
  }

  // -------- tiempo de solución ---------
  const tiempoSolucion = useMemo(() => {
    if (!ticket) return null
    const inicio = ticket?.Fecha_Creacion
      ? new Date(ticket.Fecha_Creacion)
      : null
    const fin = ticket?.Fecha_Fin ? new Date(ticket.Fecha_Fin) : null
    if (!inicio || isNaN(inicio)) return null
    const end = fin || new Date()
    const ms = Math.max(0, end - inicio)
    const totalMins = Math.floor(ms / 60000)
    const dias = Math.floor(totalMins / (60 * 24))
    const horas = Math.floor((totalMins % (60 * 24)) / 60)
    const mins = totalMins % 60
    const partes = []
    if (dias) partes.push(`${dias}d`)
    if (horas) partes.push(`${horas}h`)
    partes.push(`${mins}m`)
    return fin
      ? `Tiempo de solución: ${partes.join(' ')}`
      : `En curso: ${partes.join(' ')}`
  }, [ticket])

  // ------- helpers de visto -------
  const computeSeenByOther = useCallback(
    m => {
      // Solo interesa para mis mensajes
      const autorId = String(m?.Id_personal || m?.id_personal || '')
      const yo = String(idPersonal || '')
      if (autorId !== yo) return false

      // Campos posibles que puede retornar la API
      const vistoPorUno =
        m?.Visto_por ?? m?.visto_por ?? m?.Id_visto_por ?? null

      const vistoPorLista = Array.isArray(m?.visto_por_lista)
        ? m.visto_por_lista
        : Array.isArray(m?.VistoPor)
        ? m.VistoPor
        : []

      // Caso 1: id único
      if (vistoPorUno && String(vistoPorUno) !== yo) return true

      // Caso 2: lista de ids
      if (vistoPorLista.length > 0) {
        return vistoPorLista.some(v => String(v) !== yo)
      }

      // Si solo hay Estado generico, NO lo usamos para evitar falso positivo
      // (porque no sabemos quién lo vio)
      return false
    },
    [idPersonal]
  )

  // ------- carga y visto -------
  const afterMessagesLoad = useCallback(
    async (list, { markSeen } = {}) => {
      const ordered = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const ta = new Date(coerceDate(a) || 0).getTime()
        const tb = new Date(coerceDate(b) || 0).getTime()
        return ta - tb
      })
      setMessages(ordered)

      if (ordered.length) {
        const last = ordered[ordered.length - 1]
        const lastTs = new Date(coerceDate(last) || Date.now()).getTime()
        localStorage.setItem(`ticket_lastMsgAt_${idTicket}`, String(lastTs))
      }

      if (markSeen && ordered.length) {
        const idsOtrosNoVistos = ordered
          .filter(
            m =>
              !isMine(m, idPersonal) &&
              (m?.Estado === 'No_Visto' ||
                m?.Estado === 'NoVisto' ||
                m?.Estado === 'NoVISTO' ||
                m?.estado === 'No_Visto' ||
                m?.estado === 'NoVisto' ||
                m?.estado === 'NoVISTO')
          )
          .map(m => m.id_mensaje || m.id)
          .filter(Boolean)
        try {
          if (idsOtrosNoVistos.length) {
            // >>> Enviamos quién está viendo, para que el backend ignore self-views del autor
            await markMessagesSeen({
              messageIds: idsOtrosNoVistos,
              viewerId: String(idPersonal),
            })
          }
          localStorage.setItem(
            `ticket_lastSeenAt_${idTicket}`,
            String(Date.now())
          )
        } catch (e) {
          console.warn('markMessagesSeen falló:', e)
        }
      }
    },
    [idTicket, idPersonal]
  )

  const fetchMessages = useCallback(
    async ({ scroll, markSeen } = { scroll: false, markSeen: false }) => {
      if (!idTicket) return
      try {
        setError('')
        if (!messages.length) setLoading(true)
        const data = await getMessages(idTicket)
        const items = Array.isArray(data?.rows)
          ? data.rows
          : data?.items || data || []
        await afterMessagesLoad(items, { markSeen })
        if (scroll)
          setTimeout(
            () =>
              bottomRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
              }),
            0
          )
      } catch (e) {
        console.error(e)
        setError('No se pudieron cargar los mensajes.')
      } finally {
        setLoading(false)
      }
    },
    [idTicket, messages.length, afterMessagesLoad]
  )

  useEffect(() => {
    if (!idTicket) return
    fetchMessages({ scroll: true, markSeen: true })
    if (isClosed) return
    pollRef.current = setInterval(
      () => fetchMessages({ markSeen: true }),
      POLL_MS
    )
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [idTicket, isClosed, fetchMessages])

  // ------- archivos (clip en el compositor) -------
  const pickFile = () => inputRef.current?.click()

  const handleFiles = ev => {
    const list = Array.from(ev.target.files || [])
    const errors = []
    const accepted = []

    list.forEach(f => {
      if (f.size > MAX_MB * 1024 * 1024) {
        errors.push(`"${f.name}" supera ${MAX_MB}MB`)
        return
      }
      accepted.push(f)
    })

    const all = [...accepted] // solo último lote (máx 1)
    if (all.length > MAX_FILES)
      errors.push(`Máximo ${MAX_FILES} archivo por mensaje`)

    setFiles(all.slice(0, MAX_FILES))
    setFileErrors(errors.join(' • '))
  }

  const removeFile = () => {
    setFiles([])
    setFileErrors('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // ------- envío -------
  const doSend = async e => {
    e?.preventDefault?.()
    if (!idTicket || sending || isClosed) return

    if (MESSAGE_REQUIRED && !texto.trim()) {
      setError('Debes escribir un mensaje.')
      return
    }

    setSending(true)
    setUploadProgress(0)
    setError('')

    const finalTexto = texto.trim()

    try {
      await sendMessage(
        idTicket,
        { Mensaje: finalTexto, Id_personal: String(idPersonal), files },
        { onProgress: p => setUploadProgress(p) }
      )
      setTexto('')
      setFiles([])
      setUploadProgress(0)
      if (inputRef.current) inputRef.current.value = ''
      await fetchMessages({ scroll: true, markSeen: true })
    } catch (e2) {
      console.error(e2)
      setError('No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doSend()
  }

  // ------- render adjuntos (FILA debajo de la burbuja) -------
  const renderAttachment = (att, i) => {
    const relPath = normalizeAttachmentToPath(att)
    if (!relPath) return null
    return <AttachmentChip key={i} src={relPath} />
  }

  const renderMessage = m => {
    const mineRaw = isMine(m, idPersonal)
    const mine = INVERT_SIDES ? !mineRaw : mineRaw

    const body = m?.Mensaje ?? m?.texto ?? m?.message ?? m?.body ?? ''
    const when = coerceDate(m)
    const adj = m?.adjunto ? [m.adjunto] : []
    const senderId = String(m?.Id_personal || m?.id_personal || '')
    const author = displayName(senderId)

    // ➜ calcular si OTRO lo vio (solo aplica a mis mensajes)
    const seenByOther = mine ? computeSeenByOther(m) : false

    return (
      <div
        key={m.id_mensaje || m.id || when}
        className={`msg-row ${mine ? 'mine' : 'theirs'}`}
      >
        <div className={`msg-avatar ${mine ? 'me' : 'other'}`} title={author}>
          {initials(author)}
        </div>

        <div className='msg-col'>
          <div className={`msg-bubble ${mine ? 'me' : 'other'}`}>
            <div className='msg-meta-top'>
              {!mine && <span className='msg-author'>{author}</span>}
              <span className='msg-date'>{prettyDate(when)}</span>
            </div>

            {body && <div className='msg-text'>{body}</div>}

            {/* meta bottom: visto solo para mis mensajes */}
            {mine && (
              <div className='msg-meta-bottom'>
                <span className={`seen ${seenByOther ? 'ok' : 'no'}`}>
                  {seenByOther ? 'Visto' : 'No visto'}
                </span>
              </div>
            )}
          </div>

          {/* fila de adjuntos DEBAJO de la burbuja */}
          {adj.length > 0 && (
            <div className={`msg-attachments-row ${mine ? 'right' : 'left'}`}>
              {adj.map((a, i) => renderAttachment(a, i))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className='ticket-chat card border-0 shadow-sm'>
      <div className='card-header bg-white border-0 pb-0'>
        <div className='chat-header'>
          <div>
            <h6 className='m-0'>{ticket?.Asunto || `Ticket #${idTicket}`}</h6>
            <div className='chat-sub small text-muted'>
              <span
                className={`badge ${
                  ticket?.Estado === 'Cerrado'
                    ? 'bg-success'
                    : ticket?.Estado === 'En_proceso'
                    ? 'bg-warning text-dark'
                    : 'bg-secondary'
                }`}
              >
                {ticket?.Estado}
              </span>
              {ticket?.Categoria && <span>• {ticket.Categoria}</span>}
              {ticket?.Nivel && <span>• {ticket.Nivel}</span>}
            </div>
          </div>
          {onClose && (
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={onClose}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div className='card-body pt-2'>
        {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

        <div className='chat-list'>
          {loading && messages.length === 0 ? (
            <div className='text-center text-muted py-4'>
              Cargando mensajes…
            </div>
          ) : messages.length === 0 ? (
            <div className='text-center text-muted py-5'>
              Sin mensajes. ¡Escribe el primero!
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className='card-footer bg-white'>
        <form onSubmit={doSend} className='composer'>
          {/* Input primero (a la izquierda del bloque), pero todo el composer queda a la derecha por CSS */}
          <input
            className='form-control form-control-sm composer-input'
            placeholder='Escribe un mensaje…'
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || isClosed}
          />

          {/* Acciones a la derecha del input */}
          <div className='composer-actions'>
            {/* botón clip grande */}
            <button
              type='button'
              className='btn btn-icon btn-icon--lg'
              title='Adjuntar archivo'
              onClick={pickFile}
              disabled={sending || isClosed}
            >
              📎
            </button>

            <button
              className='btn btn-primary btn-sm'
              type='submit'
              disabled={
                sending || isClosed || (MESSAGE_REQUIRED && !texto.trim())
              }
              title={isClosed ? 'El ticket está cerrado' : 'Enviar'}
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>

          {/* input file oculto */}
          <input
            ref={inputRef}
            id='chat-file-input'
            name='files'
            type='file'
            hidden
            onChange={handleFiles}
            disabled={sending || isClosed}
          />
        </form>

        {(files.length > 0 || fileErrors || uploadProgress > 0) && (
          <div className='composer-files'>
            {files.map((f, i) => (
              <div key={i} className='attach-chip'>
                <span className='attach-name' title={f.name}>
                  {f.name}
                </span>
                <span className='attach-size'>
                  {(f.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type='button'
                  className='attach-remove'
                  onClick={() => removeFile(i)}
                  title='Quitar'
                >
                  ×
                </button>
              </div>
            ))}
            {fileErrors && (
              <div className='small text-danger'>{fileErrors}</div>
            )}
            {sending && (
              <div className='upload-progress'>
                <div
                  className='upload-bar'
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {tiempoSolucion && (
          <div className='small text-muted mt-2'>{tiempoSolucion}</div>
        )}
      </div>
    </div>
  )
}
