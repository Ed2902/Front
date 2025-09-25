import './SeccionDinamicaFinanciera.css'

const SeccionDinamicaFinanciera = ({ selectedSection }) => {
  let contenido

  switch (selectedSection) {
    case 'financiera':
      contenido = <h2 style={{ color: '#F74C1B' }}>Hola Financiera</h2>
      break
    default:
      contenido = <h2>Seleccione una opción</h2>
  }

  return <div className='financiera-seccion'>{contenido}</div>
}

export default SeccionDinamicaFinanciera
