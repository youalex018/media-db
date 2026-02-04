import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function StatsPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)

  const handleCalculate = async () => {
    setLoading(true)
    try {
        const parsed = jsonInput ? JSON.parse(jsonInput) : {};
        const result = await api.getStats(parsed)
        setStats(result)
    } catch (e) {
        alert('Invalid JSON')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Ratings Stats</h1>
        <p className="text-muted-foreground">Paste your ratings JSON data here to calculate statistics.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Input Data</CardTitle>
            <CardDescription>Paste a JSON array of your ratings (optional, defaults to library data if empty)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Textarea 
                placeholder='[{"title": "Movie", "rating": 80, ...}]' 
                className="font-mono min-h-[200px]"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
            />
            <Button onClick={handleCalculate} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Calculate Stats
            </Button>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">{stats.average_rating}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">{stats.total_items}</div>
                </CardContent>
            </Card>
            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>By Type</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span>Movies</span>
                            <span className="font-bold">{stats.by_type.movie}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(stats.by_type.movie / stats.total_items) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between items-center mt-4">
                            <span>TV Shows</span>
                            <span className="font-bold">{stats.by_type.show}</span>
                        </div>
                         <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(stats.by_type.show / stats.total_items) * 100}%` }} />
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <span>Books</span>
                            <span className="font-bold">{stats.by_type.book}</span>
                        </div>
                         <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(stats.by_type.book / stats.total_items) * 100}%` }} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  )
}
