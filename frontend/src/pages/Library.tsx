import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type LibraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Save, Star } from 'lucide-react'

type DraftValue = {
  ratingInput: string
  status: LibraryItem['status']
}

const toRatingInput = (rating: number): string => (rating === 0 ? '' : String(rating))
const normalizeRating = (ratingInput: string): number => {
  if (!ratingInput.trim()) return 0
  const parsed = Number.parseInt(ratingInput, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.min(100, parsed))
}

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

const languageTag = (codeRaw: string | null | undefined): string | null => {
  const code = (codeRaw || '').toLowerCase()
  if (!code) return null
  const map: Record<string, string> = {
    en: '🇺🇸',
    ko: '🇰🇷',
    ja: '🇯🇵',
    zh: '🇨🇳',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹',
    pt: '🇵🇹',
    ru: '🇷🇺',
    hi: '🇮🇳',
  }
  if (map[code]) return map[code]
  return code.length <= 3 ? code.toUpperCase() : code.slice(0, 3).toUpperCase()
}

const languageName = (codeRaw: string): string => {
  const code = (codeRaw || '').trim().toLowerCase()
  const map: Record<string, string> = {
    en: 'English',
    ko: 'Korean',
    ja: 'Japanese',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    hi: 'Hindi',
  }
  return map[code] || code.toUpperCase()
}

const LIBRARY_FILTERS_STORAGE_KEY = 'library-filters-v1'

type StoredLibraryFilters = {
  type?: string
  status?: string
  year?: string
  minRating?: string
  tags?: string[]
  genres?: string[]
  ratingSort?: 'highest' | 'lowest'
  language?: string
}

const readStoredFilters = (): StoredLibraryFilters => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_FILTERS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as StoredLibraryFilters
  } catch {
    return {}
  }
}

