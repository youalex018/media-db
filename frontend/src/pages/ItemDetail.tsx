import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type LibraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, Loader2, Save, Star, Trash2 } from 'lucide-react'

export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<LibraryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Local edit state
  const [ratingInput, setRatingInput] = useState('')
  const [status, setStatus] = useState('')
  const [review, setReview] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    async function loadItem() {
      if (!id) return
      setLoading(true)
      const data = await api.getLibraryItem(id)
      if (data) {
        setItem(data)
        setRatingInput(data.rating === 0 ? '' : String(data.rating))
        setStatus(data.status)
        setReview(data.review || '')
        setIsFavorite(Boolean(data.isFavorite))
      }
      setLoading(false)
    }
    loadItem()
  }, [id])

  const handleSave = async () => {
    if (!item) return
    const normalizedRating = (() => {
      if (!ratingInput.trim()) return 0
      const parsed = Number.parseInt(ratingInput, 10)
      if (Number.isNaN(parsed)) return 0
      return Math.max(0, Math.min(100, parsed))
    })()
    setSaving(true)
    try {
      await api.updateLibraryItem(item.id, {
          rating: normalizedRating,
          status: status as any,
          review
      })
      setSaveToast({ type: 'success', message: 'Library item saved' })
      window.setTimeout(() => navigate('/library'), 900)
    } catch (error: any) {
      setSaveToast({ type: 'error', message: error?.message || 'Failed to save changes' })
      window.setTimeout(() => setSaveToast(null), 1800)
    } finally {
      setSaving(false)
    }
  }

  const handleFavoriteToggle = async () => {
    if (!item?.user_item_id) return
    const nextFavorite = !isFavorite
    const currentTags = item.tags || []
    const nextTags = nextFavorite
      ? [...currentTags.filter((tag) => tag.toLowerCase() !== 'favorites'), 'favorites']
      : currentTags.filter((tag) => tag.toLowerCase() !== 'favorites')
    setSaving(true)
    try {
      await api.setFavoriteTag(item.user_item_id, nextFavorite, currentTags)
      setIsFavorite(nextFavorite)
      setItem({ ...item, isFavorite: nextFavorite, tags: nextTags })
      if (nextFavorite) {
        setSaveToast({ type: 'success', message: 'Added to favorites' })
      }
      window.setTimeout(() => setSaveToast(null), 1500)
    } catch (error: any) {
      setSaveToast({ type: 'error', message: error?.message || 'Failed to update favorite tag' })
      window.setTimeout(() => setSaveToast(null), 1800)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFromLibrary = async () => {
    if (!item) return
    const confirmed = window.confirm(`Remove "${item.title}" from your library?`)
    if (!confirmed) return
    setSaving(true)
    try {
      await api.removeLibraryItem(item.id)
      setSaveToast({ type: 'success', message: 'Removed from library' })
      window.setTimeout(() => navigate('/library'), 500)
    } catch (error: any) {
      setSaveToast({ type: 'error', message: error?.message || 'Failed to remove item' })
      window.setTimeout(() => setSaveToast(null), 1800)
    } finally {
      setSaving(false)
    }
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
  const visibleTags = (item.tags || []).filter((tag) => tag.toLowerCase() !== 'favorites')

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-base px-3 py-1 capitalize">
                          {item.type}
                          {item.genres && item.genres.length > 0 ? ` • ${item.genres.slice(0, 5).join(', ')}` : ''}
                      </Badge>
                    </div>
                </div>
                <div className="text-xl text-muted-foreground mt-2">{item.year}</div>
                {visibleTags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleTags.slice(0, 8).map((tag) => (
                      <Badge key={`tag-${tag}`} variant="outline">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
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
                                        <SelectGroup>
                                            <SelectLabel>Read</SelectLabel>
                                            <SelectItem value="want_to_read">Want to Read</SelectItem>
                                            <SelectItem value="reading">Reading</SelectItem>
                                            <SelectItem value="read">Read</SelectItem>
                                        </SelectGroup>
                                    ) : (
                                        <SelectGroup>
                                            <SelectLabel>Watch</SelectLabel>
                                            <SelectItem value="want_to_watch">Want to Watch</SelectItem>
                                            <SelectItem value="watching">Watching</SelectItem>
                                            <SelectItem value="watched">Watched</SelectItem>
                                        </SelectGroup>
                                    )}
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel>Other</SelectLabel>
                                      <SelectItem value="abandoned">Abandoned</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rating (0-100)</label>
                            <Input 
                                type="text"
                                inputMode="numeric"
                                placeholder="0-100"
                                value={ratingInput}
                                onFocus={(e) => {
                                  if (e.currentTarget.value === '0') {
                                    setRatingInput('')
                                  }
                                }}
                                onChange={(e) => {
                                  const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 3)
                                  const normalized = onlyDigits && Number.parseInt(onlyDigits, 10) > 100 ? '100' : onlyDigits
                                  setRatingInput(normalized)
                                }}
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
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Remove from library"
                  onClick={handleRemoveFromLibrary}
                  disabled={saving}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                  onClick={handleFavoriteToggle}
                  disabled={saving}
                >
                    <Star className={`h-4 w-4 ${isFavorite ? 'fill-current text-amber-500' : ''}`} />
                </Button>
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
