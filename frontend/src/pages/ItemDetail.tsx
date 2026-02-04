import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type LibraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, Loader2, Save } from 'lucide-react'

export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<LibraryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Local edit state
  const [rating, setRating] = useState(0)
  const [status, setStatus] = useState('')
  const [review, setReview] = useState('')

  useEffect(() => {
    async function loadItem() {
      if (!id) return
      setLoading(true)
      const data = await api.getLibraryItem(id)
      if (data) {
        setItem(data)
        setRating(data.rating)
        setStatus(data.status)
        setReview(data.review || '')
      }
      setLoading(false)
    }
    loadItem()
  }, [id])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    await api.updateLibraryItem(item.id, {
        rating,
        status: status as any,
        review
    })
    setSaving(false)
    navigate('/library')
  }

  if (loading) {
    return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  if (!item) {
    return (
        <div className="text-center py-12">
            <h3 className="text-lg font-medium">Item not found</h3>
            <Button variant="link" onClick={() => navigate('/library')}>Back to Library</Button>
        </div>
    )
  }

  const isBook = item.type === 'book'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" className="pl-0 gap-2" onClick={() => navigate('/library')}>
        <ChevronLeft className="h-4 w-4" /> Back to Library
      </Button>

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        <div className="space-y-4">
            <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-muted shadow-lg">
                {item.poster && <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />}
            </div>
        </div>

        <div className="space-y-6">
            <div>
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-4xl font-bold tracking-tight">{item.title}</h1>
                    <Badge variant="secondary" className="text-base px-3 py-1 capitalize">
                        {item.type}
                    </Badge>
                </div>
                <div className="text-xl text-muted-foreground mt-2">{item.year}</div>
            </div>

            <Card>
                <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-lg">Your Progress</h3>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {isBook ? (
                                        <>
                                            <SelectItem value="want_to_read">Want to Read</SelectItem>
                                            <SelectItem value="reading">Reading</SelectItem>
                                            <SelectItem value="read">Read</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="want_to_watch">Want to Watch</SelectItem>
                                            <SelectItem value="watching">Watching</SelectItem>
                                            <SelectItem value="watched">Watched</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rating (0-100)</label>
                            <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={rating} 
                                onChange={(e) => setRating(Number(e.target.value))} 
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <h3 className="text-xl font-semibold">Overview</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                    {item.overview}
                </p>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-semibold">Written Review</h3>
                <Textarea 
                    placeholder="Write your thoughts here..." 
                    className="min-h-[150px] text-base"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                />
            </div>

            <div className="pt-4 flex justify-end gap-4">
                <Button variant="outline" onClick={() => navigate('/library')}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
