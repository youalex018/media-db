import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/api'
import { Layout } from '@/components/Layout'
import { Loader2 } from 'lucide-react'

const AuthPage = lazy(() => import('@/pages/Auth').then(m => ({ default: m.AuthPage })))
const SearchPage = lazy(() => import('@/pages/Search').then(m => ({ default: m.SearchPage })))
const LibraryPage = lazy(() => import('@/pages/Library').then(m => ({ default: m.LibraryPage })))
const ProfilePage = lazy(() => import('@/pages/Profile').then(m => ({ default: m.ProfilePage })))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetail').then(m => ({ default: m.ItemDetailPage })))
const DiscoverPage = lazy(() => import('@/pages/Discover').then(m => ({ default: m.DiscoverPage })))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
                  <Route path="/library/:id" element={<ItemDetailPage />} />
                  <Route path="/discover" element={<DiscoverPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/search" replace />} />
              </Route>
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
