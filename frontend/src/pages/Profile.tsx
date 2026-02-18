import { useState, useEffect } from 'react'
import { api, supabase } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, User as UserIcon, Calendar, Database } from 'lucide-react'

export function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      
      // 1. Get User
      let userData = null;
      if (localStorage.getItem('sb-fake-session')) {
          userData = { email: 'dev@example.com', id: 'dev-user-123', created_at: new Date().toISOString() }
      } else {
          const { data } = await supabase.auth.getUser()
          userData = data.user
      }
      setUser(userData)

      // 2. Get Stats
      if (userData) {
          try {
            const statsData = await api.getStats({})
            const library = await api.getLibrary()
            const rated = library.filter((item: any) => typeof item.rating === 'number' && item.rating > 0)
            const avg = rated.length > 0
              ? Math.round(rated.reduce((sum: number, item: any) => sum + item.rating, 0) / rated.length)
              : 0
            setStats({
              ...statsData,
              average_rating: avg,
            })
          } catch (e) {
            console.error(e)
            // Fallback: derive basic stats from library if ratings endpoint is unavailable.
            try {
              const library = await api.getLibrary()
              const rated = library.filter((item: any) => typeof item.rating === 'number' && item.rating > 0)
              const total = library.length
              const avg = rated.length > 0
                ? Math.round(rated.reduce((sum: number, item: any) => sum + item.rating, 0) / rated.length)
                : 0
              setStats({
                average_rating: avg,
                total_items: total,
                by_type: {
                  movie: library.filter((item: any) => item.type === 'movie').length,
                  show: library.filter((item: any) => item.type === 'show').length,
                  book: library.filter((item: any) => item.type === 'book').length,
                },
              })
            } catch (fallbackError) {
              console.error(fallbackError)
            }
          }
      }

      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
      return (
          <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
      )
  }

  if (!user) return <div>Dev Mode - Please log in</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Profile</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* User Card */}
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
<Avatar className="h-16 w-16">
    <AvatarImage src="" />
    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
        {user.email?.[0].toUpperCase()}
    </AvatarFallback>
</Avatar>
                    <div>
                        <CardTitle className="text-xl">User Account</CardTitle>
                        <CardDescription>Personal details</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
                </div>
                 <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Joined: {new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
                
                <div className="pt-4">
                    <Badge variant="outline" className="font-mono">
                        {localStorage.getItem('sb-fake-session') ? 'DEV MODE' : 'AUTHENTICATED'}
                    </Badge>
                </div>
            </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-secondary rounded-lg">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Library Statistics</CardTitle>
                        <CardDescription>Your collection overview</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {stats ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Total Items</span>
                            <div className="text-3xl font-bold">{stats.total_items}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Average Rating</span>
                            <div className="text-3xl font-bold">{stats.average_rating} <span className="text-base font-normal text-muted-foreground">/ 100</span></div>
                        </div>
                        
                        <div className="col-span-full pt-4 space-y-3">
                            <h4 className="text-sm font-semibold mb-2">Breakdown</h4>
                            
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>Movies</span>
                                    <span className="font-medium">{stats.by_type.movie}</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(stats.by_type.movie / Math.max(stats.total_items, 1)) * 100}%` }} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>TV Shows</span>
                                    <span className="font-medium">{stats.by_type.show}</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500" style={{ width: `${(stats.by_type.show / Math.max(stats.total_items, 1)) * 100}%` }} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>Books</span>
                                    <span className="font-medium">{stats.by_type.book}</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: `${(stats.by_type.book / Math.max(stats.total_items, 1)) * 100}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>No stats available</div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
