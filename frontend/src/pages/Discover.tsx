import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Recommendation, type TonightFilters } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Sparkles, Clock, Film, Tv, BookOpen, RefreshCw, Info } from 'lucide-react'

function RecommendationCard({ rec, onClick }: { rec: Recommendation; onClick: () => void }) {
  const work = rec.work
  if (!work) return null

  const typeIcon = work.type === 'movie' ? <Film className="h-3 w-3" />
    : work.type === 'show' ? <Tv className="h-3 w-3" />
    : <BookOpen className="h-3 w-3" />

  return (
    <Card
      className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
      onClick={onClick}
    >
      <div className="flex gap-4 p-4">
        <div className="w-20 h-28 flex-shrink-0 rounded-md overflow-hidden bg-muted">
          {work.poster_url ? (
            <img src={work.poster_url} alt={work.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No poster
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {work.title}
            </h3>
            <Badge variant="outline" className="flex-shrink-0 gap-1 text-xs">
              {typeIcon}
              {work.year}
            </Badge>
          </div>

          {work.genres && work.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {work.genres.slice(0, 3).map((g) => (
                <Badge key={g} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {g}
                </Badge>
              ))}
            </div>
          )}

          {rec.reasons.length > 0 && (
            <div className="flex items-start gap-1.5 mt-1">
              <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                {rec.reasons.join(' · ')}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <Badge
              variant={rec.engine === 'hybrid' ? 'default' : 'outline'}
              className="text-[10px] px-1.5 py-0"
            >
              {rec.engine}
            </Badge>
            {rec.vector_similarity != null && rec.vector_similarity > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {Math.round(rec.vector_similarity * 100)}% match
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const [tonightPicks, setTonightPicks] = useState<Recommendation[]>([])
  const [tonightLoading, setTonightLoading] = useState(false)
  const [tonightError, setTonightError] = useState<string | null>(null)

  const [filters, setFilters] = useState<TonightFilters>({
    limit: 3,
    type: undefined,
    max_duration: undefined,
    language: undefined,
  })
  const [maxDurationInput, setMaxDurationInput] = useState('')

  const loadTonightPicks = useCallback(async () => {
    setTonightLoading(true)
    setTonightError(null)
    try {
      const picks = await api.getTonightPicks(filters)
      setTonightPicks(picks)
      if (picks.length === 0) {
        setTonightError('No picks found. Make sure you have items in your watchlist or reading list, and rate some finished items to improve suggestions.')
      }
    } catch (err: any) {
      setTonightError(err?.message || 'Failed to load recommendations')
    } finally {
      setTonightLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadTonightPicks()
  }, [loadTonightPicks])

  const handleDurationBlur = () => {
    const val = parseInt(maxDurationInput, 10)
    if (!isNaN(val) && val > 0) {
      setFilters((f) => ({ ...f, max_duration: val }))
    } else {
      setFilters((f) => ({ ...f, max_duration: undefined }))
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Discover
        </h1>
        <p className="text-muted-foreground mt-1">
          Pick what to watch or read next from your backlog, based on your taste
        </p>
      </div>

      {/* Tonight Picker */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Tonight's Picks</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTonightPicks}
            disabled={tonightLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${tonightLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select
              value={filters.type || 'all'}
              onValueChange={(v) => setFilters((f) => ({ ...f, type: v === 'all' ? undefined : v }))}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="show">TV Shows</SelectItem>
                <SelectItem value="book">Books</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Duration (min)</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 120"
              className="w-28 h-8 text-xs"
              value={maxDurationInput}
              onChange={(e) => setMaxDurationInput(e.target.value.replace(/\D/g, ''))}
              onBlur={handleDurationBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDurationBlur() }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Language</label>
            <Select
              value={filters.language || 'any'}
              onValueChange={(v) => setFilters((f) => ({ ...f, language: v === 'any' ? undefined : v }))}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {tonightLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tonightError && tonightPicks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">{tonightError}</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Add items to your watchlist or reading list, then rate finished items to get personalised picks.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tonightPicks.map((rec) => (
              <RecommendationCard
                key={rec.work_id}
                rec={rec}
                onClick={() => navigate(`/library/${rec.work_id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="font-medium text-sm">Semantic Matching</h3>
              <p className="text-xs text-muted-foreground">
                AI embeddings find works with similar themes, tone, and storyline — even across genres.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Film className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="font-medium text-sm">Metadata Heuristics</h3>
              <p className="text-xs text-muted-foreground">
                Shared genres, directors, cast, and authors create a strong signal for "more like this."
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="font-medium text-sm">Hybrid Fusion</h3>
              <p className="text-xs text-muted-foreground">
                Reciprocal Rank Fusion blends both engines for diverse, high-quality recommendations.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
