import { useState, useEffect } from 'react'
import { api, type Work, type WorkType } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search as SearchIcon, Plus, Check, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<WorkType>('all')
  const [results, setResults] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string | number>>(new Set())
  const [existingSourceKeys, setExistingSourceKeys] = useState<Set<string>>(new Set())
  
  const debouncedQuery = useDebounce(query, 500)

  useEffect(() => {
    async function loadExistingLibrarySources() {
      try {
        const keys = await api.getLibrarySourceKeys()
        setExistingSourceKeys(keys)
      } catch (e) {
        console.error(e)
      }
    }
    loadExistingLibrarySources()
  }, [])

  useEffect(() => {
    async function doSearch() {
      if (!debouncedQuery) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const data = await api.search(debouncedQuery, type)
        setResults(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    doSearch()
  }, [debouncedQuery, type])

  const [addError, setAddError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | number | null>(null)
  const isHero = !query.trim() && results.length === 0 && !loading

  const getSourceKey = (work: Work): string | null => {
    const provider = work.source?.provider
    const externalId = work.source?.external_id
    if (!provider || !externalId) return null
    return `${provider}:${externalId}`
  }

  const handleAdd = async (work: Work) => {
    const sourceKey = getSourceKey(work)
    if (sourceKey && existingSourceKeys.has(sourceKey)) {
      return
    }
    setAddError(null)
    setAddingId(work.id)
    try {
        await api.addToLibrary(work)
        setAddedIds(prev => new Set(prev).add(work.id))
        if (sourceKey) {
          setExistingSourceKeys((prev) => new Set(prev).add(sourceKey))
        }
    } catch (e: any) {
        console.error('Failed to add to library:', e)
        setAddError(e.message || 'Failed to add item')
    } finally {
        setAddingId(null)
    }
  }

  const formatTypeLabel = (value: WorkType) =>
    value === 'show' ? 'Show' : value.charAt(0).toUpperCase() + value.slice(1)

  return (
    <div className="space-y-6">
      <div
        className={`transition-all duration-500 ease-out ${
          isHero
            ? 'min-h-[58vh] flex items-center justify-center'
            : 'min-h-0'
        }`}
      >
        <div className={`flex flex-col gap-4 w-full ${isHero ? 'max-w-2xl' : ''}`}>
          <h1 className={`font-bold tracking-tight transition-all duration-500 ${isHero ? 'text-5xl text-center' : 'text-3xl'}`}>
            Search
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search movies, shows, books..."
                className={`pl-8 transition-all duration-500 ${isHero ? 'h-12 text-base' : ''}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            
            <Tabs value={type} onValueChange={(v) => setType(v as WorkType)} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="movie">Movies</TabsTrigger>
                <TabsTrigger value="show">TV</TabsTrigger>
                <TabsTrigger value="book">Books</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {addError && (
        <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm">
            {addError}
        </div>
      )}

      {!loading && results.length === 0 && debouncedQuery && (
        <div className="text-center py-12 text-muted-foreground">
          No results found for "{debouncedQuery}"
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {results.map((work) => (
          <Card key={work.id} className="overflow-hidden flex flex-col">
            <div className="aspect-[2/3] relative bg-muted">
                {work.poster && <img src={work.poster} alt={work.title} className="object-cover w-full h-full" />}
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-lg leading-tight">{work.title}</CardTitle>
                <Badge variant="secondary" className="shrink-0">{formatTypeLabel(work.type)}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {work.year}
                {work.genres && work.genres.length > 0 ? ` • ${work.genres.slice(0, 2).join(', ')}` : ''}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {work.overview}
              </p>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              {(() => {
                const sourceKey = getSourceKey(work)
                const alreadyInLibrary = Boolean(sourceKey && existingSourceKeys.has(sourceKey))
                const justAdded = addedIds.has(work.id)
                const isDisabled = alreadyInLibrary || justAdded || addingId === work.id
                return (
              <Button 
                className="w-full" 
                variant={alreadyInLibrary || justAdded ? "secondary" : "default"}
                onClick={() => handleAdd(work)}
                disabled={isDisabled}
              >
                {addingId === work.id ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                    </>
                ) : alreadyInLibrary || justAdded ? (
                    <>
                        <Check className="mr-2 h-4 w-4" /> In Library
                    </>
                ) : (
                    <>
                        <Plus className="mr-2 h-4 w-4" /> Add to Library
                    </>
                )}
              </Button>
                )
              })()}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
