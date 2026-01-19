import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create supabase client only if env vars are available
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

interface User {
  id: string
  email?: string
}

export default function AuthTest() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [backendResponse, setBackendResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Early return if env vars are missing
  if (!supabase) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#ffebee', border: '1px solid #f44336' }}>
        <h2>Configuration Error</h2>
        <p>Missing Supabase environment variables. Please check your <code>.env.local</code> file.</p>
        <p>Required variables:</p>
        <ul>
          <li>VITE_SUPABASE_URL: {supabaseUrl ? '✅ SET' : '❌ NOT SET'}</li>
          <li>VITE_SUPABASE_ANON_KEY: {supabaseAnonKey ? '✅ SET' : '❌ NOT SET'}</li>
        </ul>
      </div>
    )
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      })
      if (error) throw error
      alert('Check your email for the login link!')
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleSignOut = async () => {
    setError(null)
    setBackendResponse(null)
    try {
      await supabase.auth.signOut()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const testBackendAuth = async () => {
    setError(null)
    setBackendResponse(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token available')
      }

      const response = await fetch('http://localhost:5000/api/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`)
      }

      const data = await response.json()
      setBackendResponse(data)
    } catch (error: any) {
      setError(error.message)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Auth Test</h1>
      
      {!user ? (
        <form onSubmit={handleSignIn}>
          <h2>Sign In</h2>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '8px', width: '100%' }}
            />
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>
            Send Magic Link
          </button>
        </form>
      ) : (
        <div>
          <h2>Signed In</h2>
          <p><strong>User ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
          
          <div style={{ margin: '20px 0' }}>
            <button 
              onClick={testBackendAuth}
              style={{ padding: '8px 16px', marginRight: '10px' }}
            >
              Test Backend Auth
            </button>
            
            <button 
              onClick={handleSignOut}
              style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white' }}
            >
              Sign Out
            </button>
          </div>

          {backendResponse && (
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              <h3>Backend Response:</h3>
              <pre>{JSON.stringify(backendResponse, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginTop: '10px',
          color: '#721c24'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
