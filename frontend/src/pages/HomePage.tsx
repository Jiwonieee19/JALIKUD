import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <h1>Welcome, {user?.name}! 👋</h1>
        <p style={{ color: '#6b7280' }}>{user?.email}</p>
        <p>You are authenticated via a Laravel Sanctum API token.</p>
        <button
          onClick={() => void logout()}
          style={{
            marginTop: '1rem',
            padding: '0.6rem 1.5rem',
            borderRadius: 8,
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  )
}
