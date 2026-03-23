import { useState, useEffect } from 'react'
import { api, supabase } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, User as UserIcon, Calendar, Database, Sparkles, Film, Tv, BookOpen, Sun, Moon, Globe, Link as LinkIcon, Check, Eye, EyeOff } from 'lucide-react'
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
  const [insights, setInsights] = useState<{ mood: string | null; mood_description: string | null; insights: string } | null>(null)
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  // Profile settings state
  const [profileUsername, setProfileUsername] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [showAvatar, setShowAvatar] = useState(true)
  const [showRatings, setShowRatings] = useState(true)
  const [showReviews, setShowReviews] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileToast, setProfileToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [usernameEditing, setUsernameEditing] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [usernameCopied, setUsernameCopied] = useState(false)

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
          if (saved.insights != null) {
            setInsights({ mood: saved.mood, mood_description: saved.mood_description, insights: saved.insights })
            setInsightsUpdatedAt(saved.updated_at)
          }
        } catch (e) {
          console.error('Failed to load saved insights:', e)
        }

        try {
          const profile = await api.getMyProfile()
          if (profile) {
            setProfileUsername(profile.username || '')
            setUsernameInput(profile.username || '')
            setIsPublic(profile.is_public)
            setShowAvatar(profile.show_avatar)
            setShowRatings(profile.show_ratings)
            setShowReviews(profile.show_reviews)
          }
        } catch (e) {
          console.error('Failed to load profile settings:', e)
        }
        setProfileLoading(false)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleGenerateInsights = async () => {
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const { mood, mood_description, insights: text } = await api.getInsights()
      setInsights({ mood, mood_description, insights: text })
      setInsightsUpdatedAt(new Date().toISOString())
    } catch (e: any) {
      setInsightsError(e?.message || 'Failed to generate insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  const renderWithHighlights = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g)
    return parts.map((p, i) =>
      p.startsWith('*') && p.endsWith('*') ? (
        <mark key={i} className="bg-amber-200/70 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 px-1 rounded font-medium">
          {p.slice(1, -1)}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      )
    )
  }

  const handleTogglePublic = async () => {
    setProfileSaving(true)
    try {
      await api.updateProfile({ is_public: !isPublic })
      setIsPublic(!isPublic)
      setProfileToast({ type: 'success', message: !isPublic ? 'Profile is now public' : 'Profile is now private' })
    } catch (e: any) {
      setProfileToast({ type: 'error', message: e?.message || 'Failed to update' })
    } finally {
      setProfileSaving(false)
      setTimeout(() => setProfileToast(null), 2000)
    }
  }

  const handleToggleField = async (field: 'show_avatar' | 'show_ratings' | 'show_reviews', current: boolean) => {
    setProfileSaving(true)
    try {
      await api.updateProfile({ [field]: !current })
      if (field === 'show_avatar') setShowAvatar(!current)
      else if (field === 'show_ratings') setShowRatings(!current)
      else if (field === 'show_reviews') setShowReviews(!current)
      setProfileToast({ type: 'success', message: 'Visibility updated' })
    } catch (e: any) {
      setProfileToast({ type: 'error', message: e?.message || 'Failed to update' })
    } finally {
      setProfileSaving(false)
      setTimeout(() => setProfileToast(null), 2000)
    }
  }

  const handleSaveUsername = async () => {
    if (!usernameInput.trim() || usernameInput === profileUsername) {
      setUsernameEditing(false)
      return
    }
    setProfileSaving(true)
    try {
      await api.updateProfile({ username: usernameInput.trim() })
      setProfileUsername(usernameInput.trim())
      setUsernameEditing(false)
      setProfileToast({ type: 'success', message: 'Username updated' })
    } catch (e: any) {
      setProfileToast({ type: 'error', message: e?.message || 'Failed to update username' })
    } finally {
      setProfileSaving(false)
      setTimeout(() => setProfileToast(null), 2000)
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/u/${profileUsername}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
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

      {/* Public Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-timber-300/10 rounded-lg">
              <Globe className="h-6 w-6 text-timber-300" />
            </div>
            <div>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>Control how others see your library</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {profileToast && (
            <div className={`rounded-md px-3 py-2 text-sm ${
              profileToast.type === 'success'
                ? 'bg-emerald-600/15 text-emerald-500'
                : 'bg-destructive/15 text-destructive'
            }`}>
              {profileToast.message}
            </div>
          )}

          {/* Username */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Username</Label>
            {usernameEditing ? (
              <div className="flex gap-2">
                <Input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
                  placeholder="your_username"
                  className="max-w-xs"
                />
                <Button size="sm" onClick={handleSaveUsername} disabled={profileSaving}>
                  {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setUsernameEditing(false); setUsernameInput(profileUsername) }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{profileUsername || 'Not set'}</span>
                {profileUsername && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {
                    navigator.clipboard.writeText(profileUsername)
                    setUsernameCopied(true)
                    setTimeout(() => setUsernameCopied(false), 2000)
                  }}>
                    {usernameCopied ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied</> : <><LinkIcon className="h-3.5 w-3.5 mr-1" /> Copy</>}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setUsernameEditing(true)}>
                  Edit
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only.</p>
          </div>

          {/* Public Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Public Library</p>
              <p className="text-xs text-muted-foreground">Allow others to search for and view your library</p>
            </div>
            <Button
              variant={isPublic ? 'default' : 'outline'}
              size="sm"
              onClick={handleTogglePublic}
              disabled={profileSaving || profileLoading}
              className="min-w-[80px]"
            >
              {isPublic ? (
                <><Eye className="mr-1.5 h-3.5 w-3.5" /> Public</>
              ) : (
                <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Private</>
              )}
            </Button>
          </div>

          {isPublic && (
            <>
              {/* Field visibility toggles */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Visibility Controls</Label>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Avatar</p>
                    <p className="text-xs text-muted-foreground">Show your avatar on your public profile</p>
                  </div>
                  <Button
                    variant={showAvatar ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleField('show_avatar', showAvatar)}
                    disabled={profileSaving}
                  >
                    {showAvatar ? <><Eye className="mr-1.5 h-3.5 w-3.5" /> Shown</> : <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hidden</>}
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Ratings</p>
                    <p className="text-xs text-muted-foreground">Show your ratings on public library items</p>
                  </div>
                  <Button
                    variant={showRatings ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleField('show_ratings', showRatings)}
                    disabled={profileSaving}
                  >
                    {showRatings ? <><Eye className="mr-1.5 h-3.5 w-3.5" /> Shown</> : <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hidden</>}
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Reviews</p>
                    <p className="text-xs text-muted-foreground">Show your written reviews on public library items</p>
                  </div>
                  <Button
                    variant={showReviews ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleField('show_reviews', showReviews)}
                    disabled={profileSaving}
                  >
                    {showReviews ? <><Eye className="mr-1.5 h-3.5 w-3.5" /> Shown</> : <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hidden</>}
                  </Button>
                </div>
              </div>

              {/* Copy Profile Link */}
              {profileUsername && (
                <div className="flex items-center gap-3 pt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[300px]">
                    {window.location.origin}/u/{profileUsername}
                  </code>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopyLink}>
                    {linkCopied ? (
                      <><Check className="h-3.5 w-3.5" /> Copied</>
                    ) : (
                      <><LinkIcon className="h-3.5 w-3.5" /> Copy Link</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
              {insights?.insights ? 'Regenerate' : 'Generate'}
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
            <div className="space-y-5">
              {insights.mood && (
                <div className="rounded-lg bg-timber-300/8 border border-timber-300/20 px-5 py-4 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-timber-300/70">Your media taste</p>
                  <p className="text-2xl font-bold tracking-tight text-timber-300">{insights.mood}</p>
                  {insights.mood_description && (
                    <p className="text-sm italic text-muted-foreground leading-snug">{insights.mood_description}</p>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {insights.insights.split('\n\n').filter(Boolean).map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {renderWithHighlights(paragraph)}
                  </p>
                ))}
              </div>
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
