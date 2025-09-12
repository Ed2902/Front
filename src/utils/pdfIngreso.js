// src/utils/pdfIngresoColor.js
// Requiere: npm i jspdf jszip
export const generarPdfIngresoBonito = async ({
  lote,
  producto,
  productoNombre,
  unidad,
  cantidad,
  fecha,
  bodega,
  ubicacion,
  qrDataUrl, // dataURL PNG del QR (si no lo tienes, lo convierto desde URL en la función ZIP)
}) => {
  const { jsPDF } = await import(/* @vite-ignore */ 'jspdf')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const colorBrand = '#F74C1B' // naranja FASTWAY
  const colorAccent = '#1E73B6' // azul
  const pad = 32

  // Header
  doc.setDrawColor(colorBrand)
  doc.setFillColor(colorBrand)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 8, 'F')

  doc.setFontSize(18)
  doc.setTextColor(colorAccent)
  doc.text('Comprobante de Entrada', pad, 40)

  // Fecha generado
  doc.setFontSize(10)
  doc.setTextColor('#666')
  doc.text(`Generado: ${new Date().toLocaleString()}`, pad, 60)

  // Tarjeta de datos
  const cardY = 80
  doc.setDrawColor('#e0e0e0')
  doc.setLineWidth(1)
  doc.roundedRect(pad, cardY, 540, 120, 8, 8, 'S')

  doc.setFontSize(11)
  doc.setTextColor('#555')
  const row1Y = cardY + 24
  const row2Y = cardY + 54
  const row3Y = cardY + 84

  // Fila 1
  doc.text('Operación', pad + 12, row1Y)
  doc.text('Lote', pad + 200, row1Y)
  doc.text('Producto', pad + 360, row1Y)

  doc.setFontSize(12)
  doc.setTextColor('#111')
  doc.text('-', pad + 12, row1Y + 16)
  doc.text(String(lote || '-'), pad + 200, row1Y + 16)
  doc.text(String(producto || '-'), pad + 360, row1Y + 16)

  // Fila 2
  doc.setFontSize(11)
  doc.setTextColor('#555')
  doc.text('Nombre Producto', pad + 12, row2Y)
  doc.text('Unidad', pad + 360, row2Y)
  doc.setFontSize(12)
  doc.setTextColor('#111')
  doc.text(String(productoNombre || '-'), pad + 12, row2Y + 16)
  doc.text(String(unidad || '-'), pad + 360, row2Y + 16)

  // Fila 3
  doc.setFontSize(11)
  doc.setTextColor('#555')
  doc.text('Cantidad Ingresada', pad + 12, row3Y)
  doc.text('Bodega / Ubicación', pad + 200, row3Y)

  doc.setFontSize(12)
  doc.setTextColor('#111')
  doc.text(`${cantidad ?? '-'} ${unidad || ''}`.trim(), pad + 12, row3Y + 16)
  doc.text(`${bodega || '-'} / ${ubicacion || '-'}`, pad + 200, row3Y + 16)

  // Estado/fecha
  const estadoY = cardY + 140
  doc.setTextColor('#2e7d32')
  doc.text('Entrada registrada correctamente', pad, estadoY)
  doc.setTextColor('#666')
  doc.text(
    `Fecha movimiento: ${new Date(fecha || Date.now()).toLocaleString()}`,
    pad,
    estadoY + 16
  )

  // QR
  if (qrDataUrl) {
    doc.setDrawColor('#59A1F7')
    doc.roundedRect(pad, estadoY + 28, 260, 260, 10, 10, 'S')
    doc.addImage(qrDataUrl, 'PNG', pad + 10, estadoY + 38, 240, 240)
  } else {
    doc.setTextColor('#999')
    doc.text('QR no disponible', pad, estadoY + 48)
  }

  return doc.output('blob') // <-- devuelve el Blob listo para guardar o zipear
}

// Helper para convertir una URL/DataURL a DataURL PNG
const toDataUrl = async src => {
  if (!src) return null
  if (src.startsWith('data:')) return src
  const blob = await fetch(src).then(r => r.blob())
  return await new Promise(resolve => {
    const fr = new FileReader()
    fr.onloadend = () => resolve(fr.result)
    fr.readAsDataURL(blob)
  })
}

// Generar ZIP con TODOS los PDFs bonitos
export const generarZIPPDFsBonito = async (
  respuestas,
  { productoNombre, productoUnidad, idLote }
) => {
  try {
    const JSZip = (await import(/* @vite-ignore */ 'jszip')).default
    const zip = new JSZip()
    let added = 0

    for (let i = 0; i < (respuestas || []).length; i++) {
      const r = respuestas[i]
      const lote = r?.lote || idLote || 'LOTE'
      const prodId = r?.producto
      const nombreProd = productoNombre ? productoNombre(prodId) : prodId
      const unidad = productoUnidad ? productoUnidad(prodId) : ''

      // si tienes bodega/ubicación en la respuesta, pásalos aquí
      const bodega =
        r?.historial?.id_bodega_destino || r?.codigo_qr?.id_bodega_actual || ''
      const ubicacion =
        r?.historial?.id_ubicacion_destino ||
        r?.codigo_qr?.id_ubicacion_actual ||
        ''

      const qrDataUrl = await toDataUrl(r?.qr_image)

      const blob = await generarPdfIngresoBonito({
        lote,
        producto: prodId,
        productoNombre: nombreProd,
        unidad,
        cantidad: r?.cantidad_ingresada,
        fecha: r?.fecha,
        bodega,
        ubicacion,
        qrDataUrl,
      })

      const safeProd = String(prodId || `PROD_${i + 1}`).replace(
        /[^a-z0-9_\-.]/gi,
        '_'
      )
      const safeLote = String(lote).replace(/[^a-z0-9_\-.]/gi, '_')
      const filename = `Ingreso_${safeLote}_${safeProd}_${i + 1}.pdf`
      zip.file(filename, blob)
      added++
    }

    if (!added) return

    const content = await zip.generateAsync({ type: 'blob' })
    const { saveAs } = await import(/* @vite-ignore */ 'file-saver')
    saveAs(content, `Ingresos_${idLote || 'lote'}.zip`)
  } catch (err) {
    console.error('ZIP PDF bonito error', err)
    alert('Para PDF ZIP instala: npm i jspdf jszip')
  }
}
