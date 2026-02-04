import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/api'
import { Layout } from '@/components/Layout'
import { AuthPage } from '@/pages/Auth'
import { SearchPage } from '@/pages/Search'
import { LibraryPage } from '@/pages/Library'
import { StatsPage } from '@/pages/Stats'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for fake dev session
    if (localStorage.getItem('sb-fake-session')) {
        setSession({ user: { email: 'dev@example.com' } } as any)
        setLoading(false)
        return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
            <>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
        ) : (
            <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/search" replace />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/profile" element={<div className="p-8">Profile Placeholder</div>} />
                <Route path="*" element={<Navigate to="/search" replace />} />
            </Route>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
