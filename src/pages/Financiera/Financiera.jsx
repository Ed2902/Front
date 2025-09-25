import Sidebar from '../../components/Sidebar/Sidebar'
import TablaFinanciera from '../../components/Financiera/TablaFinanciera/TablaFinanciera'
import './Financiera.css'

export default function Financiera() {
  // Handlers de carga de archivos (cuando definas endpoints)
  const onUploadCuenta = idLote => {
    // abrir modal/input, armar FormData y llamar al service upload...
    console.log('Cargar cuenta de cobro para', idLote)
  }

  const onUploadSoporte = idLote => {
    console.log('Cargar soporte de pago para', idLote)
  }

  return (
    <section className='layout'>
      <Sidebar />
      <div className='body'>
        <TablaFinanciera
          onUploadCuenta={onUploadCuenta}
          onUploadSoporte={onUploadSoporte}
        />
      </div>
    </section>
  )
}
