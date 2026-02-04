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
  
  const debouncedQuery = useDebounce(query, 500)

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

  const handleAdd = async (work: Work) => {
    await api.addToLibrary(work)
    setAddedIds(prev => new Set(prev).add(work.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search movies, shows, books..."
              className="pl-8"
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

      {loading && (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <Badge variant="secondary" className="shrink-0">{work.type}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">{work.year}</div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-1">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {work.overview}
              </p>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button 
                className="w-full" 
                variant={addedIds.has(work.id) ? "secondary" : "default"}
                onClick={() => handleAdd(work)}
                disabled={addedIds.has(work.id)}
              >
                {addedIds.has(work.id) ? (
                    <>
                        <Check className="mr-2 h-4 w-4" /> Added
                    </>
                ) : (
                    <>
                        <Plus className="mr-2 h-4 w-4" /> Add to Library
                    </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
