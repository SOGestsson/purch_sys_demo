import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import ItemsPage from './pages/ItemsPage.jsx'
import ItemDetail from './pages/ItemDetail.jsx'
import NoisPage from './pages/NoisPage.jsx'
import ItemCatalog from './pages/ItemCatalog.jsx'

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="catalog" element={<ItemCatalog />} />
          <Route path="items" element={<Items />} />
          <Route path="items/:id" element={<ItemDetail />} />
          <Route path="stock" element={<ItemsPage />} />
          <Route path="noi" element={<NoisPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App