import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { LandingPage } from './LandingPage'
import { ContextPage } from './context/pods'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path=":context">
            <Route index element={<Navigate to="pods" replace />} />
            <Route path="pods" element={<ContextPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
