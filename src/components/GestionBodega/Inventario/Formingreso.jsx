import { useForm } from 'react-hook-form'
import {
  useEffect,
  useState,
  useContext,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  getLoteProducto,
  getBodegas,
  getUbicaciones,
  getProductos,
  crearEntradaCabecera,
  actualizarEntradaCabecera,
  agregarDetallesEntrada,
  subirFotoDetalleEntrada,
  confirmarEntrada,
} from './entrada_service'
import Modal from 'react-modal'
import Webcam from 'react-webcam'
import { saveAs } from 'file-saver'

Modal.setAppElement('#root')

// Si quieres permitir confirmar sin fotos, ponlo en false.
const REQUIRE_PHOTOS_TO_CONFIRM = true

// Normaliza url pública (para qr_path o rutas relativas en uploads)
const resolvePublicUrl = maybeUrlOrFile => {
  if (!maybeUrlOrFile) return null
  if (/^(data:|https?:\/\/)/i.test(maybeUrlOrFile)) return maybeUrlOrFile

  const PUBLIC_BASE = (
    import.meta.env.VITE_API_PUBLIC_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/$/, '')

  if (!PUBLIC_BASE) return maybeUrlOrFile

  const filename = String(maybeUrlOrFile).replace(/^\/?uploads\/?/, '')
  return `${PUBLIC_BASE}/uploads/${filename}`
}

// Detecta si hay datos mínimos para guardar borrador (evita borradores vacíos)
const hasMinimumDraftData = ({ idLoteGlobal, items, data, user }) => {
  const hasLote = !!idLoteGlobal
  const hasItems = (items || []).length > 0
  const hasDestino = !!data?.id_bodega_destino && !!data?.id_ubicacion_destino
  const hasUser = !!(user?.personal?.id_personal || user?.id)
  const hasObs = !!(data?.comentario && String(data.comentario).trim())
  return hasUser && hasLote && (hasItems || hasDestino || hasObs)
}

