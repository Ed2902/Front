import { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient } from 'socket.io-client'
import {
  FILES_ORIGIN,
  buildPersonaMap,
  fetchChats,
  fetchMessages,
  fetchPersonas,
  formatRelativeDate,
  getChatDisplay,
  markChatNotificationsAsRead,
  markRead,
  sendMessage,
  uploadChatFiles,
} from './chatApi'

import Avatar from './Avatar'
import AttachmentView from './AttachmentView'
import NewChat from './NewChat'
import { convertBlobToMp3File } from './audioToMp3'

export default function ChatPanel({
  token,
  myId,
  myPersonal,
  onClose,
  initialChatId = '',
  onInitialChatHandled,
  isMobile = false,
}) {
  const palette = {
    blue: '#79b9ff',
    blueSoft: '#eaf4ff',
    blueBorder: '#cfe6ff',
    orange: '#ffbe8a',
    orangeSoft: '#fff3e8',
    orangeBorder: '#ffd8b8',
    text: '#19324d',
    waMine: '#eaf4ff',
    waMineBorder: '#cfe6ff',
    waOther: '#fff3e8',
    waOtherBorder: '#ffd8b8',
  }

  const myName =
    `${myPersonal?.nombre || ''} ${myPersonal?.apellido || ''}`.trim()

  const [tab, setTab] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [personas, setPersonas] = useState([])
  const [chats, setChats] = useState([])
  const [allChats, setAllChats] = useState([])

  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [typingUsers, setTypingUsers] = useState(new Set())
  const [readMap, setReadMap] = useState({})
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [forwardChats, setForwardChats] = useState([])
  const [forwardTargets, setForwardTargets] = useState(new Set())
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwardSending, setForwardSending] = useState(false)
  const [openedMenuId, setOpenedMenuId] = useState(null)

  const personaMap = useMemo(() => buildPersonaMap(personas), [personas])

  const socketRef = useRef(null)
  const typingTimerRef = useRef(null)
  const activeChatRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const autoOpenedChatRef = useRef('')

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  const refreshInbox = async (showLoading = true) => {
    if (!token || !myId) return
    if (showLoading) {
      setLoading(true)
      setError('')
    }

    try {
      const [p, c] = await Promise.all([
        fetchPersonas({ token }),
        fetchChats({
          token,
          id_personal: myId,
          page: 1,
          limit: 100,
          contextType: 'free',
        }),
      ])

      setPersonas(p || [])
      const allChatsData = c?.items || []
      setAllChats(allChatsData)

      // Filtrar según tab por cantidad de participantes
      const filtered =
        tab === 'group'
          ? allChatsData.filter(chat => (chat?.participants || []).length >= 3)
          : tab === 'free'
            ? allChatsData.filter(
                chat => (chat?.participants || []).length === 2
              )
            : allChatsData

      setChats(filtered)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error cargando chats')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Calcular mensajes sin leer por tipo de chat
  const unreadCounts = useMemo(() => {
    const groupUnread = allChats
      .filter(chat => (chat?.participants || []).length >= 3)
      .reduce((sum, chat) => sum + Number(chat?.unreadCount || 0), 0)

    const freeUnread = allChats
      .filter(chat => (chat?.participants || []).length === 2)
      .reduce((sum, chat) => sum + Number(chat?.unreadCount || 0), 0)

    return { groupUnread, freeUnread }
  }, [allChats])

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current
    if (!token) {
      setMsgError('No hay autenticación para conectar.')
      return null
    }

    const s = ioClient(FILES_ORIGIN, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    s.on('notification:new', ({ title, body, chatId }) => {
      if (!window.Notification) {
        return
      }

      if (Notification.permission === 'granted') {
        try {
          new Notification(title || 'Chat Warehouse', {
            body: body || 'Nuevo mensaje',
            tag: `chat-${chatId}`,
            badge: '💬',
            requireInteraction: false,
          })
        } catch {}
      }
    })

    const onIncomingMessage = payload => {
      const chatId = String(payload?.chatId || '')
      const m = payload?.message
      if (!chatId || !m?._id) return

      const currentChat = activeChatRef.current
      if (currentChat && String(currentChat._id) === chatId) {
        setMessages(prev => {
          const exists = prev.some(x => String(x._id) === String(m._id))
          if (exists) return prev
          return [...prev, m]
        })

        s.emit('chat:read', { chatId })
        markChatNotificationsAsRead({
          token,
          id_personal: myId,
          chatId,
        }).catch(() => {})
        setReadMap(prev => ({
          ...prev,
          [String(myId)]: new Date().toISOString(),
        }))
      }

      // Actualizar el listado de chats para reflejar el nuevo mensaje
      console.log('📩 Mensaje recibido, actualizando listado...')
      refreshInbox(false)
    }

    s.on('chat:message:new', onIncomingMessage)
    s.on('message:new', onIncomingMessage)

    s.on('chat:typing:start', ({ chatId, id_personal }) => {
      const currentChat = activeChatRef.current
      if (!currentChat || String(currentChat._id) !== String(chatId)) return
      const pid = String(id_personal || '')
      if (!pid || pid === String(myId)) return
      setTypingUsers(prev => new Set([...prev, pid]))
    })

    s.on('chat:typing:stop', ({ chatId, id_personal }) => {
      const currentChat = activeChatRef.current
      if (!currentChat || String(currentChat._id) !== String(chatId)) return
      const pid = String(id_personal || '')
      if (!pid || pid === String(myId)) return
      setTypingUsers(prev => {
        const n = new Set(prev)
        n.delete(pid)
        return n
      })
    })

    s.on('chat:read:update', ({ chatId, id_personal, lastReadAt }) => {
      const currentChat = activeChatRef.current
      if (currentChat && String(currentChat._id) === String(chatId)) {
        const pid = String(id_personal || '')
        if (pid && lastReadAt) {
          setReadMap(prev => ({ ...prev, [pid]: lastReadAt }))
        }
      }
      // Actualizar la lista para reflejar cambios en contadores
      console.log('✓ Mensaje leído, actualizando listado...')
      refreshInbox(false)
    })

    // Listener adicional para nuevos chats creados
    s.on('chat:created', () => {
      console.log('➕ Nuevo chat creado, actualizando listado...')
      refreshInbox(false)
    })

    // Listener para cuando alguien marca como leído
    s.on('chat:marked:read', () => {
      console.log('✓ Chat marcado como leído, actualizando listado...')
      refreshInbox(false)
    })

    socketRef.current = s
    return s
  }

  useEffect(() => {
    ensureSocket()
    refreshInbox(true)

    // Solicitar permiso de notificaciones
    if (
      typeof window !== 'undefined' &&
      window.Notification &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {
        // Permiso denegado o error, continuar sin notificaciones
      })
    }

    // Polling cada 30 segundos como respaldo
    const pollingInterval = setInterval(() => {
      console.log('🔄 Actualización periódica del listado de chats...')
      refreshInbox(false)
    }, 15000)

    return () => {
      clearTimeout(typingTimerRef.current)
      clearInterval(pollingInterval)
      try {
        socketRef.current?.disconnect()
      } catch {}
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    refreshInbox(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Cerrar el menú de tres puntos al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      if (openedMenuId) {
        setOpenedMenuId(null)
      }
    }

    if (openedMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [openedMenuId])

  const openChat = async chat => {
    setActiveChat(chat)
    setMessages([])
    setTypingUsers(new Set())
    setReadMap({})
    setMsgError('')
    setDraft('')
    setMsgLoading(true)

    const s = ensureSocket()
    if (!s) {
      setMsgError('Error conectando al servidor.')
      setMsgLoading(false)
      return
    }

    try {
      s.emit('chat:join', { chatId: String(chat._id) })

      const r = await fetchMessages({
        token,
        chatId: chat._id,
        id_personal: myId,
        page: 1,
        limit: 80,
      })

      setMessages((r?.items || []).slice().reverse())

      await markRead({ token, chatId: chat._id, id_personal: myId })
      await markChatNotificationsAsRead({
        token,
        id_personal: myId,
        chatId: chat._id,
      })
      s.emit('chat:read', { chatId: String(chat._id) })

      refreshInbox(false)
    } catch (e) {
      setMsgError(
        e?.response?.data?.error || e?.message || 'Error cargando mensajes'
      )
    } finally {
      setMsgLoading(false)
    }
  }

  useEffect(() => {
    const chatId = String(initialChatId || '').trim()
    if (!chatId) return
    if (!token || !myId) return
    if (autoOpenedChatRef.current === chatId) return

    autoOpenedChatRef.current = chatId

    const openFromNotification = async () => {
      try {
        const list = await fetchChats({
          token,
          id_personal: myId,
          page: 1,
          limit: 100,
        })

        const chat = (list?.items || []).find(
          c => String(c?._id || '') === chatId
        )

        if (!chat) return

        // Detectar si es grupal por cantidad de participantes
        if ((chat.participants || []).length >= 3) setTab('group')
        else setTab('free')

        await openChat(chat)
      } finally {
        if (typeof onInitialChatHandled === 'function') onInitialChatHandled()
      }
    }

    openFromNotification()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId, token, myId])

  const emitTyping = on => {
    if (!activeChat) return
    const s = ensureSocket()
    if (!s) return
    s.emit(on ? 'chat:typing:start' : 'chat:typing:stop', {
      chatId: String(activeChat._id),
    })
  }

  const onDraftChange = v => {
    setDraft(v)
    emitTyping(true)
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => emitTyping(false), 900)
  }

  const isReadBySomeoneElse = msg => {
    if (!activeChat) return false
    if (String(msg?.sender_id_personal) !== String(myId)) return false
    const at = new Date(msg?.createdAt || msg?.created_at || 0).getTime()
    if (!at) return false

    const others = (activeChat.participants || []).filter(
      p => String(p) !== String(myId)
    )
    for (const oid of others) {
      const lr = readMap[String(oid)]
      if (!lr) continue
      const t = new Date(lr).getTime()
      if (t && t >= at) return true
    }
    return false
  }

  const upsertMessage = msg => {
    if (!msg?._id) return
    setMessages(prev => {
      const exists = prev.some(x => String(x._id) === String(msg._id))
      if (exists) return prev
      return [...prev, msg]
    })
  }

  const toggleForwardTarget = chatId => {
    const id = String(chatId || '')
    if (!id) return
    setForwardTargets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openForwardModal = async message => {
    if (!message?._id) return
    setForwardingMessage(message)
    setForwardTargets(new Set())
    setForwardOpen(true)
    setForwardLoading(true)

    try {
      const list = await fetchChats({
        token,
        id_personal: myId,
        page: 1,
        limit: 100,
      })
      setForwardChats(list?.items || [])
    } finally {
      setForwardLoading(false)
    }
  }

  const closeForwardModal = () => {
    setForwardOpen(false)
    setForwardingMessage(null)
    setForwardTargets(new Set())
    setForwardChats([])
  }

  const confirmForward = async () => {
    if (!forwardingMessage) return
    const selected = Array.from(forwardTargets)
    if (!selected.length) return

    setForwardSending(true)
    try {
      const text = String(forwardingMessage?.text || '').trim()
      const attachments = Array.isArray(forwardingMessage?.attachments)
        ? forwardingMessage.attachments.map(a => ({
            fileId: a?.fileId,
            name: a?.name,
            url: a?.url,
            mime: a?.mime,
            size: a?.size,
          }))
        : []

      for (const targetChatId of selected) {
        await sendMessage({
          token,
          chatId: targetChatId,
          id_personal: myId,
          text,
          attachments,
        })
      }

      refreshInbox(false)
      closeForwardModal()
    } catch (e) {
      setMsgError(
        e?.response?.data?.error || e?.message || 'No se pudo reenviar'
      )
    } finally {
      setForwardSending(false)
    }
  }

  // ✅ Auto-scroll mejorado
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // Si los mensajes están cargando, no hacer nada
    if (msgLoading) return

    // Si no hay chat activo, no hacer nada
    if (!activeChat) return

    // Si no hay mensajes, no hay nada que scrollear
    if (!messages || messages.length === 0) return

    // Scroll al final después de que React renderice
    const timer = setTimeout(() => {
      container.scrollTop = container.scrollHeight
    }, 10)

    return () => clearTimeout(timer)
  }, [messages, msgLoading, activeChat])

  const sendTextOnly = async () => {
    const text = String(draft || '').trim()
    if (!text || !activeChat) return

    setSending(true)
    setDraft('')
    setMsgError('')

    try {
      const m = await sendMessage({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        text,
        attachments: [],
      })

      const msg = m?.message || m?.item || m
      upsertMessage(msg)

      emitTyping(false)
      await markChatNotificationsAsRead({
        token,
        id_personal: myId,
        chatId: activeChat._id,
      })
      refreshInbox(false)
    } catch (e) {
      setMsgError(e?.response?.data?.error || e?.message || 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  const fileInputRef = useRef(null)
  const pickFiles = () => fileInputRef.current?.click()

  const onFilesSelected = async e => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !activeChat) return

    setSending(true)
    setMsgError('')
    try {
      const uploaded = await uploadChatFiles({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        files,
      })

      const m = await sendMessage({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        text: '',
        attachments: uploaded,
      })

      const msg = m?.message || m?.item || m
      upsertMessage(msg)

      await markChatNotificationsAsRead({
        token,
        id_personal: myId,
        chatId: activeChat._id,
      })
      refreshInbox(false)
    } catch (err) {
      setMsgError(
        err?.response?.data?.error || err?.message || 'No se pudo adjuntar'
      )
    } finally {
      setSending(false)
    }
  }

  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [processingAudio, setProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  const formatRecordingTime = totalSeconds => {
    const total = Math.max(0, Number(totalSeconds) || 0)
    const mm = String(Math.floor(total / 60)).padStart(2, '0')
    const ss = String(total % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const clearRecordingTimer = () => {
    if (!recordingTimerRef.current) return
    clearInterval(recordingTimerRef.current)
    recordingTimerRef.current = null
  }

  const getSupportedRecordingMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return undefined
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ]
    return candidates.find(type => MediaRecorder.isTypeSupported(type))
  }

  const startRecording = async () => {
    if (recording || !activeChat) return
    setMsgError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedRecordingMimeType()
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recordedChunksRef.current = []

      mr.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data)
      }

      mr.onstop = async () => {
        clearRecordingTimer()
        setRecording(false)
        setProcessingAudio(true)

        try {
          const originalBlob = new Blob(recordedChunksRef.current, {
            type: mr.mimeType || 'audio/webm',
          })
          const file = await convertBlobToMp3File(
            originalBlob,
            `audio-${Date.now()}.mp3`
          )

          setSending(true)
          const uploaded = await uploadChatFiles({
            token,
            chatId: activeChat._id,
            id_personal: myId,
            files: [file],
          })

          const m = await sendMessage({
            token,
            chatId: activeChat._id,
            id_personal: myId,
            text: '',
            attachments: uploaded,
          })

          const msg = m?.message || m?.item || m
          upsertMessage(msg)

          await markChatNotificationsAsRead({
            token,
            id_personal: myId,
            chatId: activeChat._id,
          })
          refreshInbox(false)
        } catch (err) {
          setMsgError(
            err?.response?.data?.error ||
              err?.message ||
              'No se pudo enviar audio'
          )
        } finally {
          setProcessingAudio(false)
          setSending(false)
        }

        try {
          stream.getTracks().forEach(t => t.stop())
        } catch {}
      }

      mediaRecorderRef.current = mr
      mr.start()
      setRecordingSeconds(0)
      clearRecordingTimer()
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
      setRecording(true)
    } catch {
      setMsgError('No se pudo acceder al micrófono.')
    }
  }

  const stopRecording = () => {
    if (!recording) return
    try {
      mediaRecorderRef.current?.stop()
    } catch {}
    clearRecordingTimer()
  }

  useEffect(() => {
    return () => {
      clearRecordingTimer()
    }
  }, [])

  useEffect(() => {
    if (!activeChat) {
      clearRecordingTimer()
      setRecording(false)
      setProcessingAudio(false)
      setRecordingSeconds(0)
    }
  }, [activeChat])

  return (
    <div
      className='card shadow-lg'
      style={{
        width: isMobile ? '100%' : 400,
        maxWidth: isMobile ? '100%' : 400,
        height: isMobile ? 'calc(100dvh - 16px)' : 580,
        maxHeight: isMobile ? 'calc(100dvh - 16px)' : 580,
        borderColor: palette.blueBorder,
      }}
    >
      <div
        className='card-header d-flex align-items-center gap-2'
        style={{ background: palette.blueSoft }}
      >
        <Avatar
          ruta_foto={myPersonal?.ruta_foto || null}
          name={myName}
          size={32}
          token={token}
        />
        <div className='flex-grow-1'>
          <div className='fw-bold' style={{ color: palette.text }}>
            Chat
          </div>
          <div className='text-muted small'>{myName}</div>
        </div>
        <button className='btn btn-sm btn-outline-secondary' onClick={onClose}>
          ✕
        </button>
      </div>

      <div
        className='card-body p-2 d-flex flex-column'
        style={{ minHeight: 0, position: 'relative' }}
      >
        {!activeChat && (
          <div className='btn-group w-100 mb-2'>
            <button
              className='btn btn-sm'
              style={{
                background: tab === 'group' ? palette.blue : 'white',
                borderColor: palette.blueBorder,
                color: tab === 'group' ? '#0f2a43' : palette.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onClick={() => setTab('group')}
            >
              Grupales
              {unreadCounts.groupUnread > 0 && (
                <span
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    minWidth: 18,
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCounts.groupUnread > 99
                    ? '99+'
                    : unreadCounts.groupUnread}
                </span>
              )}
            </button>
            <button
              className='btn btn-sm'
              style={{
                background: tab === 'free' ? palette.orange : 'white',
                borderColor: palette.orangeBorder,
                color: '#5a2f00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onClick={() => setTab('free')}
            >
              Libres
              {unreadCounts.freeUnread > 0 && (
                <span
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    minWidth: 18,
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCounts.freeUnread > 99
                    ? '99+'
                    : unreadCounts.freeUnread}
                </span>
              )}
            </button>
            <button
              className='btn btn-sm'
              style={{
                background: tab === 'new' ? palette.blue : 'white',
                borderColor: palette.blueBorder,
                color: tab === 'new' ? '#0f2a43' : palette.text,
              }}
              onClick={() => setTab('new')}
            >
              Nuevo
            </button>
          </div>
        )}

        {!activeChat && tab === 'new' && (
          <div className='flex-grow-1 overflow-auto'>
            <NewChat
              token={token}
              myId={myId}
              personas={personas}
              existingChats={allChats}
              onCreated={async createdChat => {
                // Detectar si es grupal por cantidad de participantes
                if ((createdChat?.participants || []).length >= 3) {
                  setTab('group')
                } else {
                  setTab('free')
                }
                await refreshInbox(true)
                if (createdChat && createdChat._id) openChat(createdChat)
              }}
            />
          </div>
        )}

        {!activeChat && tab !== 'new' && (
          <div className='flex-grow-1 overflow-auto'>
            <div className='d-flex align-items-center justify-content-between px-1 mb-2'>
              <div className='fw-bold small'>
                {tab === 'group' ? 'Mis chats grupales' : 'Tus chats libres'}
              </div>
              <button
                className='btn btn-sm btn-outline-secondary'
                onClick={() => refreshInbox(true)}
              >
                Actualizar
              </button>
            </div>

            {loading && <div className='text-muted small p-2'>Cargando…</div>}
            {!loading && error && (
              <div className='text-danger small p-2'>{error}</div>
            )}

            {!loading && !error && chats.length === 0 && (
              <div className='text-muted small p-2'>
                No tienes chats en esta sección.
              </div>
            )}

            {!loading &&
              !error &&
              chats.map(chat => {
                const d = getChatDisplay({ chat, myId, personaMap })
                const unread = Number(chat?.unreadCount || 0)
                const time = formatRelativeDate(chat?.lastMessage?.at)
                const preview =
                  String(chat?.lastMessage?.preview || '').trim() ||
                  'Sin mensajes'

                return (
                  <button
                    key={chat._id}
                    onClick={() => openChat(chat)}
                    className={`w-100 text-start btn ${
                      unread > 0
                        ? 'btn-outline-primary'
                        : 'btn-outline-secondary'
                    } mb-2`}
                    style={{
                      borderColor:
                        unread > 0 ? '#dc3545' : palette.orangeBorder,
                      background: unread > 0 ? '#fff5f5' : palette.orangeSoft,
                      borderWidth: 1,
                    }}
                  >
                    <div className='d-flex align-items-center gap-2'>
                      <Avatar
                        ruta_foto={d.ruta_foto}
                        name={d.name}
                        size={38}
                        token={token}
                      />
                      <div className='flex-grow-1' style={{ minWidth: 0 }}>
                        <div className='d-flex justify-content-between gap-2'>
                          <div
                            className='small text-truncate'
                            style={{
                              fontWeight: unread > 0 ? 700 : 600,
                              color: unread > 0 ? palette.text : undefined,
                            }}
                          >
                            {unread > 0 && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: '#dc3545',
                                  marginRight: 6,
                                }}
                              />
                            )}
                            {d.name}
                          </div>
                          <div className='text-muted small'>{time}</div>
                        </div>
                        <div className='d-flex justify-content-between gap-2 mt-1'>
                          <div
                            className='small text-truncate'
                            style={{
                              color: unread > 0 ? palette.text : undefined,
                              fontWeight: unread > 0 ? 600 : 400,
                            }}
                          >
                            {preview}
                          </div>
                          {unread > 0 && (
                            <span
                              className='badge'
                              style={{
                                background: '#dc3545',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: 11,
                                minWidth: 22,
                                height: 22,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 999,
                              }}
                            >
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {activeChat && (
          <>
            <div className='d-flex align-items-center gap-2 mb-2'>
              <button
                className='btn btn-sm btn-outline-secondary'
                onClick={() => {
                  setActiveChat(null)
                  setMessages([])
                  setTypingUsers(new Set())
                  setReadMap({})
                  setMsgError('')
                  setDraft('')
                }}
              >
                ←
              </button>
              <Avatar
                ruta_foto={
                  getChatDisplay({ chat: activeChat, myId, personaMap })
                    .ruta_foto
                }
                name={
                  getChatDisplay({ chat: activeChat, myId, personaMap }).name
                }
                size={32}
                token={token}
              />
              <div className='fw-bold small flex-grow-1 text-truncate'>
                {getChatDisplay({ chat: activeChat, myId, personaMap }).name}
              </div>
            </div>

            <div
              className='flex-grow-1 overflow-auto border rounded p-2'
              ref={messagesContainerRef}
              style={{ background: '#f6f6f6' }}
            >
              {msgLoading && <div className='text-muted small'>Cargando…</div>}
              {!msgLoading && msgError && (
                <div className='text-danger small'>{msgError}</div>
              )}

              {!msgLoading &&
                !msgError &&
                messages.map(m => {
                  const mine = String(m?.sender_id_personal) === String(myId)
                  const text = String(m?.text || '').trim()
                  const at = m?.createdAt || m?.created_at
                  const hasAttachments = !!m?.attachments?.length
                  const isMenuOpen = openedMenuId === m._id

                  return (
                    <div
                      key={m._id}
                      className={`d-flex mb-2 ${
                        mine ? 'justify-content-end' : 'justify-content-start'
                      }`}
                    >
                      <div
                        className='message-bubble'
                        style={{
                          position: 'relative',
                          maxWidth: '82%',
                        }}
                      >
                        <div
                          className='p-2'
                          style={{
                            position: 'relative',
                            background: mine ? palette.waMine : palette.waOther,
                            color: palette.text,
                            border: `1px solid ${
                              mine
                                ? palette.waMineBorder
                                : palette.waOtherBorder
                            }`,
                            minWidth: hasAttachments ? 240 : undefined,
                            borderRadius: mine
                              ? '16px 16px 4px 16px'
                              : '16px 16px 16px 4px',
                            boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                            lineHeight: 1.35,
                            paddingLeft: mine ? 10 : 12,
                            paddingRight: mine ? 12 : 10,
                          }}
                        >
                          <button
                            type='button'
                            onClick={e => {
                              e.stopPropagation()
                              setOpenedMenuId(
                                openedMenuId === m._id ? null : m._id
                              )
                            }}
                            className='message-menu-btn'
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: mine ? 4 : 'auto',
                              left: mine ? 'auto' : 4,
                              border: 'none',
                              borderRadius: 4,
                              background: 'rgba(0,0,0,0.05)',
                              color: '#506070',
                              width: 20,
                              height: 20,
                              fontSize: 14,
                              lineHeight: '20px',
                              padding: 0,
                              cursor: 'pointer',
                              opacity: 0.7,
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.opacity = 1
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.opacity = 0.7
                            }}
                          >
                            ⋮
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: 26,
                                right: mine ? 4 : 'auto',
                                left: mine ? 'auto' : 4,
                                background: '#fff',
                                border: '1px solid #d0d0d0',
                                borderRadius: 6,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                zIndex: 100,
                                minWidth: 120,
                              }}
                            >
                              <button
                                type='button'
                                onClick={() => {
                                  setOpenedMenuId(null)
                                  openForwardModal(m)
                                }}
                                className='w-100 text-start btn btn-sm'
                                style={{
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 12px',
                                  fontSize: 13,
                                }}
                              >
                                ↪ Reenviar
                              </button>
                            </div>
                          )}

                          <span
                            aria-hidden='true'
                            style={{
                              position: 'absolute',
                              bottom: -1,
                              right: mine ? -6 : 'auto',
                              left: mine ? 'auto' : -6,
                              width: 12,
                              height: 12,
                              transform: 'rotate(45deg)',
                              background: mine
                                ? palette.waMine
                                : palette.waOther,
                              borderRight: mine
                                ? `1px solid ${palette.waMineBorder}`
                                : 'none',
                              borderBottom: `1px solid ${
                                mine
                                  ? palette.waMineBorder
                                  : palette.waOtherBorder
                              }`,
                              borderLeft: mine
                                ? 'none'
                                : `1px solid ${palette.waOtherBorder}`,
                              borderTop: 'none',
                              borderBottomLeftRadius: mine ? 0 : 3,
                              borderBottomRightRadius: mine ? 3 : 0,
                            }}
                          />

                          {!!text && <div className='small'>{text}</div>}

                          {!!m?.attachments?.length && (
                            <div className='mt-2 d-flex flex-column gap-2'>
                              {m.attachments.map(a => (
                                <AttachmentView
                                  key={a.fileId || a.url}
                                  att={a}
                                  token={token}
                                  mine={mine}
                                  myId={myId}
                                />
                              ))}
                            </div>
                          )}

                          <div className='d-flex justify-content-end gap-2 mt-2'>
                            <div
                              className='small opacity-75'
                              style={{ fontSize: 11 }}
                            >
                              {formatRelativeDate(at)}
                            </div>
                            {mine && (
                              <div
                                className='small fw-bold opacity-75'
                                style={{ fontSize: 11 }}
                              >
                                {isReadBySomeoneElse(m) ? '✓✓' : '✓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {forwardOpen && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.25)',
                  zIndex: 10,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <div
                  style={{
                    width: isMobile ? '92vw' : 340,
                    maxHeight: isMobile ? '70dvh' : 420,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #dce9f8',
                    boxShadow: '0 8px 26px rgba(0,0,0,0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    className='d-flex align-items-center justify-content-between'
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #edf2f7',
                    }}
                  >
                    <div className='fw-bold small'>Reenviar mensaje</div>
                    <button
                      className='btn btn-sm btn-outline-secondary'
                      onClick={closeForwardModal}
                      disabled={forwardSending}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: 10, overflow: 'auto', flex: 1 }}>
                    {forwardLoading && (
                      <div className='small text-muted'>Cargando chats…</div>
                    )}

                    {!forwardLoading && forwardChats.length === 0 && (
                      <div className='small text-muted'>
                        No hay chats disponibles.
                      </div>
                    )}

                    {!forwardLoading &&
                      forwardChats.map(chat => {
                        const d = getChatDisplay({ chat, myId, personaMap })
                        const selected = forwardTargets.has(String(chat._id))
                        return (
                          <button
                            key={chat._id}
                            onClick={() => toggleForwardTarget(chat._id)}
                            className='w-100 text-start btn mb-2'
                            style={{
                              border: '1px solid #d8e8fb',
                              background: selected ? '#eaf4ff' : '#fff',
                            }}
                          >
                            <div className='d-flex align-items-center gap-2'>
                              <Avatar
                                ruta_foto={d.ruta_foto}
                                name={d.name}
                                size={32}
                                token={token}
                              />
                              <div className='small fw-semibold text-truncate'>
                                {d.name}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  <div
                    className='d-flex justify-content-end gap-2'
                    style={{ padding: 10, borderTop: '1px solid #edf2f7' }}
                  >
                    <button
                      className='btn btn-sm btn-outline-secondary'
                      onClick={closeForwardModal}
                      disabled={forwardSending}
                    >
                      Cancelar
                    </button>
                    <button
                      className='btn btn-sm'
                      style={{
                        background: palette.blue,
                        borderColor: palette.blueBorder,
                        color: '#0f2a43',
                      }}
                      onClick={confirmForward}
                      disabled={forwardSending || forwardTargets.size === 0}
                    >
                      {forwardSending ? 'Reenviando…' : 'Reenviar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className='mt-2'>
              {typingUsers.size > 0 && (
                <div className='d-flex mb-2'>
                  <div
                    className='small fw-semibold'
                    style={{
                      background: '#fff3e8',
                      color: '#5a2f00',
                      border: '1px solid #ffd8b8',
                      borderRadius: 999,
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>●</span>
                    <span>Escribiendo…</span>
                  </div>
                </div>
              )}

              {msgError && (
                <div className='text-danger small mb-1'>{msgError}</div>
              )}

              <div className='d-flex gap-2 align-items-center'>
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  className='d-none'
                  onChange={onFilesSelected}
                />

                <button
                  className='btn btn-outline-secondary btn-sm'
                  onClick={pickFiles}
                  disabled={sending || recording || processingAudio}
                  title='Adjuntar'
                >
                  📎
                </button>

                <button
                  className='btn btn-outline-secondary btn-sm'
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending || processingAudio}
                  title={recording ? 'Detener' : 'Grabar'}
                >
                  {recording ? '⏹️' : '🎙️'}
                </button>

                {recording && (
                  <span
                    className='badge'
                    style={{ background: palette.orange, color: '#5a2f00' }}
                  >
                    ● Grabando {formatRecordingTime(recordingSeconds)}
                  </span>
                )}

                {processingAudio && !recording && (
                  <span className='badge bg-secondary'>Procesando audio…</span>
                )}

                <input
                  className='form-control form-control-sm'
                  value={draft}
                  onChange={e => onDraftChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendTextOnly()}
                  placeholder='Escribe un mensaje…'
                />

                <button
                  className='btn btn-sm'
                  style={{
                    background: palette.blue,
                    borderColor: palette.blueBorder,
                    color: '#0f2a43',
                  }}
                  onClick={sendTextOnly}
                  disabled={sending || recording || processingAudio}
                >
                  {sending ? '…' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
