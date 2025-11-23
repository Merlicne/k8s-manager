import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { LandingPage } from './LandingPage'
import { ResourcesPage } from './context/resources'
import { ResourceDetailsPage } from './context/ResourceDetailsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path=":context">
            <Route index element={<Navigate to="Pod" replace />} />
            <Route path=":resourceType" element={<ResourcesPage />} />
            <Route path=":resourceType/:name" element={<ResourceDetailsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
