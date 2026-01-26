// src/App.jsx
import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login/Login'
import PrivateRoute from './components/PrivateRoute'
import NoEncontrado from './pages/NoEncontrado'

import Home from './pages/Home/Home'
import GestionBodega from './pages/GestionBodega/GestionBodega'
import Operaciones from './pages/operaciones/operaciones'
import PerfilAdmin from './pages/perfilAdmin/PerfilAdmin'
import Terceros from './pages/Terceros/Terceros.jsx'
import ControlDeIngresos from './pages/ControlDeIngresos/ControlDeIngresos.jsx'
import Tickets from './pages/Tickets/TicketsPage.jsx'
import TiemposPc from './pages/TiemposPc/TiemposPc.jsx'
import Financiera from './pages/Financiera/Financiera.jsx'
import Personal from './pages/Personal/Personal.jsx'

import AppLayout from './layouts/AppLayout'

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

function AppRoutes() {
  const location = useLocation()

  return (
    <Routes>
      <Route path='/login' element={<Login />} />

      {/* 🔥 Layout general protegido */}
      <Route element={<PrivateRoute element={<AppLayout />} />}>
        <Route path='/home' element={<Home />} />

        <Route
          path='/gestion-bodega'
          element={
            <PrivateRoute permiso='gestionBodega' element={<GestionBodega />} />
          }
        />

        <Route
          path='/operaciones'
          element={
            <PrivateRoute permiso='operaciones' element={<Operaciones />} />
          }
        />

        <Route
          path='/perfil-admin'
          element={
            <PrivateRoute permiso='perfilAdmin' element={<PerfilAdmin />} />
          }
        />

        <Route
          path='/terceros'
          element={<PrivateRoute permiso='terceros' element={<Terceros />} />}
        />

        <Route
          path='/control-de-ingresos'
          element={
            <PrivateRoute
              permiso='gestioniingresos'
              element={<ControlDeIngresos />}
            />
          }
        />

        <Route
          path='/tickets'
          element={<PrivateRoute permiso='tickets' element={<Tickets />} />}
        />

        <Route
          path='/tiempos-pc'
          element={
            <PrivateRoute permiso='awTiemposEnPc' element={<TiemposPc />} />
          }
        />

        <Route
          path='/financiera'
          element={
            <PrivateRoute permiso='financiera' element={<Financiera />} />
          }
        />

        <Route
          path='/hojas-de-vida'
          element={
            <PrivateRoute
              permiso='hojasDeVidaPersonal'
              element={<Personal />}
            />
          }
        />
      </Route>

      <Route path='/' element={<Navigate to='/login' />} />
      <Route path='/404' element={<NoEncontrado />} />
      <Route
        path='*'
        element={<Navigate to='/404' state={{ from: location.pathname }} />}
      />
    </Routes>
  )
}

export default App