const FormIngreso = forwardRef(
  ({ onSuccess, onClose, initialEntrada }, ref) => {
    const { user } = useContext(AuthContext)

    // ===== Form global =====
    const {
      register,
      reset,
      watch,
      getValues,
      formState: { errors, isSubmitting },
    } = useForm()

    // ===== Catálogos =====
    const [lotesRaw, setLotesRaw] = useState([])
    const [bodegas, setBodegas] = useState([])
    const [ubicaciones, setUbicaciones] = useState([])
    const [prodById, setProdById] = useState({})

    // ===== Estado global =====
    const [idLoteGlobal, setIdLoteGlobal] = useState('')
    const [infoLote, setInfoLote] = useState(null)
    const [statusMessage, setStatusMessage] = useState(null)

    // control de borrador / confirmación
    const [entradaId, setEntradaId] = useState(null)
    const [entradaNumero, setEntradaNumero] = useState('')
    const [entradaEstado, setEntradaEstado] = useState('NUEVA') // NUEVA | BORRADOR | CONFIRMADA
    const [dirty, setDirty] = useState(false)
    const savingRef = useRef(false)

    // ✅ evita duplicar detalles si solo cambias cabecera
    const [itemsDirty, setItemsDirty] = useState(false)

    // Bodega/Ubi global (destino)
    const idBodegaDestino = watch('id_bodega_destino')
    const ubicacionesDeBodega = ubicaciones.filter(
      u => u.id_bodega === (idBodegaDestino || '')
    )

    // ===== Ítems =====
    // { id_producto, cantidad, verificado, evidenciaFile?, evidenciaName?, evidenciaUrl? }
    const [items, setItems] = useState([])

    // Sub-form de ítem
    const {
      register: registerItem,
      handleSubmit: handleSubmitItem,
      setValue: setValueItem,
      watch: watchItem,
      formState: { errors: errorsItem },
    } = useForm()

    const productoItem = watchItem('id_producto_item')

    // Cámara por ítem
    const [cameraIndex, setCameraIndex] = useState(null)
    const webcamRef = useRef(null)

    // ========= CARGA INICIAL =========
    useEffect(() => {
      const fetchData = async () => {
        try {
          const [lotesData, bodegasData, ubicacionesData, productosData] =
            await Promise.all([
              getLoteProducto(),
              getBodegas(),
              getUbicaciones(),
              getProductos(),
            ])

          setLotesRaw(lotesData || [])
          setBodegas(bodegasData || [])
          setUbicaciones(ubicacionesData || [])

          const map = {}
          ;(productosData || []).forEach(p => {
            map[p.Id_producto] = p
          })
          setProdById(map)
        } catch (err) {
          console.error('Error cargando datos:', err)
          setStatusMessage({ type: 'error', text: 'Error cargando catálogos' })
        }
      }
      fetchData()
    }, [])

    // ====== (NUEVO) Orden correcto de lotes: GEN_099 arriba, GEN_001 abajo ======
    const parseLote = useCallback(idLote => {
      const s = String(idLote || '').trim()

      // Formato esperado: PREFIJO_NUMERO (ej: GEN_004)
      // No se esperan caracteres al final.
      const m = s.match(/^([A-Za-z]+)_(\d+)$/)
      if (!m) return { raw: s, prefix: s.toUpperCase(), num: -1 }

      const prefix = m[1].toUpperCase()
      const num = Number(m[2]) // 010 -> 10, 011 -> 11, 099 -> 99
      return { raw: s, prefix, num: Number.isFinite(num) ? num : -1 }
    }, [])

    // ====== DEDUPE + SORT: lotes únicos para el select ======
    const lotesUnicos = useMemo(() => {
      const unique = Array.from(
        new Map((lotesRaw || []).map(l => [l.id_lote, l])).values()
      )

      unique.sort((a, b) => {
        const A = parseLote(a.id_lote)
        const B = parseLote(b.id_lote)

        // Si en algún momento existieran varios prefijos, los agrupa
        if (A.prefix !== B.prefix) return A.prefix.localeCompare(B.prefix)

        // Descendente por número: 99 arriba, 11 arriba de 10, etc.
        if (B.num !== A.num) return B.num - A.num

        // Desempate estable
        return String(B.raw).localeCompare(String(A.raw))
      })

      return unique
    }, [lotesRaw, parseLote])

    // Productos disponibles del lote global
    const productosUnicosDelLote = useMemo(() => {
      return Array.from(
        new Set(
          (lotesRaw || [])
            .filter(l => l.id_lote === idLoteGlobal)
            .map(l => l.id_producto)
        )
      )
    }, [lotesRaw, idLoteGlobal])

    const productoNombre = useCallback(
      idProd => {
        const p = prodById[idProd]
        if (p?.Nombre) return p.Nombre
        const found = (lotesRaw || []).find(
          l => l.id_lote === idLoteGlobal && l.id_producto === idProd
        )
        return (
          found?.Producto?.Nombre ||
          found?.producto_nombre ||
          found?.nombre_producto ||
          idProd
        )
      },
      [prodById, lotesRaw, idLoteGlobal]
    )

    // ✅ useCallback para evitar warning en useMemo deps
    const productoUnidad = useCallback(
      idProd => prodById[idProd]?.Unidad_de_medida || '',
      [prodById]
    )

    // ========= INFO LOTE (Cantidad / Origen) =========
    useEffect(() => {
      const computeInfo = () => {
        if (!idLoteGlobal || !productoItem) {
          setInfoLote(null)
          return
        }
        const filas = (lotesRaw || []).filter(
          x => x.id_lote === idLoteGlobal && x.id_producto === productoItem
        )
        if (!filas.length) {
          setInfoLote(null)
          return
        }
        const sorted = [...filas].sort(
          (a, b) => new Date(a.Fecha_registro) - new Date(b.Fecha_registro)
        )
        const last = sorted[sorted.length - 1]
        const cantidad = last?.Cantidad ?? null
        const origen =
          last?.Proveedor?.Nombre || last?.Cliente?.Nombre || 'Desconocido'
        setInfoLote({ cantidad, origen })
      }
      computeInfo()
    }, [idLoteGlobal, productoItem, lotesRaw])

    // ========= Cantidad sugerida por lote-producto =========
    const getUltimaCantidadLoteProducto = idProd => {
      if (!idLoteGlobal || !idProd) return 0
      const filas = (lotesRaw || []).filter(
        x => x.id_lote === idLoteGlobal && x.id_producto === idProd
      )
      if (!filas.length) return 0
      const sorted = [...filas].sort(
        (a, b) => new Date(a.Fecha_registro) - new Date(b.Fecha_registro)
      )
      const last = sorted[sorted.length - 1]
      return Number(last?.Cantidad ?? 0) || 0
    }

    // ========= Agregar todo el lote =========
    // Quedan SIN verificar para obligar revisión del usuario.
    const agregarTodoElLote = () => {
      if (!idLoteGlobal) {
        setStatusMessage({ type: 'error', text: 'Selecciona el lote global.' })
        setTimeout(() => setStatusMessage(null), 1800)
        return
      }
      if (!productosUnicosDelLote.length) {
        setStatusMessage({
          type: 'error',
          text: 'Ese lote no tiene productos.',
        })
        setTimeout(() => setStatusMessage(null), 2000)
        return
      }

      setItems(prev => {
        const prevMap = new Map(prev.map(it => [it.id_producto, it]))

        for (const idProd of productosUnicosDelLote) {
          const cantSugerida = getUltimaCantidadLoteProducto(idProd)

          if (prevMap.has(idProd)) {
            const old = prevMap.get(idProd)
            prevMap.set(idProd, {
              ...old,
              cantidad:
                (Number(old.cantidad) || 0) + (Number(cantSugerida) || 0),
              verificado: false,
            })
          } else {
            prevMap.set(idProd, {
              id_producto: idProd,
              cantidad: Number(cantSugerida) || 0,
              verificado: false,
              evidenciaFile: null,
              evidenciaName: '',
              evidenciaUrl: null,
            })
          }
        }

        return Array.from(prevMap.values()).filter(
          it => Number(it.cantidad) > 0
        )
      })

      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }

      setStatusMessage({
        type: 'success',
        text: 'Se agregaron los productos del lote. Revisa cantidades y verifica cada ítem.',
      })
      setTimeout(() => setStatusMessage(null), 2600)
    }

    // ========= Verificación =========
    const toggleVerificado = idx => {
      setItems(prev => {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], verificado: !copy[idx].verificado }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    const actualizarCantidadItem = (idx, value) => {
      const cant = Number(value)
      setItems(prev => {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          cantidad: Number.isFinite(cant) ? cant : 0,
          // al cambiar cantidad, obligamos re-verificación
          verificado: false,
        }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    // ========= Totales =========
    const totalesPorUnidad = useMemo(() => {
      const acc = {}
      for (const it of items) {
        const unidad = productoUnidad(it.id_producto) || 'UND'
        const cant = Number(it.cantidad) || 0
        acc[unidad] = (acc[unidad] || 0) + cant
      }
      return acc
    }, [items, productoUnidad])

    const allItemsVerified =
      items.length > 0 && items.every(it => it.verificado === true)

    // ========= AUTO-LLENADO PARA EDITAR =========
    useEffect(() => {
      if (!initialEntrada) return

      const id =
        initialEntrada?.Id_entrada ||
        initialEntrada?.id_entrada ||
        initialEntrada?.Id ||
        null

      const numero =
        initialEntrada?.Numero_documento ||
        initialEntrada?.Numero ||
        initialEntrada?.numero_documento ||
        ''

      const estado = String(initialEntrada?.Estado || 'BORRADOR').toUpperCase()

      const dets = Array.isArray(initialEntrada?.Detalles)
        ? initialEntrada.Detalles
        : []
      const firstLote = dets[0]?.Id_lote || dets[0]?.id_lote || ''

      setEntradaId(id)
      setEntradaNumero(numero)
      setEntradaEstado(estado || 'BORRADOR')

      setIdLoteGlobal(firstLote || '')

      reset({
        id_bodega_destino: initialEntrada?.Id_bodega_destino || '',
        id_ubicacion_destino: initialEntrada?.Id_ubicacion_destino || '',
        comentario: initialEntrada?.Observaciones || '',
      })

      const mapped = dets.map(d => {
        const idProd = d?.Id_producto || d?.id_producto
        const cant = Number(d?.Cantidad ?? d?.cantidad ?? 0) || 0
        const fotoUrl =
          d?.Ruta_foto_url ||
          d?.ruta_foto_url ||
          resolvePublicUrl(d?.Ruta_foto || d?.ruta_foto)

        return {
          id_producto: idProd,
          cantidad: cant,
          verificado: true,
          evidenciaFile: null,
          evidenciaName: '',
          evidenciaUrl: fotoUrl || null,
        }
      })

      setItems(mapped)

      setDirty(false)
      setItemsDirty(false)
      setInfoLote(null)
      setValueItem('id_producto_item', '')
      setValueItem('cantidad_item', '')
    }, [initialEntrada, reset, setValueItem])

    // ========= Mark dirty when user changes fields =========
    useEffect(() => {
      const sub = watch(() => {
        if (entradaEstado !== 'CONFIRMADA') setDirty(true)
      })
      return () => sub.unsubscribe()
    }, [watch, entradaEstado])

    // ========= Evidencia por ítem =========
    const onFileForItem = (idx, file) => {
      setItems(prev => {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          evidenciaFile: file || null,
          evidenciaName: file?.name || '',
          evidenciaUrl: null,
        }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    const openCameraForItem = idx => setCameraIndex(idx)
    const closeCamera = () => setCameraIndex(null)
    const captureForItem = () => {
      const imageSrc = webcamRef.current?.getScreenshot()
      if (!imageSrc) return
      fetch(imageSrc)
        .then(r => r.blob())
        .then(blob => {
          const file = new File(
            [blob],
            `foto-item-${cameraIndex}-${Date.now()}.jpg`,
            {
              type: 'image/jpeg',
            }
          )
          onFileForItem(cameraIndex, file)
          setCameraIndex(null)
        })
    }

    const descargarPNG = (src, nombre = 'qr.png') => {
      if (!src) return
      fetch(src)
        .then(res => res.blob())
        .then(blob => saveAs(blob, nombre))
        .catch(() => {})
    }

    const descargarZIPQRs = async lista => {
      try {
        const JSZip = (await import(/* @vite-ignore */ 'jszip')).default
        const zip = new JSZip()
        let added = 0

        for (let i = 0; i < (lista || []).length; i++) {
          const r = lista[i]
          const src = r?.qr_image
          if (!src) continue

          const lote = r?.lote || idLoteGlobal || 'LOTE'
          const prod = r?.producto || `PROD_${i + 1}`
          const safeProd = String(prod).replace(/[^a-z0-9_\-.]/gi, '_')
          const safeLote = String(lote).replace(/[^a-z0-9_\-.]/gi, '_')
          const name = `QR_${safeLote}_${safeProd}_${i + 1}.png`

          const blob = await fetch(src).then(res => res.blob())
          zip.file(name, blob)
          added++
        }

        if (!added) {
          setStatusMessage({ type: 'error', text: 'No hay QR para comprimir.' })
          setTimeout(() => setStatusMessage(null), 2000)
          return
        }

        const content = await zip.generateAsync({ type: 'blob' })
        saveAs(content, `QRs_${idLoteGlobal || 'lote'}.zip`)
      } catch (err) {
        console.error('ZIP QR error', err)
        setStatusMessage({
          type: 'error',
          text: 'Para ZIP instala: npm i jszip',
        })
        setTimeout(() => setStatusMessage(null), 3000)
      }
    }

    // ========= SUBFORM: Agregar ítem =========
    // Manual: el usuario digitó cantidad, lo marcamos verificado por defecto.
    const onAddItem = handleSubmitItem(
      ({ id_producto_item, cantidad_item }) => {
        const cant = Number(cantidad_item)

        if (!idLoteGlobal) {
          setStatusMessage({
            type: 'error',
            text: 'Selecciona el lote global.',
          })
          setTimeout(() => setStatusMessage(null), 1800)
          return
        }
        if (!id_producto_item || !cant || cant <= 0) return

        if (!productosUnicosDelLote.includes(id_producto_item)) {
          setStatusMessage({
            type: 'error',
            text: 'El producto no pertenece al lote seleccionado.',
          })
          setTimeout(() => setStatusMessage(null), 2200)
          return
        }

        const idx = items.findIndex(it => it.id_producto === id_producto_item)
        if (idx >= 0) {
          const copy = [...items]
          copy[idx] = {
            ...copy[idx],
            cantidad: (Number(copy[idx].cantidad) || 0) + cant,
            verificado: false,
          }
          setItems(copy)
        } else {
          setItems(prev => [
            ...prev,
            {
              id_producto: id_producto_item,
              cantidad: cant,
              verificado: true,
              evidenciaFile: null,
              evidenciaName: '',
              evidenciaUrl: null,
            },
          ])
        }

        setValueItem('id_producto_item', '')
        setValueItem('cantidad_item', '')
        if (entradaEstado !== 'CONFIRMADA') {
          setDirty(true)
          setItemsDirty(true)
        }
      }
    )

    const removeItem = i => {
      setItems(prev => prev.filter((_, idx) => idx !== i))
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    // ========= RESULTADOS =========
    const [procesando, setProcesando] = useState(false)

    // eslint-disable-next-line no-unused-vars
    const [progreso, setProgreso] = useState([])

    const [modalResultado, setModalResultado] = useState(false)
    const [respuestas, setRespuestas] = useState([])
    const [pdfUrl, setPdfUrl] = useState(null)

    const allItemsHaveEvidence =
      items.length > 0 &&
      items.every(it => !!it.evidenciaFile || !!it.evidenciaUrl)

    // ==========================================
    // guardar borrador (create o update)
    // ==========================================
    const guardarBorrador = async ({ silent = false } = {}) => {
      if (savingRef.current) return { ok: false, skipped: true }
      savingRef.current = true

      try {
        const data = getValues()

        if (
          !hasMinimumDraftData({
            idLoteGlobal,
            items,
            data,
            user,
          })
        ) {
          if (!silent) {
            setStatusMessage({
              type: 'error',
              text: 'No hay datos para guardar.',
            })
            setTimeout(() => setStatusMessage(null), 1600)
          }
          return { ok: false, skipped: true }
        }

        if (!idLoteGlobal) throw new Error('Selecciona el lote global.')
        if (!data.id_bodega_destino || !data.id_ubicacion_destino) {
          throw new Error('Selecciona bodega y ubicación destino.')
        }
        if (!items.length) throw new Error('Agrega al menos un ítem.')

        const cabeceraPayload = {
          Fecha_entrada: new Date().toISOString(),
          Id_personal: user?.personal?.id_personal || '',
          Observaciones: data.comentario || '',
          Id_bodega_destino: data.id_bodega_destino,
          Id_ubicacion_destino: data.id_ubicacion_destino,
        }

        let respCab
        if (!entradaId) {
          respCab = await crearEntradaCabecera(cabeceraPayload)
        } else {
          respCab = await actualizarEntradaCabecera(entradaId, cabeceraPayload)
        }

        const entrada = respCab?.data || respCab
        const idEntrada =
          entrada?.Id_entrada || entrada?.id_entrada || entrada?.Id || entradaId

        if (!idEntrada) throw new Error('No se obtuvo Id_entrada en borrador.')

        setEntradaId(idEntrada)
        setEntradaNumero(entrada?.Numero_documento || entradaNumero)
        setEntradaEstado(prev => (prev === 'CONFIRMADA' ? prev : 'BORRADOR'))

        // ✅ si estás editando y NO tocaste items/lote, NO re-crea detalles
        if (entradaId && !itemsDirty) {
          setDirty(false)
          if (!silent) {
            setStatusMessage({ type: 'success', text: 'Borrador guardado.' })
            setTimeout(() => setStatusMessage(null), 1600)
          }
          return { ok: true, idEntrada }
        }

        const detallesPayload = items.map(it => ({
          Id_producto: it.id_producto,
          Id_lote: idLoteGlobal,
          Cantidad: it.cantidad,
          Comentario: '',
        }))

        const respDetalles = await agregarDetallesEntrada(
          idEntrada,
          detallesPayload
        )
        const detallesCreados = respDetalles?.data || respDetalles || []

        const detallePorProducto = new Map()
        ;(detallesCreados || []).forEach(d => {
          detallePorProducto.set(d.Id_producto, d.Id_detalle)
        })

        // subir fotos SOLO si hay evidenciaFile nueva
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const idDetalle = detallePorProducto.get(it.id_producto)
          if (it.evidenciaFile && idDetalle) {
            try {
              await subirFotoDetalleEntrada(idDetalle, it.evidenciaFile)
            } catch (e) {
              if (!silent) console.warn('Error subiendo foto en borrador:', e)
            }
          }
        }

        setDirty(false)
        setItemsDirty(false)
        if (!silent) {
          setStatusMessage({ type: 'success', text: 'Borrador guardado.' })
          setTimeout(() => setStatusMessage(null), 1600)
        }
        return { ok: true, idEntrada }
      } catch (err) {
        if (!silent) {
          setStatusMessage({
            type: 'error',
            text:
              err?.response?.data?.message ||
              err?.message ||
              'Error guardando borrador',
          })
          setTimeout(() => setStatusMessage(null), 2600)
        } else {
          console.warn('Autosave borrador falló:', err)
        }
        return { ok: false, error: err }
      } finally {
        savingRef.current = false
      }
    }

    // ==========================================
    // confirmar
    // ==========================================
    const confirmar = async () => {
      if (entradaEstado === 'CONFIRMADA') {
        setStatusMessage({ type: 'success', text: 'Ya está confirmada.' })
        setTimeout(() => setStatusMessage(null), 1400)
        return
      }

      const data = getValues()

      if (!idLoteGlobal) {
        setStatusMessage({ type: 'error', text: 'Selecciona el lote global.' })
        setTimeout(() => setStatusMessage(null), 1800)
        return
      }
      if (!items.length) {
        setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
        setTimeout(() => setStatusMessage(null), 1800)
        return
      }
      if (!data.id_bodega_destino || !data.id_ubicacion_destino) {
        setStatusMessage({
          type: 'error',
          text: 'Selecciona bodega y ubicación destino.',
        })
        setTimeout(() => setStatusMessage(null), 2000)
        return
      }
      if (!data.comentario) {
        setStatusMessage({
          type: 'error',
          text: 'El comentario (observaciones) es obligatorio.',
        })
        setTimeout(() => setStatusMessage(null), 2000)
        return
      }

      // ✅ OBLIGATORIO: el usuario debe revisar y verificar
      if (!allItemsVerified) {
        setStatusMessage({
          type: 'error',
          text: 'Debes revisar las cantidades y marcar como verificados todos los ítems.',
        })
        setTimeout(() => setStatusMessage(null), 2600)
        return
      }

      if (REQUIRE_PHOTOS_TO_CONFIRM && !allItemsHaveEvidence) {
        setStatusMessage({
          type: 'error',
          text: 'Todos los ítems deben tener evidencia (foto).',
        })
        setTimeout(() => setStatusMessage(null), 2200)
        return
      }

      setProcesando(true)
      setPdfUrl(null)
      setProgreso(
        items.map((_, idx) => ({ idx, estado: 'pendiente', mensaje: '' }))
      )

      try {
        const saved = await guardarBorrador({ silent: true })
        const idToConfirm = saved?.idEntrada || entradaId
        if (!idToConfirm) throw new Error('No hay Id_entrada para confirmar.')

        const respConf = await confirmarEntrada(idToConfirm)
        const confData = respConf?.data || respConf

        const movimientos = confData?.movimientos || []
        const rutaPdf = confData?.Ruta_pdf || confData?.ruta_pdf
        if (rutaPdf) setPdfUrl(resolvePublicUrl(rutaPdf))

        const resps = movimientos.map((m, idx) => {
          const it = items[idx] || {}
          return {
            qr_image: resolvePublicUrl(m?.qr_path),
            lote: idLoteGlobal,
            producto: it.id_producto || m?.id_producto,
            cantidad_ingresada: it.cantidad,
            fecha: new Date().toISOString(),
            mensaje: m?.skipped ? 'Ya existía movimiento' : 'OK',
            id_historial: m?.id_historial,
          }
        })

        setRespuestas(resps)
        setModalResultado(true)
        setEntradaEstado('CONFIRMADA')
        setDirty(false)
        setItemsDirty(false)

        setStatusMessage({ type: 'success', text: 'Entrada confirmada.' })
        setTimeout(() => setStatusMessage(null), 2200)
      } catch (err) {
        console.error(err)
        setStatusMessage({
          type: 'error',
          text:
            err?.response?.data?.message || err?.message || 'Error confirmando',
        })
        setTimeout(() => setStatusMessage(null), 3000)
      } finally {
        setProcesando(false)
      }
    }

    // ==========================================
    // CIERRE SEGURO (guardar borrador si dirty)
    // ==========================================
    const handleCloseRequest = async () => {
      if (entradaEstado === 'CONFIRMADA') {
        onClose && onClose()
        return
      }
      if (dirty) await guardarBorrador({ silent: true })
      onClose && onClose()
    }

    useImperativeHandle(ref, () => ({
      requestClose: () => handleCloseRequest(),
    }))

    useEffect(() => {
      return () => {
        try {
          if (entradaEstado !== 'CONFIRMADA' && dirty && !savingRef.current) {
            guardarBorrador({ silent: true })
          }
        } catch {
          /* empty */
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dirty, entradaEstado])

    const cerrarModalResultado = () => {
      setModalResultado(false)
      reset()
      setItems([])
      setIdLoteGlobal('')
      setInfoLote(null)
      setPdfUrl(null)
      setEntradaId(null)
      setEntradaNumero('')
      setEntradaEstado('NUEVA')
      setDirty(false)
      setItemsDirty(false)
      onSuccess && onSuccess()
    }

    return (
      <div className='container-fluid mt-3'>
        <div className='d-flex justify-content-between align-items-center mb-2'>
          <h5 className='fw-bold text-center m-0'>
            Registrar Entrada (documento + fotos)
          </h5>

          {onClose && (
            <button
              type='button'
              className='btn btn-outline-secondary btn-sm'
              onClick={handleCloseRequest}
              disabled={procesando || isSubmitting}
            >
              Cerrar
            </button>
          )}
        </div>

        {statusMessage && (
          <div
            className='position-sticky top-0'
            style={{
              zIndex: 1200,
              borderRadius: 8,
              padding: '8px 12px',
              background:
                statusMessage.type === 'success' ? '#00BA59' : '#F74C1B',
              color: 'white',
              boxShadow: '0 6px 20px rgba(0,0,0,.15)',
              textAlign: 'center',
              marginBottom: 8,
            }}
            role='status'
          >
            {statusMessage.text}
          </div>
        )}

        <div className='d-flex flex-wrap gap-2 align-items-center mb-2'>
          <span className='badge bg-secondary'>Estado: {entradaEstado}</span>
          {entradaNumero && (
            <span className='badge bg-info text-dark'>{entradaNumero}</span>
          )}
          {dirty && entradaEstado !== 'CONFIRMADA' && (
            <span className='badge bg-warning text-dark'>
              Cambios sin guardar
            </span>
          )}
          {items.length > 0 &&
            !allItemsVerified &&
            entradaEstado !== 'CONFIRMADA' && (
              <span className='badge bg-danger'>Pendiente verificación</span>
            )}
        </div>

        <form onSubmit={e => e.preventDefault()} className='mt-1'>
          <div className='row g-2'>
            <div className='col-md-3'>
              <label className='form-label mb-1'>Lote (global)</label>
              <select
                className='form-select form-select-sm'
                value={idLoteGlobal}
                disabled={entradaEstado === 'CONFIRMADA'}
                onChange={e => {
                  const v = e.target.value
                  setIdLoteGlobal(v)
                  setItems([])
                  setInfoLote(null)
                  setValueItem('id_producto_item', '')
                  setValueItem('cantidad_item', '')
                  if (entradaEstado !== 'CONFIRMADA') {
                    setDirty(true)
                    setItemsDirty(true)
                  }
                }}
              >
                <option value=''>Selecciona un lote</option>
                {lotesUnicos.map(l => (
                  <option key={l.id_lote} value={l.id_lote}>
                    {l.id_lote}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-3'>
              <label className='form-label mb-1'>Bodega destino</label>
              <select
                className={`form-select form-select-sm ${
                  errors.id_bodega_destino ? 'is-invalid' : ''
                }`}
                disabled={entradaEstado === 'CONFIRMADA'}
                {...register('id_bodega_destino', { required: true })}
              >
                <option value=''>Selecciona una bodega</option>
                {bodegas.map(b => (
                  <option key={b.id_bodega} value={b.id_bodega}>
                    {b.nombre}
                  </option>
                ))}
              </select>
              {errors.id_bodega_destino && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
              <label className='form-label mb-1'>Ubicación destino</label>
              <select
                className={`form-select form-select-sm ${
                  errors.id_ubicacion_destino ? 'is-invalid' : ''
                }`}
                disabled={entradaEstado === 'CONFIRMADA'}
                {...register('id_ubicacion_destino', { required: true })}
              >
                <option value=''>Selecciona ubicación</option>
                {ubicacionesDeBodega.map(u => (
                  <option key={u.id_ubicacion} value={u.id_ubicacion}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              {errors.id_ubicacion_destino && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
              <label className='form-label mb-1'>Observaciones</label>
              <input
                type='text'
                className={`form-control form-select-sm ${
                  errors.comentario ? 'is-invalid' : ''
                }`}
                disabled={entradaEstado === 'CONFIRMADA'}
                placeholder='Notas u observaciones…'
                {...register('comentario', { required: true })}
              />
              {errors.comentario && (
                <div className='invalid-feedback'>Campo requerido</div>
              )}
            </div>
          </div>

          {infoLote && productoItem && (
            <div className='mt-2'>
              <div className='alert alert-info py-2 mb-1'>
                Lote: <strong>{idLoteGlobal}</strong> · Producto:{' '}
                <strong>{productoNombre(productoItem)}</strong> ·{' '}
                <strong>Cantidad: {infoLote.cantidad ?? '-'}</strong> · Origen:{' '}
                <strong>{infoLote.origen}</strong>
              </div>
            </div>
          )}

          {/* ===== ÍTEMS ===== */}
          <div className='mt-3 p-3 border rounded'>
            <div className='d-flex justify-content-between align-items-center gap-2 mb-3'>
              <div className='small text-muted fw-semibold'>
                Agregar ítem al listado
              </div>

              <div className='d-flex gap-2'>
                <button
                  type='button'
                  className='btn btn-outline-primary btn-sm'
                  disabled={
                    !idLoteGlobal ||
                    procesando ||
                    entradaEstado === 'CONFIRMADA'
                  }
                  onClick={agregarTodoElLote}
                  title='Carga todos los productos del lote con cantidades sugeridas (requiere verificación)'
                >
                  Agregar todo el lote
                </button>
              </div>
            </div>

            <div className='row g-3 align-items-end'>
              <div className='col-md-6'>
                <label className='form-label mb-1'>Producto</label>
                <select
                  className={`form-select form-select-sm ${
                    errorsItem.id_producto_item ? 'is-invalid' : ''
                  }`}
                  {...registerItem('id_producto_item', { required: true })}
                  disabled={!idLoteGlobal || entradaEstado === 'CONFIRMADA'}
                  onChange={e =>
                    setValueItem('id_producto_item', e.target.value)
                  }
                >
                  <option value=''>Selecciona un producto</option>
                  {productosUnicosDelLote.map((p, idx) => {
                    const ya = items.some(it => it.id_producto === p)
                    const labelNombre = productoNombre(p)
                    const label =
                      labelNombre && labelNombre !== p
                        ? `${p} — ${labelNombre}`
                        : p
                    return (
                      <option
                        key={idx}
                        value={p}
                        style={
                          ya ? { color: '#B00020', fontWeight: 600 } : undefined
                        }
                      >
                        {ya ? `${label} — AGREGADO` : label}
                      </option>
                    )
                  })}
                </select>
                {errorsItem.id_producto_item && (
                  <div className='invalid-feedback'>Obligatorio</div>
                )}
              </div>

              <div className='col-md-3'>
                <label className='form-label mb-1'>Cantidad</label>
                <input
                  type='number'
                  min='0'
                  step='any'
                  className={`form-control form-control-sm ${
                    errorsItem.cantidad_item ? 'is-invalid' : ''
                  }`}
                  disabled={!idLoteGlobal || entradaEstado === 'CONFIRMADA'}
                  {...registerItem('cantidad_item', {
                    required: 'Obligatorio',
                    validate: v => Number(v) > 0 || 'Debe ser mayor a 0',
                  })}
                />
                {errorsItem.cantidad_item && (
                  <div className='invalid-feedback'>
                    {errorsItem.cantidad_item.message || 'Inválida'}
                  </div>
                )}
              </div>

              <div className='col-md-3'>
                <button
                  type='button'
                  className='btn btn-primary btn-sm w-100'
                  onClick={onAddItem}
                  disabled={!idLoteGlobal || entradaEstado === 'CONFIRMADA'}
                >
                  Agregar ítem
                </button>
              </div>
            </div>

            <div className='mt-4'>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <span className='small text-muted'>
                  Ítems a procesar: <strong>{items.length}</strong>
                </span>

                <button
                  type='button'
                  className='btn btn-outline-danger btn-sm'
                  disabled={
                    !items.length ||
                    procesando ||
                    entradaEstado === 'CONFIRMADA'
                  }
                  onClick={() => {
                    setItems([])
                    if (entradaEstado !== 'CONFIRMADA') {
                      setDirty(true)
                      setItemsDirty(true)
                    }
                  }}
                >
                  Vaciar lista
                </button>
              </div>

              <div className='table-responsive'>
                <table className='table table-sm table-striped align-middle'>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th className='text-end'>Cantidad</th>
                      <th className='text-center'>Verificado</th>
                      <th>Foto</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan='6' className='text-center text-muted'>
                          Sin ítems
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const pendiente = !it.verificado
                        return (
                          <tr
                            key={`${it.id_producto}-${idx}`}
                            style={
                              pendiente
                                ? {
                                    boxShadow:
                                      'inset 4px 0 0 rgba(247,76,27,.9)',
                                  }
                                : undefined
                            }
                          >
                            <td>{idx + 1}</td>

                            <td>
                              <div className='fw-semibold'>
                                {productoNombre(it.id_producto)}
                              </div>
                              <div className='text-muted small'>
                                {it.id_producto}
                              </div>
                            </td>

                            <td className='text-end'>
                              {entradaEstado === 'CONFIRMADA' ? (
                                <>
                                  {it.cantidad} {productoUnidad(it.id_producto)}
                                </>
                              ) : (
                                <div className='d-flex justify-content-end align-items-center gap-2'>
                                  <input
                                    type='number'
                                    min='0'
                                    step='any'
                                    className='form-control form-control-sm'
                                    style={{ maxWidth: 140 }}
                                    value={it.cantidad}
                                    onChange={e =>
                                      actualizarCantidadItem(
                                        idx,
                                        e.target.value
                                      )
                                    }
                                    disabled={procesando}
                                    title='Si cambias la cantidad, queda pendiente de verificación'
                                  />
                                  <span className='text-muted small'>
                                    {productoUnidad(it.id_producto)}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className='text-center'>
                              <input
                                type='checkbox'
                                className='form-check-input'
                                checked={!!it.verificado}
                                onChange={() => toggleVerificado(idx)}
                                disabled={
                                  procesando || entradaEstado === 'CONFIRMADA'
                                }
                                title={
                                  it.verificado
                                    ? 'Verificado'
                                    : 'Pendiente: marca después de revisar'
                                }
                              />
                              {!it.verificado && (
                                <div className='small text-danger mt-1'>
                                  Pendiente
                                </div>
                              )}
                            </td>

                            <td>
                              <div className='d-flex flex-column gap-2'>
                                <div className='d-flex gap-2'>
                                  <button
                                    type='button'
                                    className='btn btn-outline-secondary btn-sm'
                                    onClick={() => openCameraForItem(idx)}
                                    disabled={
                                      procesando ||
                                      entradaEstado === 'CONFIRMADA'
                                    }
                                  >
                                    Usar cámara
                                  </button>

                                  <button
                                    type='button'
                                    className='btn btn-outline-secondary btn-sm'
                                    onClick={() =>
                                      document
                                        .getElementById(`file-item-${idx}`)
                                        ?.click()
                                    }
                                    disabled={
                                      procesando ||
                                      entradaEstado === 'CONFIRMADA'
                                    }
                                  >
                                    Subir imagen
                                  </button>
                                </div>

                                <input
                                  id={`file-item-${idx}`}
                                  type='file'
                                  accept='image/*'
                                  hidden
                                  onChange={e =>
                                    onFileForItem(
                                      idx,
                                      e.target.files?.[0] || null
                                    )
                                  }
                                  disabled={entradaEstado === 'CONFIRMADA'}
                                />

                                <div className='small'>
                                  {it.evidenciaName ? (
                                    <span className='text-success'>
                                      Archivo:{' '}
                                      <strong>{it.evidenciaName}</strong>
                                    </span>
                                  ) : it.evidenciaUrl ? (
                                    <a
                                      className='text-success'
                                      href={it.evidenciaUrl}
                                      target='_blank'
                                      rel='noreferrer'
                                    >
                                      Evidencia cargada (ver)
                                    </a>
                                  ) : (
                                    <span className='text-danger'>
                                      Sin foto
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className='text-end'>
                              <button
                                type='button'
                                className='btn btn-outline-danger btn-sm'
                                onClick={() => removeItem(idx)}
                                disabled={
                                  procesando || entradaEstado === 'CONFIRMADA'
                                }
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan='2' className='text-end fw-semibold'>
                        TOTAL
                      </td>
                      <td className='text-end fw-bold'>
                        {Object.entries(totalesPorUnidad).length === 0
                          ? '0'
                          : Object.entries(totalesPorUnidad).length === 1
                          ? (() => {
                              const [u, v] = Object.entries(totalesPorUnidad)[0]
                              return `${v} ${u}`
                            })()
                          : Object.entries(totalesPorUnidad)
                              .map(([u, v]) => `${v} ${u}`)
                              .join(' · ')}
                      </td>
                      <td colSpan='3'></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cámara */}
              {cameraIndex !== null && (
                <div
                  className='mt-3 border rounded p-3'
                  style={{ minHeight: 320 }}
                >
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <div className='fw-semibold'>
                      Cámara para ítem #{cameraIndex + 1}
                    </div>
                    <button
                      type='button'
                      className='btn btn-outline-dark btn-sm'
                      onClick={closeCamera}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className='ratio ratio-16x9'>
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat='image/jpeg'
                      videoConstraints={{ facingMode: 'environment' }}
                      className='w-100 h-100'
                    />
                  </div>

                  <div className='d-flex justify-content-center gap-3 mt-3'>
                    <button
                      type='button'
                      className='btn btn-primary btn-sm'
                      onClick={captureForItem}
                    >
                      Capturar
                    </button>
                    <button
                      type='button'
                      className='btn btn-outline-danger btn-sm'
                      onClick={closeCamera}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className='d-flex justify-content-end gap-2 mt-4'>
            <button
              type='button'
              className='btn btn-outline-primary btn-sm'
              disabled={
                isSubmitting ||
                procesando ||
                entradaEstado === 'CONFIRMADA' ||
                !items.length ||
                !idLoteGlobal
              }
              onClick={() => guardarBorrador({ silent: false })}
            >
              Guardar borrador
            </button>

            <button
              type='button'
              className='btn btn-primary btn-sm'
              disabled={
                isSubmitting ||
                procesando ||
                entradaEstado === 'CONFIRMADA' ||
                !items.length ||
                !idLoteGlobal ||
                !allItemsVerified ||
                (REQUIRE_PHOTOS_TO_CONFIRM ? !allItemsHaveEvidence : false)
              }
              onClick={confirmar}
              title={
                !allItemsVerified
                  ? 'Debes verificar todos los ítems antes de confirmar'
                  : undefined
              }
            >
              {procesando ? 'Procesando…' : 'Confirmar entrada'}
            </button>
          </div>
        </form>

        {/* Modal QRs */}
        <Modal
          isOpen={modalResultado}
          onRequestClose={() => {}}
          shouldCloseOnOverlayClick={false}
          shouldCloseOnEsc={false}
          contentLabel='Resultado de Entrada'
          style={{
            overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 },
            content: {
              inset: '5% 4%',
              borderRadius: 16,
              padding: 20,
              maxWidth: 1280,
              margin: '0 auto',
              zIndex: 2001,
            },
          }}
        >
          <div className='d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3'>
            <h6 className='m-0 fw-bold' style={{ color: '#1E73B6' }}>
              Entrada confirmada {entradaNumero ? `— ${entradaNumero}` : ''}
            </h6>

            <div className='d-flex flex-wrap gap-3'>
              <button
                className='btn btn-sm btn-outline-primary'
                onClick={() => descargarZIPQRs(respuestas)}
              >
                Descargar QR (ZIP)
              </button>

              {pdfUrl && (
                <a
                  className='btn btn-sm btn-outline-dark'
                  href={pdfUrl}
                  target='_blank'
                  rel='noreferrer'
                >
                  Ver PDF de entrada
                </a>
              )}

              <button
                className='btn btn-sm btn-outline-secondary'
                onClick={cerrarModalResultado}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className='row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 gy-4 gx-4'>
            {respuestas.length === 0 ? (
              <div className='text-muted'>No hay respuestas</div>
            ) : (
              respuestas.map((r, i) => {
                const nombrePNG = `QR_${r.lote}_${r.producto}_${i + 1}.png`
                return (
                  <div key={i} className='col'>
                    <div
                      className='border rounded-3 p-4 h-100 d-flex flex-column shadow-sm'
                      style={{ minHeight: 520 }}
                    >
                      <div className='small text-muted mb-1'>
                        {r.mensaje || 'OK'}
                      </div>
                      <div className='fw-semibold mb-1'>
                        {productoNombre(r.producto)} · {r.cantidad_ingresada}{' '}
                        {productoUnidad(r.producto)}
                      </div>

                      <div className='d-flex justify-content-center mb-4'>
                        {r.qr_image ? (
                          <img
                            src={r.qr_image}
                            alt='QR'
                            style={{
                              maxWidth: 260,
                              width: '100%',
                              borderRadius: 10,
                              border: '1px dashed #59A1F7',
                              padding: 10,
                            }}
                          />
                        ) : (
                          <div className='text-muted'>Sin QR</div>
                        )}
                      </div>

                      <div className='d-flex flex-wrap gap-3 mt-auto'>
                        <button
                          type='button'
                          className='btn btn-sm btn-outline-primary'
                          onClick={() =>
                            r.qr_image && descargarPNG(r.qr_image, nombrePNG)
                          }
                          disabled={!r.qr_image}
                        >
                          Descargar PNG
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Modal>
      </div>
    )
  }
)

export default FormIngreso
