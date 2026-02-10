import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type LibraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

export function LibraryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true)
      setPageError(null)
      try {
        const data = await api.getLibrary({ type: typeFilter, status: statusFilter })
        setItems(data)
      } catch (error: any) {
        setItems([])
        setPageError(error?.message || 'Failed to load library')
      } finally {
        setLoading(false)
      }
    }
    loadLibrary()
  }, [typeFilter, statusFilter])

  const handleUpdate = async (id: string | number, updates: Partial<LibraryItem>) => {
      // Optimistic update
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
      try {
        await api.updateLibraryItem(id, updates)
        setSaveToast({ type: 'success', message: 'Library item saved' })
      } catch (error: any) {
        setSaveToast({ type: 'error', message: error?.message || 'Failed to save change' })
      } finally {
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

  return (
    <div className="space-y-6">
      {saveToast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${
            saveToast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {saveToast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        
        <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {typeFilter === 'all' ? (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Watch</div>
                        {watchOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                        <div className="my-1 h-px bg-muted" />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Read</div>
                        {readOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                        <div className="my-1 h-px bg-muted" />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other</div>
                        {commonOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </>
                    ) : (
                      filterStatusOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    )}
                </SelectContent>
            </Select>
        </div>
      </div>

      {pageError && (
        <div className="rounded-md bg-destructive/15 text-destructive px-3 py-2 text-sm">
          {pageError}
        </div>
      )}

      <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
        <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
            <TabsTrigger value="show">TV Shows</TabsTrigger>
            <TabsTrigger value="book">Books</TabsTrigger>
        </TabsList>
      </Tabs>

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
            {items.map(item => (
                <div key={item.id} className="flex gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm items-start transition-colors hover:bg-muted/50">
                    <div 
                        className="h-24 w-16 bg-muted shrink-0 rounded overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/library/${item.id}`)}
                    >
                        {item.poster && <img src={item.poster} alt={item.title} className="h-full w-full object-cover" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div className="cursor-pointer" onClick={() => navigate(`/library/${item.id}`)}>
                                <h3 className="font-semibold truncate hover:underline">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">{item.year} • {item.type}</p>
                            </div>
                            <Badge variant={
                                item.status === 'watched' || item.status === 'read' ? 'secondary' : 
                                item.status === 'watching' || item.status === 'reading' ? 'default' : 'outline'
                            }>
                                {item.status ? item.status.replace(/_/g, ' ') : 'unknown'}
                            </Badge>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Rating:</label>
                                <Input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    className="w-16 h-8" 
                                    value={item.rating}
                                    onChange={(e) => handleUpdate(item.id, { rating: parseInt(e.target.value) || 0 })}
                                />
                                <span className="text-sm text-muted-foreground">/ 100</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Status:</label>
                                <Select 
                                    value={item.status} 
                                    onValueChange={(val: any) => handleUpdate(item.id, { status: val })}
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
                            
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/library/${item.id}`)}>
                                Details
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
