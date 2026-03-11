import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, supabase, type PublicLibraryItem, type PublicLibraryResponse } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowLeft, Plus, Check, Globe, Star, ChevronDown, ChevronUp } from 'lucide-react'

const titleCase = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')

const spineColor: Record<string, string> = {
  movie: 'border-l-timber-300',
  show: 'border-l-leaf-500',
  book: 'border-l-timber-600',
}

export function PublicLibraryPage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<PublicLibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [genreFilter, setGenreFilter] = useState<string[]>([])
  const [ratingSort, setRatingSort] = useState<'highest' | 'lowest'>('highest')
  const [clonedKeys, setClonedKeys] = useState<Set<string>>(new Set())
  const [cloningKeys, setCloningKeys] = useState<Set<string>>(new Set())
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [ownLibraryMap, setOwnLibraryMap] = useState<Map<string, { status: string }>>(new Map())
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      if (session) {
        api.getLibrarySourceMap().then(setOwnLibraryMap).catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    if (!username) return
    setLoading(true)
    setNotFound(false)
    api
      .getPublicLibrary(username)
      .then((result) => {
        if (!result) {
          setNotFound(true)
        } else {
          setData(result)
        }
      })
      .catch((err: { status?: number; response?: { status?: number } }) => {
        const status = err?.response?.status ?? err?.status
        if (status === 404) {
          setNotFound(true)
        } else {
          setToast({ type: 'error', message: 'Failed to load library' })
        }
      })
      .finally(() => setLoading(false))
  }, [username])

  const handleClone = async (item: PublicLibraryItem) => {
    if (!item.source_key) return
    setCloningKeys((prev) => new Set(prev).add(item.source_key!))
    try {
      let provider: 'tmdb' | 'openlibrary'
      let external_id: string
      let source_type: string | undefined
      if (item.tmdb_id != null) {
        provider = 'tmdb'
        external_id = String(item.tmdb_id)
        source_type = item.type === 'show' ? 'tv' : item.type
      } else if (item.openlibrary_id) {
        provider = 'openlibrary'
        external_id = item.openlibrary_id
      } else {
        return
      }
      await api.addToLibrary({
        id: item.work_id,
        title: item.title,
        year: item.year,
        type: item.type as any,
        poster: item.poster_url || '',
        overview: item.overview || '',
        source: { provider, external_id, source_type },
      })
      setClonedKeys((prev) => new Set(prev).add(item.source_key!))
      setOwnLibraryMap((prev) => {
        const next = new Map(prev)
        next.set(item.source_key!, { status: item.type === 'book' ? 'Want to Read' : 'Want to Watch' })
        return next
      })
      setToast({ type: 'success', message: `"${item.title}" added to your shelf` })
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to add item' })
    } finally {
      setCloningKeys((prev) => {
        const next = new Set(prev)
        next.delete(item.source_key!)
        return next
      })
      setTimeout(() => setToast(null), 2000)
    }
  }

  const toggleExpand = (workId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(workId)) next.delete(workId)
      else next.add(workId)
      return next
    })
  }

  const toggleGenreFilter = (genre: string) => {
    setGenreFilter((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="text-center py-20 space-y-4">
        <Globe className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Profile Not Found</h2>
        <p className="text-muted-foreground">
          This user doesn't exist or their profile is private.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    )
  }

  const { profile, items } = data
  const showRatings = profile.show_ratings !== false
  const showReviews = profile.show_reviews !== false

  const allGenres = [...new Set(items.flatMap((item) => item.genres || []))].sort()

  let filtered = items
  if (typeFilter !== 'all') {
    filtered = filtered.filter((item) => item.type === typeFilter)
  }
  if (genreFilter.length > 0) {
    filtered = filtered.filter((item) =>
      genreFilter.every((g) => (item.genres || []).includes(g))
    )
  }
  if (showRatings) {
    filtered = [...filtered].sort((a, b) =>
      ratingSort === 'highest'
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : (a.rating ?? 0) - (b.rating ?? 0)
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
      {toast && (
        <div
          className={`pointer-events-none fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Banner */}
      <div className="flex items-center gap-4 rounded-lg border bg-card/50 p-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile.avatar_url || ''} />
          <AvatarFallback className="text-lg font-bold bg-timber-300/15 text-timber-300">
            {profile.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {profile.username}'s Library
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.count} {data.count === 1 ? 'item' : 'items'} in collection
          </p>
        </div>
        {isAuthenticated && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/library">
              <ArrowLeft className="mr-2 h-4 w-4" /> My Library
            </Link>
          </Button>
        )}
      </div>

      {/* Genre filter pills */}
      {allGenres.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Genres:</span>
          {allGenres.map((genre) => {
            const isActive = genreFilter.includes(genre)
            return (
              <Button
                key={genre}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => toggleGenreFilter(genre)}
              >
                {genre}
              </Button>
            )
          })}
          {genreFilter.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setGenreFilter([])}>
              Clear genres
            </Button>
          )}
        </div>
      )}

      {/* Type tabs + sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
            <TabsTrigger value="show">TV Shows</TabsTrigger>
            <TabsTrigger value="book">Books</TabsTrigger>
          </TabsList>
        </Tabs>
        {showRatings && (
          <Select value={ratingSort} onValueChange={(v) => setRatingSort(v as 'highest' | 'lowest')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="highest">Highest Rating</SelectItem>
              <SelectItem value="lowest">Lowest Rating</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <h3 className="text-lg font-medium">No items to show</h3>
          <p className="text-muted-foreground">
            {typeFilter !== 'all' || genreFilter.length > 0 ? 'Try a different filter.' : 'This library is empty.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => {
            const visibleGenres = (item.genres || []).slice(0, 4)
            const alreadyInLibrary = item.source_key ? ownLibraryMap.has(item.source_key) : false
            const justCloned = item.source_key ? clonedKeys.has(item.source_key) : false
            const isCloning = item.source_key ? cloningKeys.has(item.source_key) : false
            const ownEntry = item.source_key ? ownLibraryMap.get(item.source_key) : undefined
            const isExpanded = expandedItems.has(item.work_id)
            const hasReview = showReviews && item.review
            const canNavigateToOwn = isAuthenticated && alreadyInLibrary
            const isClickable = canNavigateToOwn || hasReview

            const handleCardClick = () => {
              if (canNavigateToOwn) {
                navigate(`/library/${item.work_id}`)
              } else if (hasReview) {
                toggleExpand(item.work_id)
              }
            }

            return (
              <div
                key={item.work_id}
                className={`rounded-lg border border-l-4 ${spineColor[item.type] || 'border-l-timber-300'} bg-card text-card-foreground shadow-sm ${
                  isClickable ? 'cursor-pointer transition-colors hover:bg-muted/50' : ''
                }`}
                onClick={isClickable ? handleCardClick : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() } : undefined}
              >
                <div className="flex gap-4 p-4 items-start">
                  <div className="h-24 w-16 bg-muted shrink-0 rounded overflow-hidden">
                    {item.poster_url && (
                      <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold truncate ${isClickable ? 'hover:underline' : ''}`}>{item.title}</h3>
                        {item.is_favorite && (
                          <Star className="h-4 w-4 shrink-0 fill-current text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.year} &bull; {titleCase(item.type)}
                        {visibleGenres.length > 0 ? ` \u2022 ${visibleGenres.join(', ')}` : ''}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {showRatings && item.rating != null && (
                        <span className="text-sm font-medium">
                          {item.rating > 0 ? (
                            <>{item.rating}<span className="text-muted-foreground font-normal"> / 100</span></>
                          ) : (
                            <span className="text-muted-foreground font-normal">— Unrated</span>
                          )}
                        </span>
                      )}
                      {showReviews && item.review && !isExpanded && (
                        <p className="text-sm text-muted-foreground line-clamp-1 max-w-md italic">
                          "{item.review}"
                        </p>
                      )}
                      {hasReview && (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.work_id) }}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {isExpanded ? 'Less' : 'Review'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                    <Badge
                      variant={
                        item.status === 'watched' || item.status === 'read' ? 'secondary'
                        : item.status === 'watching' || item.status === 'reading' ? 'default'
                        : 'outline'
                      }
                      title={`${profile.username}'s status`}
                    >
                      {titleCase(item.status)}
                    </Badge>
                    {ownEntry && (
                      <Badge variant="outline" className="border-timber-300/40 text-timber-300" title="Your status">
                        You: {titleCase(ownEntry.status)}
                      </Badge>
                    )}
                  </div>

                  {isAuthenticated && item.source_key && (
                    <div className="ml-auto shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                      {alreadyInLibrary || justCloned ? (
                        <Button variant="ghost" size="sm" disabled className="gap-1.5 text-emerald-500">
                          <Check className="h-4 w-4" /> In Library
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={isCloning}
                          onClick={() => handleClone(item)}
                        >
                          {isCloning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Add to Shelf
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded review */}
                {isExpanded && showReviews && item.review && (
                  <div className="border-t px-4 py-3 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {profile.username}'s Review
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {item.review}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
