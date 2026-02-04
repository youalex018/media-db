import { useState, useEffect } from 'react'
import { api, type LibraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Star } from 'lucide-react'

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true)
      const data = await api.getLibrary({ type: typeFilter, status: statusFilter })
      setItems(data)
      setLoading(false)
    }
    loadLibrary()
  }, [typeFilter, statusFilter])

  const handleUpdate = async (id: string | number, updates: Partial<LibraryItem>) => {
      // Optimistic update
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
      await api.updateLibraryItem(id, updates)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        
        <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="watched">Watched</SelectItem>
                    <SelectItem value="watching">Watching</SelectItem>
                    <SelectItem value="want_to_watch">Want to Watch</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="want_to_read">Want to Read</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

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
                <div key={item.id} className="flex gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm items-start">
                    <div className="h-24 w-16 bg-muted shrink-0 rounded overflow-hidden">
                        {item.poster && <img src={item.poster} alt={item.title} className="h-full w-full object-cover" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold truncate">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">{item.year} • {item.type}</p>
                            </div>
                            <Badge variant={
                                item.status === 'watched' || item.status === 'read' ? 'secondary' : 
                                item.status === 'watching' || item.status === 'reading' ? 'default' : 'outline'
                            }>
                                {item.status.replace(/_/g, ' ')}
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
                                        <SelectItem value="watched">Watched</SelectItem>
                                        <SelectItem value="watching">Watching</SelectItem>
                                        <SelectItem value="want_to_watch">Want to Watch</SelectItem>
                                        <SelectItem value="read">Read</SelectItem>
                                        <SelectItem value="reading">Reading</SelectItem>
                                        <SelectItem value="want_to_read">Want to Read</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
