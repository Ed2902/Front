import React from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { getHistorialConLote } from './analitica.service'

const ExportadorExcel = ({ mes, año }) => {
  const exportarExcel = async () => {
    try {
      const datos = await getHistorialConLote()

      const filtrados = datos.filter(d => {
        const fecha = new Date(d.Fecha_movimiento)
        const añoOk = fecha.getFullYear().toString() === año
        const mesOk = (fecha.getMonth() + 1).toString().padStart(2, '0') === mes
        return d.Movimiento_tipo === 'Entrada' && añoOk && mesOk
      })

      const hoja = filtrados.map(d => ({
        Fecha: new Date(d.Fecha_movimiento).toLocaleDateString('es-CO'),
        Producto: d.LoteProducto?.Producto?.Nombre || d.id_producto,
        Proveedor: d.LoteProducto?.id_proveedor || 'N/A',
        Cantidad: d.Cantidad,
        Bodega: d.id_bodega_destino || d.id_bodega_origen || '—',
        Comentario: d.Comentario,
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(hoja)
      XLSX.utils.book_append_sheet(wb, ws, 'Entradas')

      const nombreArchivo = `Entradas_${año}_${mes}.xlsx`
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], {
        type: 'application/octet-stream',
      })
      saveAs(blob, nombreArchivo)
    } catch (err) {
      console.error('Error exportando a Excel:', err)
    }
  }

  return (
    <div style={{ marginTop: '20px', textAlign: 'left' }}>
      <button className='btn-agregarform' onClick={exportarExcel}>
        Exportar Entradas a Excel
      </button>
    </div>
  )
}

export default ExportadorExcel
