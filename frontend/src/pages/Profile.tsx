import { useState, useEffect } from 'react'
import { api, supabase } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, User as UserIcon, Calendar, Database, Sparkles, Film, Tv, BookOpen, Sun, Moon } from 'lucide-react'
import CountUp from '@/components/reactbits/CountUp'

interface ProfileStats {
  types: Record<string, { count: number; rated_count: number; average_rating: number }>
  statuses: Record<string, number>
  top_genres: Array<{ name: string; count: number }>
  overall: {
    count: number
    rated_count: number
    average_rating: number
    highest_rating: number
    highest_rated: string
  }
}

export function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      let userData = null
      if (localStorage.getItem('sb-fake-session')) {
        userData = { email: 'dev@example.com', id: 'dev-user-123', created_at: new Date().toISOString() }
      } else {
        const { data } = await supabase.auth.getUser()
        userData = data.user
      }
      setUser(userData)

      if (userData) {
        try {
          const statsData = await api.getProfileStats()
          setStats(statsData)
        } catch (e) {
          console.error('Failed to load stats:', e)
        }

        try {
          const saved = await api.getSavedInsights()
          if (saved.insights) {
            setInsights(saved.insights)
            setInsightsUpdatedAt(saved.updated_at)
          }
        } catch (e) {
          console.error('Failed to load saved insights:', e)
        }
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleGenerateInsights = async () => {
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const text = await api.getInsights()
      setInsights(text)
      setInsightsUpdatedAt(new Date().toISOString())
    } catch (e: any) {
      setInsightsError(e?.message || 'Failed to generate insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return <div>Dev Mode - Please log in</div>

  const movieCount = stats?.types?.movie?.count || 0
  const showCount = stats?.types?.show?.count || 0
  const bookCount = stats?.types?.book?.count || 0
  const totalCount = stats?.overall?.count || 0

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
                <AvatarFallback className="text-2xl font-bold bg-timber-300/15 text-timber-300">
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
              <span className="text-muted-foreground">
                Joined: {new Date(user.created_at || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <div className="pt-4 flex items-center justify-between">
              <Badge variant="outline" className="font-mono">
                {localStorage.getItem('sb-fake-session') ? 'DEV MODE' : 'AUTHENTICATED'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="gap-2"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light' : 'Dark'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-timber-300/10 rounded-lg">
                <Database className="h-6 w-6 text-timber-300" />
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
                  <div className="text-3xl font-bold">
                    <CountUp to={totalCount} duration={1.5} />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">Average Rating</span>
                  <div className="text-3xl font-bold">
                    <CountUp to={Math.round(stats.overall?.average_rating || 0)} duration={1.5} />
                    <span className="text-base font-normal text-muted-foreground"> / 100</span>
                  </div>
                </div>

                {stats.overall?.highest_rated && (
                  <div className="col-span-full space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Highest Rated</span>
                    <div className="text-lg font-semibold">
                      {stats.overall.highest_rated}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({stats.overall.highest_rating}/100)
                      </span>
                    </div>
                  </div>
                )}

                <div className="col-span-full pt-4 space-y-3">
                  <h4 className="text-sm font-semibold mb-2">By Type</h4>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> Movies</span>
                      <span className="font-medium"><CountUp to={movieCount} duration={1.5} /></span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-timber-300 transition-all duration-1000" style={{ width: `${(movieCount / Math.max(totalCount, 1)) * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5"><Tv className="h-3.5 w-3.5" /> TV Shows</span>
                      <span className="font-medium"><CountUp to={showCount} duration={1.5} /></span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-leaf-500 transition-all duration-1000" style={{ width: `${(showCount / Math.max(totalCount, 1)) * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Books</span>
                      <span className="font-medium"><CountUp to={bookCount} duration={1.5} /></span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-timber-600 transition-all duration-1000" style={{ width: `${(bookCount / Math.max(totalCount, 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No stats available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Genres */}
      {stats && stats.top_genres && stats.top_genres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Genres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.top_genres.map((g) => (
                <Badge key={g.name} variant="secondary" className="text-sm px-3 py-1">
                  {g.name} <span className="ml-1.5 text-muted-foreground">({g.count})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-timber-300/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-timber-300" />
              </div>
              <div>
                <CardTitle>AI Taste Profile</CardTitle>
                <CardDescription>
                  {insightsUpdatedAt
                    ? `Last generated ${new Date(insightsUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Gemini-powered analysis of your media habits'}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsights}
              disabled={insightsLoading}
            >
              {insightsLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {insights ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analyzing your library...</span>
            </div>
          ) : insightsError ? (
            <p className="text-sm text-destructive">{insightsError}</p>
          ) : insights ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {insights.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Click Generate to get a personalized analysis of your media tastes and habits.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
