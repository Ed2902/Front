// src/utils/pdfIngreso.js
import { jsPDF } from 'jspdf'

/**
 * Genera y descarga un PDF del ingreso con QR.
 * @param {Object} payload - Debe contener { qr_image, historial, inventario, codigo_qr }
 */
export function generarPdfIngreso(payload = {}) {
  const {
    qr_image,
    historial = {},
    inventario = {},
    codigo_qr = {},
  } = payload || {}

  const lote = codigo_qr?.id_lote || historial?.id_lote || '-'
  const producto = historial?.id_producto || codigo_qr?.id_producto || '-'
  const cantIngresada =
    historial?.Cantidad ?? codigo_qr?.cantidad_ingresada ?? '-'
  const cantTotal = inventario?.Cantidad ?? codigo_qr?.cantidad_total ?? '-'
  const bodega =
    historial?.id_bodega_destino ?? codigo_qr?.id_bodega_actual ?? '-'
  const ubicacion =
    historial?.id_ubicacion_destino ?? codigo_qr?.id_ubicacion_actual ?? '-'
  const operacion = historial?.operacion ?? codigo_qr?.operacion ?? '-'
  const fechaStr = new Date(
    historial?.Fecha_movimiento || codigo_qr?.fecha || Date.now()
  ).toLocaleString()

  // Colores corporativos
  const brandPrimary = '#F74C1B' // naranja
  const brandAccent = '#59A1F7' // azul
  const brandGreen = '#00BA59' // verde

  const doc = new jsPDF({ unit: 'pt', format: 'a4' }) // 595x842 pt aprox
  const marginX = 40
  let y = 54

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(brandPrimary)
  doc.text('Comprobante de Entrada', marginX, y)
  y += 8
  doc.setDrawColor(brandPrimary)
  doc.setLineWidth(1)
  doc.line(marginX, y, 555, y)
  y += 18

  // Meta
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#444444')
  doc.text(`Generado: ${new Date().toLocaleString()}`, marginX, y)
  y += 16

  // Tarjeta 1: Datos básicos
  const boxH = 96
  doc.setDrawColor('#DDDDDD')
  doc.setFillColor('#FAFAFA')
  doc.roundedRect(marginX, y, 555 - marginX, boxH, 8, 8, 'FD')

  // Labels
  doc.setTextColor('#666666')
  doc.setFontSize(10)
  let colX = marginX + 12
  let colY = y + 18
  doc.text('Operación', colX, colY)
  doc.text('Lote', colX + 170, colY)
  doc.text('Producto', colX + 340, colY)

  // Valores
  doc.setTextColor('#111111')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(String(operacion || '-'), colX, colY + 18)
  doc.text(String(lote || '-'), colX + 170, colY + 18)
  doc.text(String(producto || '-'), colX + 340, colY + 18)

  // Segunda línea
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#666666')
  doc.text('Cantidad Ingresada', colX, colY + 42)
  doc.text('Cantidad Total', colX + 170, colY + 42)
  doc.text('Bodega / Ubicación', colX + 340, colY + 42)

  doc.setTextColor('#111111')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(String(cantIngresada || '-'), colX, colY + 60)
  doc.text(String(cantTotal || '-'), colX + 170, colY + 60)
  doc.text(`${bodega} / ${ubicacion}`, colX + 340, colY + 60)

  y += boxH + 18

  // QR
  if (qr_image && qr_image.startsWith('data:image/')) {
    // marco de QR
    doc.setDrawColor(brandAccent)
    doc.setLineWidth(1)
    doc.roundedRect(marginX, y, 240, 240, 10, 10)
    // imagen
    try {
      // Detecta formato (png/jpg)
      const format = qr_image.substring(11, qr_image.indexOf(';')) || 'PNG'
      doc.addImage(
        qr_image,
        format.toUpperCase(),
        marginX + 10,
        y + 10,
        220,
        220
      )
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // Si falla addImage (dataURL inválido)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(11)
      doc.text('No se pudo renderizar el QR', marginX + 18, y + 28)
    }
  }

  // Estado y fecha a la derecha del QR
  const rightX = marginX + 260 + 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#666666')
  doc.text('Estado', rightX, y + 18)
  doc.text('Fecha movimiento', rightX, y + 44)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(brandGreen)
  doc.text('Entrada registrada correctamente', rightX, y + 18 + 16)

  doc.setTextColor('#111111')
  doc.text(fechaStr, rightX, y + 44 + 16)

  // Footer
  doc.setDrawColor('#EEEEEE')
  doc.setLineWidth(0.8)
  doc.line(marginX, 802, 555, 802)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#777777')
  doc.text('FASTWAY · Generado automáticamente', marginX, 820)

  const nombre = `Entrada_${lote}_${producto}_${Date.now()}.pdf`
  doc.save(nombre)
}
