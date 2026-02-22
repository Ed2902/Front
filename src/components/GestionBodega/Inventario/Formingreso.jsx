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
import { saveAs } from 'file-saver'

Modal.setAppElement('#root')

// ✅ Si quieres confirmar sin fotos, ponlo en false
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

// Detecta si hay datos mínimos para guardar borrador
const hasMinimumDraftData = ({ idLoteGlobal, items, data, user }) => {
  const hasLote = !!idLoteGlobal
  const hasItems = (items || []).length > 0
  const hasUser = !!(user?.personal?.id_personal || user?.id)
  const hasObs = !!(data?.comentario && String(data.comentario).trim())
  return hasUser && hasLote && (hasItems || hasObs)
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
    const [itemsDirty, setItemsDirty] = useState(false)

    // ===== Ítems =====
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
          setTimeout(() => setStatusMessage(null), 2200)
        }
      }
      fetchData()
    }, [])

    // ====== Orden correcto de lotes: GEN_099 arriba, GEN_001 abajo ======
    const parseLote = useCallback(idLote => {
      const s = String(idLote || '').trim()
      const m = s.match(/^([A-Za-z]+)_(\d+)$/)
      if (!m) return { raw: s, prefix: s.toUpperCase(), num: -1 }
      const prefix = m[1].toUpperCase()
      const num = Number(m[2])
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
        if (A.prefix !== B.prefix) return A.prefix.localeCompare(B.prefix)
        if (B.num !== A.num) return B.num - A.num
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
    const getUltimaCantidadLoteProducto = useCallback(
      idProd => {
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
      },
      [idLoteGlobal, lotesRaw]
    )

    const cantidadAsignadaPorProducto = useMemo(() => {
      const acc = {}
      for (const it of items) {
        const idProd = it?.id_producto
        if (!idProd) continue
        acc[idProd] = (acc[idProd] || 0) + (Number(it.cantidad) || 0)
      }
      return acc
    }, [items])

    const faltantePorProducto = useMemo(() => {
      const map = {}
      for (const idProd of productosUnicosDelLote) {
        const totalLote = Number(getUltimaCantidadLoteProducto(idProd)) || 0
        const asignada = Number(cantidadAsignadaPorProducto[idProd] || 0)
        const faltante = Math.max(totalLote - asignada, 0)
        map[idProd] = { totalLote, asignada, faltante }
      }
      return map
    }, [
      productosUnicosDelLote,
      cantidadAsignadaPorProducto,
      getUltimaCantidadLoteProducto,
    ])

    const productosFaltantesDelLote = useMemo(() => {
      return productosUnicosDelLote.filter(
        p => (faltantePorProducto[p]?.faltante || 0) > 0
      )
    }, [productosUnicosDelLote, faltantePorProducto])

    const allLoteProductsCompleted = useMemo(() => {
      if (!idLoteGlobal) return false
      if (!productosUnicosDelLote.length) return false
      return productosFaltantesDelLote.length === 0
    }, [idLoteGlobal, productosUnicosDelLote, productosFaltantesDelLote])

    // ========= Agregar todo el lote =========
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

      const data = getValues()
      const defaultBodega = data.id_bodega_destino || ''
      const defaultUbi = data.id_ubicacion_destino || ''

      let agregados = 0
      setItems(prev => {
        const next = [...prev]

        for (const idProd of productosUnicosDelLote) {
          const totalLote = Number(getUltimaCantidadLoteProducto(idProd)) || 0
          const asignada = next
            .filter(it => it.id_producto === idProd)
            .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0)
          const faltante = Math.max(totalLote - asignada, 0)

          if (faltante <= 0) continue

          next.push({
            id_producto: idProd,
            cantidad: faltante,
            Id_bodega_destino: defaultBodega,
            Id_ubicacion_destino: defaultUbi,
            verificado: false,
            evidenciaFile: null,
            evidenciaName: '',
            evidenciaUrl: null,
          })
          agregados += 1
        }

        return next.filter(it => Number(it.cantidad) > 0)
      })

      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }

      setStatusMessage(
        agregados > 0
          ? {
              type: 'success',
              text: 'Se agregaron faltantes del lote. Revisa y verifica.',
            }
          : {
              type: 'success',
              text: 'El lote ya está completo en la lista.',
            }
      )
      setTimeout(() => setStatusMessage(null), 2200)
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
          verificado: false,
        }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    const actualizarBodegaItem = (idx, idBodega) => {
      setItems(prev => {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          Id_bodega_destino: idBodega,
          Id_ubicacion_destino: '',
          verificado: false,
        }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    const actualizarUbicacionItem = (idx, idUbi) => {
      setItems(prev => {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          Id_ubicacion_destino: idUbi,
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
    const _totalesPorUnidad = useMemo(() => {
      const acc = {}
      for (const it of items) {
        const unidad = productoUnidad(it.id_producto) || 'UND'
        const cant = Number(it.cantidad) || 0
        acc[unidad] = (acc[unidad] || 0) + cant
      }
      return acc
    }, [items, productoUnidad])

    const totalCantidad = useMemo(() => {
      return items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0)
    }, [items])

    const allItemsVerified =
      items.length > 0 && items.every(it => it.verificado === true)

    const allItemsHaveEvidence =
      items.length > 0 &&
      items.every(it => !!it.evidenciaFile || !!it.evidenciaUrl)

    const allItemsHaveDestino =
      items.length > 0 &&
      items.every(it => !!it.Id_bodega_destino && !!it.Id_ubicacion_destino)

    const comentarioWatch = watch('comentario')

    const comentarioValido = useMemo(() => {
      return !!String(comentarioWatch || '').trim()
    }, [comentarioWatch])

    const progress = useMemo(() => {
      let p = 0
      if (idLoteGlobal) p += 20
      if (comentarioValido) p += 20
      if (items.length > 0) p += 20
      if (allItemsHaveDestino) p += 20
      if (allItemsVerified) p += 10
      if (!REQUIRE_PHOTOS_TO_CONFIRM || allItemsHaveEvidence) p += 10
      return Math.min(100, p)
    }, [
      idLoteGlobal,
      comentarioValido,
      items.length,
      allItemsHaveDestino,
      allItemsVerified,
      allItemsHaveEvidence,
    ])

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
        comentario: initialEntrada?.Observaciones || '',
        id_bodega_destino: '',
        id_ubicacion_destino: '',
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
          Id_bodega_destino: d?.Id_bodega_destino || d?.id_bodega_destino || '',
          Id_ubicacion_destino:
            d?.Id_ubicacion_destino || d?.id_ubicacion_destino || '',
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

    // ========= Mark dirty on change =========
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
          verificado: false,
        }
        return copy
      })
      if (entradaEstado !== 'CONFIRMADA') {
        setDirty(true)
        setItemsDirty(true)
      }
    }

    const descargarPNG = (src, nombre = 'qr.png') => {
      if (!src) return
      fetch(src)
        .then(res => res.blob())
        .then(blob => saveAs(blob, nombre))
        .catch(() => {})
    }

    // ========= SUBFORM: Agregar ítem =========
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

        const data = getValues()
        const defaultBodega = data.id_bodega_destino || ''
        const defaultUbi = data.id_ubicacion_destino || ''

        setItems(prev => [
          ...prev,
          {
            id_producto: id_producto_item,
            cantidad: cant,
            Id_bodega_destino: defaultBodega,
            Id_ubicacion_destino: defaultUbi,
            verificado: false,
            evidenciaFile: null,
            evidenciaName: '',
            evidenciaUrl: null,
          },
        ])

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

    // ========= RESULTADOS / MODAL =========
    const [procesando, setProcesando] = useState(false)
    const [modalResultado, setModalResultado] = useState(false)
    const [respuestas, setRespuestas] = useState([])
    const [pdfUrl, setPdfUrl] = useState(null)

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
        if (!items.length) throw new Error('Agrega al menos un ítem.')
        if (!allItemsHaveDestino) {
          throw new Error(
            'Cada producto debe tener bodega y ubicación destino.'
          )
        }

        const cabeceraPayload = {
          Fecha_entrada: new Date().toISOString(),
          Id_personal: user?.personal?.id_personal || '',
          Observaciones: data.comentario || '',
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

        // ✅ Si solo cambió cabecera
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
          Id_bodega_destino: it.Id_bodega_destino,
          Id_ubicacion_destino: it.Id_ubicacion_destino,
          Comentario: '',
        }))

        const respDetalles = await agregarDetallesEntrada(
          idEntrada,
          detallesPayload
        )
        const detallesCreados =
          respDetalles?.data?.data || respDetalles?.data || respDetalles || []

        const detalleQueuesPorProducto = new Map()
        ;(detallesCreados || []).forEach(d => {
          const idProd = d.Id_producto || d.id_producto
          const idDet = d.Id_detalle || d.id_detalle
          if (!idProd || !idDet) return
          if (!detalleQueuesPorProducto.has(idProd)) {
            detalleQueuesPorProducto.set(idProd, [])
          }
          detalleQueuesPorProducto.get(idProd).push(idDet)
        })

        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const detalleByIndex =
            detallesCreados?.[i]?.Id_detalle || detallesCreados?.[i]?.id_detalle
          const colaProducto =
            detalleQueuesPorProducto.get(it.id_producto) || []
          const idDetalle = detalleByIndex || colaProducto.shift()
          if (it.evidenciaFile && idDetalle) {
            try {
              await subirFotoDetalleEntrada(idDetalle, it.evidenciaFile)
            } catch (e) {
              if (!silent) console.warn('Error subiendo foto:', e)
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
        console.error(err)
        if (!silent) {
          setStatusMessage({
            type: 'error',
            text:
              err?.response?.data?.message ||
              err?.message ||
              'Error guardando borrador',
          })
          setTimeout(() => setStatusMessage(null), 2600)
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
      if (!allItemsHaveDestino) {
        setStatusMessage({
          type: 'error',
          text: 'Cada producto debe tener bodega y ubicación destino.',
        })
        setTimeout(() => setStatusMessage(null), 2400)
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
      if (!allItemsVerified) {
        setStatusMessage({
          type: 'error',
          text: 'Debes verificar todos los ítems.',
        })
        setTimeout(() => setStatusMessage(null), 2200)
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

      if (productosFaltantesDelLote.length > 0) {
        const resumenFaltantes = productosFaltantesDelLote
          .slice(0, 6)
          .map(idProd => {
            const faltante = Number(faltantePorProducto[idProd]?.faltante || 0)
            return `${productoNombre(idProd)}: faltan ${faltante}`
          })
          .join('\n')

        const extra =
          productosFaltantesDelLote.length > 6
            ? `\n...y ${productosFaltantesDelLote.length - 6} producto(s) más.`
            : ''

        const okConfirmarIncompleto = window.confirm(
          `No has asignado todo el lote seleccionado.\n\n${resumenFaltantes}${extra}\n\n¿Seguro que deseas confirmar y guardar la entrada incompleta?`
        )

        if (!okConfirmarIncompleto) {
          setStatusMessage({
            type: 'error',
            text: 'Confirmación cancelada. Completa el lote o confirma de nuevo.',
          })
          setTimeout(() => setStatusMessage(null), 2400)
          return
        }
      }

      setProcesando(true)
      setPdfUrl(null)

      try {
        const saved = await guardarBorrador({ silent: true })
        const idToConfirm = saved?.idEntrada || entradaId
        if (!idToConfirm) throw new Error('No hay Id_entrada para confirmar.')

        const respConf = await confirmarEntrada(idToConfirm)
        const confData = respConf?.data || respConf

        const movimientos =
          confData?.movimientos || confData?.data?.movimientos || []
        const rutaPdf =
          confData?.Ruta_pdf || confData?.ruta_pdf || confData?.data?.Ruta_pdf
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
    // CIERRE SEGURO
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

    // ==========================================
    // UI COMPACTA
    // ==========================================
    return (
      <div className='container-fluid py-2' style={{ maxWidth: 1480 }}>
        {/* Header compacto */}
        <div className='d-flex align-items-center justify-content-between mb-2'>
          <div className='d-flex align-items-center gap-2 flex-wrap'>
            <h6 className='fw-bold m-0'>Entrada</h6>
            <span className='badge bg-dark'>{entradaEstado}</span>
            {entradaNumero && (
              <span className='badge bg-light text-dark border'>
                {entradaNumero}
              </span>
            )}
            {dirty && entradaEstado !== 'CONFIRMADA' && (
              <span className='badge bg-warning text-dark border'>
                Sin guardar
              </span>
            )}
          </div>

          {onClose && (
            <button
              type='button'
              className='btn btn-sm btn-outline-secondary'
              onClick={handleCloseRequest}
              disabled={procesando || isSubmitting}
            >
              Cerrar
            </button>
          )}
        </div>

        {/* Status compacto */}
        {statusMessage && (
          <div
            className={`alert py-2 px-3 mb-2 ${
              statusMessage.type === 'success'
                ? 'alert-success'
                : 'alert-danger'
            }`}
            role='status'
          >
            <small className='fw-semibold'>
              {statusMessage.type === 'success' ? '✅ ' : '⚠️ '}
              {statusMessage.text}
            </small>
          </div>
        )}

        {/* Progreso compacto */}
        <div className='mb-2'>
          <div className='d-flex justify-content-between'>
            <small className='text-muted'>Progreso</small>
            <small className='text-muted fw-semibold'>{progress}%</small>
          </div>
          <div className='progress' style={{ height: 8 }}>
            <div className='progress-bar' style={{ width: `${progress}%` }} />
          </div>

          <div className='d-flex flex-wrap gap-1 mt-2'>
            <span
              className={`badge ${
                idLoteGlobal ? 'bg-success' : 'bg-secondary'
              }`}
            >
              Lote
            </span>

            <span
              className={`badge ${
                comentarioValido ? 'bg-success' : 'bg-secondary'
              }`}
            >
              Observación
            </span>

            <span
              className={`badge ${
                items.length ? 'bg-success' : 'bg-secondary'
              }`}
            >
              Ítems
            </span>

            <span
              className={`badge ${
                allItemsHaveDestino ? 'bg-success' : 'bg-secondary'
              }`}
            >
              Destino
            </span>

            <span
              className={`badge ${
                !REQUIRE_PHOTOS_TO_CONFIRM || allItemsHaveEvidence
                  ? 'bg-success'
                  : 'bg-secondary'
              }`}
            >
              Evidencia
            </span>

            <span
              className={`badge ${
                allItemsVerified ? 'bg-success' : 'bg-secondary'
              }`}
            >
              OK
            </span>
          </div>
        </div>

        {/* Datos base compactos */}
        <div
          className='border rounded-3 p-2 mb-2 bg-white'
          style={{ boxShadow: '0 8px 20px rgba(0,0,0,.06)' }}
        >
          <div className='row g-2 align-items-start'>
            <div className='col-md-3'>
              <label className='form-label small fw-semibold mb-1'>Lote</label>
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
                <option value=''>Selecciona lote</option>
                {lotesUnicos.map(l => (
                  <option key={l.id_lote} value={l.id_lote}>
                    {l.id_lote}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-9'>
              <label className='form-label small fw-semibold mb-1'>
                Observaciones
              </label>
              <textarea
                className={`form-control form-control-sm ${
                  errors.comentario ? 'is-invalid' : ''
                }`}
                disabled={entradaEstado === 'CONFIRMADA'}
                placeholder='Ej: devolución, calidad, observaciones…'
                rows={2}
                {...register('comentario', { required: true })}
              />
              {errors.comentario && (
                <div className='invalid-feedback'>Campo requerido</div>
              )}
            </div>
          </div>

          {infoLote && productoItem && (
            <div className='mt-2 small text-muted'>
              <span className='fw-semibold'>Ref:</span> {idLoteGlobal} ·{' '}
              {productoNombre(productoItem)} · Cant: {infoLote.cantidad ?? '-'}{' '}
              · {infoLote.origen}
            </div>
          )}
        </div>

        {/* Ítems compactos */}
        <div
          className='border rounded-3 p-2 bg-white'
          style={{ boxShadow: '0 8px 20px rgba(0,0,0,.06)' }}
        >
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <div className='fw-bold'>Ítems</div>

            <button
              type='button'
              className='btn btn-sm btn-outline-primary'
              disabled={
                !idLoteGlobal ||
                procesando ||
                entradaEstado === 'CONFIRMADA' ||
                allLoteProductsCompleted
              }
              onClick={agregarTodoElLote}
              title={
                allLoteProductsCompleted
                  ? 'El lote ya está completo en la lista'
                  : 'Completa faltantes de todo el lote'
              }
            >
              {allLoteProductsCompleted ? 'Lote completo ✅' : 'Agregar todo'}
            </button>
          </div>

          {/* Agregar ítem inline */}
          <div className='row g-2 align-items-end'>
            <div className='col-md-6'>
              <label className='form-label small fw-semibold mb-1'>
                Producto
              </label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_producto_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_producto_item', { required: true })}
                disabled={!idLoteGlobal || entradaEstado === 'CONFIRMADA'}
                onChange={e => setValueItem('id_producto_item', e.target.value)}
              >
                <option value=''>Selecciona</option>
                {productosUnicosDelLote.map((p, idx) => {
                  const labelNombre = productoNombre(p)
                  const faltante = Number(faltantePorProducto[p]?.faltante || 0)
                  const totalLote = Number(
                    faltantePorProducto[p]?.totalLote || 0
                  )
                  const label =
                    labelNombre && labelNombre !== p
                      ? `${p} — ${labelNombre}`
                      : p

                  return (
                    <option
                      key={idx}
                      value={p}
                      style={
                        totalLote > 0
                          ? faltante > 0
                            ? { color: '#B00020', fontWeight: 600 }
                            : { color: '#198754', fontWeight: 600 }
                          : undefined
                      }
                    >
                      {totalLote > 0
                        ? `${label} — Faltan ${faltante} de ${totalLote}`
                        : label}
                    </option>
                  )
                })}
              </select>
              {errorsItem.id_producto_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
              <label className='form-label small fw-semibold mb-1'>
                Cantidad
              </label>
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
                className='btn btn-sm btn-primary w-100'
                onClick={onAddItem}
                disabled={!idLoteGlobal || entradaEstado === 'CONFIRMADA'}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Tabla compacta */}
          <div className='table-responsive mt-2' style={{ maxHeight: 420 }}>
            <table className='table table-sm align-middle mb-0'>
              <thead
                className='table-light'
                style={{ position: 'sticky', top: 0, zIndex: 5 }}
              >
                <tr className='small text-muted'>
                  <th>#</th>
                  <th>Producto</th>
                  <th className='text-end'>Cant</th>
                  <th>Bodega</th>
                  <th>Ubicación</th>
                  <th>Evidencia</th>
                  <th className='text-center'>OK</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan='8' className='text-center text-muted py-3'>
                      Sin ítems.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const ubicacionesItem = ubicaciones.filter(
                      u => u.id_bodega === (it.Id_bodega_destino || '')
                    )

                    return (
                      <tr
                        key={`${it.id_producto}-${idx}`}
                        className='border-top'
                      >
                        <td>{idx + 1}</td>

                        <td>
                          <div className='fw-semibold small'>
                            {productoNombre(it.id_producto)}
                          </div>
                          <div className='text-muted small'>
                            {it.id_producto}
                          </div>
                        </td>

                        <td className='text-end'>
                          <input
                            type='number'
                            min='0'
                            step='any'
                            className='form-control form-control-sm'
                            style={{ maxWidth: 110, marginLeft: 'auto' }}
                            value={it.cantidad}
                            onChange={e =>
                              actualizarCantidadItem(idx, e.target.value)
                            }
                            disabled={
                              procesando || entradaEstado === 'CONFIRMADA'
                            }
                          />
                        </td>

                        <td>
                          <select
                            className='form-select form-select-sm'
                            value={it.Id_bodega_destino || ''}
                            disabled={
                              procesando || entradaEstado === 'CONFIRMADA'
                            }
                            onChange={e =>
                              actualizarBodegaItem(idx, e.target.value)
                            }
                          >
                            <option value=''>Bodega…</option>
                            {bodegas.map(b => (
                              <option key={b.id_bodega} value={b.id_bodega}>
                                {b.nombre}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <select
                            className='form-select form-select-sm'
                            value={it.Id_ubicacion_destino || ''}
                            disabled={
                              procesando ||
                              entradaEstado === 'CONFIRMADA' ||
                              !it.Id_bodega_destino
                            }
                            onChange={e =>
                              actualizarUbicacionItem(idx, e.target.value)
                            }
                          >
                            <option value=''>Ubicación…</option>
                            {ubicacionesItem.map(u => (
                              <option
                                key={u.id_ubicacion}
                                value={u.id_ubicacion}
                              >
                                {u.nombre}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Evidencia */}
                        <td>
                          <div className='d-flex gap-2 align-items-center flex-wrap'>
                            <label
                              htmlFor={`file-${idx}`}
                              className='btn btn-sm btn-primary mb-0'
                              style={{
                                cursor: 'pointer',
                                fontWeight: 600,
                                borderRadius: 10,
                                boxShadow: '0 4px 10px rgba(13,110,253,.15)',
                              }}
                            >
                              Seleccionar
                            </label>

                            <input
                              id={`file-${idx}`}
                              type='file'
                              accept='image/*'
                              onChange={e =>
                                onFileForItem(idx, e.target.files?.[0] || null)
                              }
                              disabled={entradaEstado === 'CONFIRMADA'}
                              style={{ display: 'none' }}
                            />

                            {it.evidenciaFile || it.evidenciaUrl ? (
                              <span className='badge bg-success'>✔</span>
                            ) : (
                              <span className='badge bg-secondary'>—</span>
                            )}
                          </div>
                        </td>

                        {/* OK */}
                        <td className='text-center'>
                          <div
                            className='d-inline-flex align-items-center justify-content-center'
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: it.verificado
                                ? 'rgba(13,110,253,.12)'
                                : '#f1f3f5',
                              border: it.verificado
                                ? '2px solid #0d6efd'
                                : '2px solid #6c757d',
                            }}
                          >
                            <input
                              type='checkbox'
                              className='form-check-input m-0'
                              style={{
                                width: 18,
                                height: 18,
                                cursor: 'pointer',
                                accentColor: '#0d6efd',
                              }}
                              checked={!!it.verificado}
                              onChange={() => toggleVerificado(idx)}
                              disabled={
                                procesando || entradaEstado === 'CONFIRMADA'
                              }
                            />
                          </div>
                        </td>

                        <td className='text-end'>
                          <button
                            type='button'
                            className='btn btn-sm btn-outline-danger'
                            onClick={() => removeItem(idx)}
                            disabled={
                              procesando || entradaEstado === 'CONFIRMADA'
                            }
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div className='mt-2 small text-muted'>
              <span className='fw-semibold'>Total:</span> {totalCantidad}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className='position-sticky bottom-0 mt-2'
          style={{
            background: 'rgba(255,255,255,.92)',
            backdropFilter: 'blur(6px)',
            borderTop: '1px solid rgba(0,0,0,.08)',
            padding: '8px 0',
          }}
        >
          <div className='d-flex justify-content-end gap-2'>
            <button
              type='button'
              className='btn btn-sm btn-outline-primary'
              disabled={
                isSubmitting ||
                procesando ||
                entradaEstado === 'CONFIRMADA' ||
                !items.length ||
                !idLoteGlobal ||
                !allItemsHaveDestino
              }
              onClick={() => guardarBorrador({ silent: false })}
            >
              Guardar
            </button>

            <button
              type='button'
              className='btn btn-sm btn-primary'
              title={
                !allItemsVerified
                  ? 'Debes verificar todos los ítems'
                  : !allItemsHaveDestino
                    ? 'Falta destino en algunos ítems'
                    : REQUIRE_PHOTOS_TO_CONFIRM && !allItemsHaveEvidence
                      ? 'Falta evidencia en algunos ítems'
                      : ''
              }
              disabled={
                isSubmitting ||
                procesando ||
                entradaEstado === 'CONFIRMADA' ||
                !items.length ||
                !idLoteGlobal ||
                !allItemsVerified ||
                !allItemsHaveDestino ||
                (REQUIRE_PHOTOS_TO_CONFIRM ? !allItemsHaveEvidence : false)
              }
              onClick={confirmar}
            >
              {procesando ? 'Procesando…' : 'Confirmar'}
            </button>
          </div>
        </div>

        {/* Modal resultado */}
        <Modal
          isOpen={modalResultado}
          onRequestClose={() => {}}
          shouldCloseOnOverlayClick={false}
          shouldCloseOnEsc={false}
          contentLabel='Resultado de Entrada'
        >
          <div className='d-flex justify-content-between align-items-center mb-3'>
            <h6 className='m-0 fw-bold'>Entrada confirmada</h6>
            <button
              className='btn btn-outline-secondary btn-sm'
              onClick={cerrarModalResultado}
            >
              Cerrar
            </button>
          </div>

          {pdfUrl && (
            <div className='alert alert-info py-2'>
              PDF generado:{' '}
              <a href={pdfUrl} target='_blank' rel='noreferrer'>
                Abrir PDF
              </a>
            </div>
          )}

          <div className='row'>
            {respuestas.map((r, i) => (
              <div key={i} className='col-md-3 mb-3'>
                <div className='border rounded-3 p-3 h-100 text-center'>
                  <div className='fw-semibold'>{r.producto}</div>
                  {r.qr_image && (
                    <img src={r.qr_image} alt='QR' className='img-fluid mt-2' />
                  )}
                  <button
                    className='btn btn-outline-primary btn-sm mt-2'
                    onClick={() => descargarPNG(r.qr_image, `QR_${i + 1}.png`)}
                    disabled={!r.qr_image}
                  >
                    Descargar PNG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    )
  }
)

export default FormIngreso
