import { useState } from 'react'
import './Financiera.css'

import Sidebar from '../../components/Sidebar/Sidebar.jsx'
import MenuFinanciera from '../../components/Financiera/MenuFinanciera/MenuFinanciera'
import SeccionDinamicaFinanciera from '../../components/Financiera/SeccionDinamicaFinanciera/SeccionDinamicaFinanciera'

const Financiera = () => {
  const [selectedSection, setSelectedSection] = useState('tabla-financiera') // opcional: default

  return (
    <div className='layout'>
      <Sidebar />

      <div className='main-content'>
        <MenuFinanciera
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        <SeccionDinamicaFinanciera selectedSection={selectedSection} />
      </div>
    </div>
  )
}

export default Financiera
