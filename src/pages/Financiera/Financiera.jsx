import { useState } from 'react'
import './Financiera.css'

import MenuFinanciera from '../../components/Financiera/MenuFinanciera/MenuFinanciera'
import SeccionDinamicaFinanciera from '../../components/Financiera/SeccionDinamicaFinanciera/SeccionDinamicaFinanciera'

const Financiera = () => {
  const [selectedSection, setSelectedSection] = useState('tabla-financiera')

  return (
    <div className='page'>
      <MenuFinanciera
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      <SeccionDinamicaFinanciera selectedSection={selectedSection} />
    </div>
  )
}

export default Financiera
