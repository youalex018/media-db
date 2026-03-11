import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type PublicUser } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Search, Users } from 'lucide-react'

export function CommunityPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicUser[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 500)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setError(null)
    api.searchUsers(debouncedQuery)
      .then((users) => {
        setResults(users)
        setSearched(true)
      })
      .catch((e) => {
        setError(e?.message || 'Search failed')
        setResults([])
        setSearched(true)
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground mt-1">
          Discover other users and explore their libraries.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 text-destructive px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-medium">No users found</h3>
          <p className="text-muted-foreground text-sm">
            Try a different search term. Only public profiles are shown.
          </p>
        </div>
      )}

      {!loading && !searched && !query && (
        <div className="text-center py-16 space-y-3">
          <Users className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium">Find other collectors</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Search for users by username to discover their public libraries and see what they've been watching and reading.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-3">
          {results.map((user) => (
            <Link key={user.username} to={`/u/${user.username}`}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className="font-bold bg-timber-300/15 text-timber-300">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                      {user.username}
                    </h3>
                  </div>
                  <span className="text-sm text-muted-foreground">View library &rarr;</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