export function LibraryPage() {
  const stored = readStoredFilters()
  const navigate = useNavigate()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState(stored.type || 'all')
  const [statusFilter, setStatusFilter] = useState(stored.status || 'all')
  const [yearFilter, setYearFilter] = useState(stored.year || '')
  const [minRatingFilter, setMinRatingFilter] = useState(stored.minRating || '')
  const [tagFilter, setTagFilter] = useState<string[]>(stored.tags || [])
  const [genreFilter, setGenreFilter] = useState<string[]>(stored.genres || [])
  const [languageFilter, setLanguageFilter] = useState(stored.language || 'any')
  const [ratingSort, setRatingSort] = useState<'highest' | 'lowest'>(stored.ratingSort || 'highest')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true)
      setPageError(null)
      try {
        const parsedYear = Number.parseInt(yearFilter, 10)
        const parsedMinRating = Number.parseInt(minRatingFilter, 10)
        const data = await api.getLibrary({
          type: typeFilter,
          status: statusFilter,
          year: Number.isNaN(parsedYear) ? null : parsedYear,
          tags: tagFilter,
          genres: genreFilter,
          minRating: Number.isNaN(parsedMinRating) ? 0 : Math.max(0, Math.min(100, parsedMinRating)),
          language: languageFilter === 'any' ? null : languageFilter,
        })
        const tags = await api.getUserTagNames()
        const genreSet = new Set<string>()
        for (const item of data) {
          for (const genre of (item.genres || [])) {
            if (genre) genreSet.add(genre)
          }
        }
        const genres = [...genreSet].sort((a, b) => a.localeCompare(b))
        const languageSet = new Set<string>()
        for (const item of data) {
          const lang = (item.language_code || '').trim()
          if (lang) languageSet.add(lang.toLowerCase())
        }
        const languages = [...languageSet].sort((a, b) => a.localeCompare(b))
        const sorted = [...data].sort((a, b) => (
          ratingSort === 'highest' ? b.rating - a.rating : a.rating - b.rating
        ))
        setItems(sorted)
        setAvailableTags(tags)
        setAvailableGenres(genres)
        setAvailableLanguages(languages)
      } catch (error: any) {
        setItems([])
        setPageError(error?.message || 'Failed to load library')
      } finally {
        setLoading(false)
      }
    }
    loadLibrary()
  }, [typeFilter, statusFilter, yearFilter, tagFilter, genreFilter, minRatingFilter, ratingSort, languageFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: StoredLibraryFilters = {
      type: typeFilter,
      status: statusFilter,
      year: yearFilter,
      minRating: minRatingFilter,
      tags: tagFilter,
      genres: genreFilter,
      ratingSort,
      language: languageFilter,
    }
    window.sessionStorage.setItem(LIBRARY_FILTERS_STORAGE_KEY, JSON.stringify(payload))
  }, [typeFilter, statusFilter, yearFilter, minRatingFilter, tagFilter, genreFilter, ratingSort, languageFilter])

  const getDraft = (item: LibraryItem): DraftValue =>
    drafts[String(item.id)] ?? {
      ratingInput: toRatingInput(item.rating),
      status: item.status,
    }

  const isDirty = (item: LibraryItem): boolean => {
    const draft = getDraft(item)
    return normalizeRating(draft.ratingInput) !== item.rating || draft.status !== item.status
  }

  const updateDraft = (itemId: string | number, patch: Partial<DraftValue>, fallbackStatus?: LibraryItem['status']) => {
    const key = String(itemId)
    setDrafts((prev) => {
      const current = prev[key] ?? { ratingInput: '', status: fallbackStatus ?? ('want_to_watch' as LibraryItem['status']) }
      return {
        ...prev,
        [key]: { ...current, ...patch },
      }
    })
  }

  const handleSaveItem = async (item: LibraryItem) => {
    const key = String(item.id)
    const draft = getDraft(item)
    const updates: Partial<LibraryItem> = {
      rating: normalizeRating(draft.ratingInput),
      status: draft.status,
    }
    if (!isDirty(item)) return

    setSavingIds((prev) => new Set(prev).add(key))
    try {
      await api.updateLibraryItem(item.id, updates)
      setItems((prev) => {
        const next = prev.map((row) => (row.id === item.id ? { ...row, ...updates } : row))
        return next.sort((a, b) => (
          ratingSort === 'highest' ? b.rating - a.rating : a.rating - b.rating
        ))
      })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setSaveToast({ type: 'success', message: `"${item.title}" saved` })
    } catch (error: any) {
      setSaveToast({ type: 'error', message: error?.message || 'Failed to save change' })
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      window.setTimeout(() => setSaveToast(null), 1800)
    }
  }

  const watchOptions = [
    { value: 'want_to_watch', label: 'Want to Watch' },
    { value: 'watching', label: 'Watching' },
    { value: 'watched', label: 'Watched' },
  ]
  const readOptions = [
    { value: 'want_to_read', label: 'Want to Read' },
    { value: 'reading', label: 'Reading' },
    { value: 'read', label: 'Read' },
  ]
  const commonOptions = [{ value: 'abandoned', label: 'Abandoned' }]

  const getStatusOptions = (type: string) => [
    ...(type === 'book' ? readOptions : watchOptions),
    ...commonOptions,
  ]

  // Determine available statuses for the main filter based on the current Type tab
  const filterStatusOptions = () => {
      if (typeFilter === 'book') return getStatusOptions('book');
      if (typeFilter === 'movie' || typeFilter === 'show') return getStatusOptions('movie');
      return [...getStatusOptions('movie'), ...getStatusOptions('book')];
  }

  const unsavedCount = items.reduce((count, item) => count + (isDirty(item) ? 1 : 0), 0)

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) => (
      prev.includes(tag)
        ? prev.filter((value) => value !== tag)
        : [...prev, tag]
    ))
  }

  const toggleGenreFilter = (genre: string) => {
    setGenreFilter((prev) => (
      prev.includes(genre)
        ? prev.filter((value) => value !== genre)
        : [...prev, genre]
    ))
  }

  const toggleFavorite = async (item: LibraryItem) => {
    if (!item.user_item_id) return
    const key = String(item.id)
    setFavoriteLoadingIds((prev) => new Set(prev).add(key))
    const nextFavorite = !item.isFavorite
    const currentTags = item.tags || []
    const nextTags = nextFavorite
      ? [...currentTags.filter((tag) => tag.toLowerCase() !== 'favorites'), 'favorites']
      : currentTags.filter((tag) => tag.toLowerCase() !== 'favorites')

    try {
      await api.setFavoriteTag(item.user_item_id, nextFavorite, currentTags)
      setItems((prev) => prev.map((row) => (
        row.id === item.id
          ? { ...row, isFavorite: nextFavorite, tags: nextTags }
          : row
      )))
      if (nextFavorite) {
        setSaveToast({ type: 'success', message: 'Added to favorites' })
        window.setTimeout(() => setSaveToast(null), 1500)
      }
    } catch (error: any) {
      setSaveToast({ type: 'error', message: error?.message || 'Failed to update favorite tag' })
      window.setTimeout(() => setSaveToast(null), 1800)
    } finally {
      setFavoriteLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      {saveToast && (
        <div
          className={`pointer-events-none fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg transition-opacity ${
            saveToast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {saveToast.message}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        
        <div className="flex flex-wrap items-center gap-2">
            {availableLanguages.length > 0 && (
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Language</SelectItem>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {languageName(lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {typeFilter === 'all' ? (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Watch</SelectLabel>
                          {watchOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Read</SelectLabel>
                          {readOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Other</SelectLabel>
                          {commonOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : (
                      filterStatusOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    )}
                </SelectContent>
            </Select>

            <Input
              type="text"
              inputMode="numeric"
              placeholder="Year"
              className="w-24"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />

            <Input
              type="text"
              inputMode="numeric"
              placeholder="Min rating"
              className="w-28"
              value={minRatingFilter}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                if (!digits) {
                  setMinRatingFilter('')
                  return
                }
                const normalized = Math.min(100, Number.parseInt(digits, 10))
                setMinRatingFilter(String(normalized))
              }}
            />
        </div>
        </div>

        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tags:</span>
            {availableTags.map((tag) => {
              const isActive = tagFilter.includes(tag)
              return (
                <Button
                  key={tag}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Button>
              )
            })}
            {tagFilter.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setTagFilter([])}>
                Clear tags
              </Button>
            )}
          </div>
        )}

        {availableGenres.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Genres:</span>
            {availableGenres.map((genre) => {
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
      </div>

      {pageError && (
        <div className="rounded-md bg-destructive/15 text-destructive px-3 py-2 text-sm">
          {pageError}
        </div>
      )}
      {unsavedCount > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {unsavedCount} unsaved {unsavedCount === 1 ? 'change' : 'changes'} in your library.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full sm:w-auto">
          <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="movie">Movies</TabsTrigger>
              <TabsTrigger value="show">TV Shows</TabsTrigger>
              <TabsTrigger value="book">Books</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={ratingSort} onValueChange={(value) => setRatingSort(value as 'highest' | 'lowest')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="highest">Highest Rating</SelectItem>
            <SelectItem value="lowest">Lowest Rating</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
          <div className="text-center py-12 rounded-lg border border-dashed">
            <h3 className="text-lg font-medium">Your library is empty</h3>
            <p className="text-muted-foreground">Go to Search to add some items.</p>
          </div>
      ) : (
        <div className="grid gap-4">
            {items.map(item => {
                const visibleGenres = (item.genres || []).slice(0, 4)
                const visibleTags = (item.tags || []).filter((tag) => tag.toLowerCase() !== 'favorites')
                const favoriteButtonLoading = favoriteLoadingIds.has(String(item.id))
                const showSaveButton = isDirty(item) || savingIds.has(String(item.id))
                return (
                <div
                  key={item.id}
                  className={`flex cursor-pointer gap-4 p-4 rounded-lg border border-l-4 ${spineColor[item.type] || 'border-l-timber-300'} bg-card text-card-foreground shadow-sm items-start transition-colors hover:bg-muted/50`}
                  onClick={() => navigate(`/library/${item.id}`)}
                >
                    <div 
                        className="h-24 w-16 bg-muted shrink-0 rounded overflow-hidden"
                    >
                        {item.poster && <img src={item.poster} alt={item.title} className="h-full w-full object-cover" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold truncate hover:underline">{item.title}</h3>
                                  {languageTag(item.language_code) && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                      {languageTag(item.language_code)}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {item.year} • {titleCase(item.type)}
                                  {visibleGenres.length > 0 ? ` • ${visibleGenres.join(', ')}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                            <Badge variant={
                                item.status === 'watched' || item.status === 'read' ? 'secondary' : 
                                item.status === 'watching' || item.status === 'reading' ? 'default' : 'outline'
                            }>
                                {item.status ? titleCase(item.status) : 'Unknown'}
                            </Badge>
                            </div>
                        </div>

                        {visibleTags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {visibleTags.slice(0, 4).map((tag) => (
                              <Badge key={`${item.id}-tag-${tag}`} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-4 items-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Rating:</label>
                                <Input 
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0-100"
                                    className="w-16 h-8" 
                                    value={getDraft(item).ratingInput}
                                    onFocus={(e) => {
                                      if (e.currentTarget.value === '0') {
                                        updateDraft(item.id, { ratingInput: '' })
                                      }
                                    }}
                                    onChange={(e) => {
                                      const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 3)
                                      const normalized = onlyDigits && Number.parseInt(onlyDigits, 10) > 100 ? '100' : onlyDigits
                                      updateDraft(item.id, { ratingInput: normalized }, item.status)
                                    }}
                                />
                                <span className="text-sm text-muted-foreground">/ 100</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Status:</label>
                                <Select 
                                    value={getDraft(item).status} 
                                    onValueChange={(val: any) => updateDraft(item.id, { status: val }, item.status)}
                                >
                                    <SelectTrigger className="h-8 w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getStatusOptions(item.type).map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isDirty(item) && (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                                Unsaved
                              </Badge>
                            )}
                        </div>
                    </div>

                    <div className="ml-auto flex shrink-0 flex-col items-end justify-between gap-2 self-stretch" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                        disabled={favoriteButtonLoading}
                        onClick={() => toggleFavorite(item)}
                      >
                        {favoriteButtonLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className={`h-4 w-4 ${item.isFavorite ? 'fill-current text-amber-500' : ''}`} />
                        )}
                      </Button>
                      {showSaveButton && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-24"
                          disabled={savingIds.has(String(item.id))}
                          onClick={() => handleSaveItem(item)}
                        >
                          {savingIds.has(String(item.id)) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="mr-1 h-4 w-4" />
                              Save
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                </div>
            )})}
        </div>
      )}
    </div>
  )
}
