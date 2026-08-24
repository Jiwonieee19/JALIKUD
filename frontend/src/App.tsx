import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'

function AppContent() {
  const { user, loading } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
        Loading…
      </div>
    )
  }

  if (user) {
    return <HomePage />
  }

  return showRegister ? (
    <RegisterPage onSwitchToLogin={() => setShowRegister(false)} />
  ) : (
    <LoginPage onSwitchToRegister={() => setShowRegister(true)} />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
