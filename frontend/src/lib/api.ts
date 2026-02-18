import { createClient } from '@supabase/supabase-js'

// Basic Supabase setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

export type WorkType = 'movie' | 'show' | 'book' | 'all';

export interface Work {
  id: string | number;
  title: string;
  year: number | null;
  type: WorkType;
  poster: string;
  overview: string;
  genres?: string[];
  // External source info for adding to library
  source?: {
      provider: 'tmdb' | 'openlibrary';
      external_id: string;
      source_type?: string;
  };
}

export interface LibraryItem extends Work {
  status: 'watched' | 'watching' | 'want_to_watch' | 'reading' | 'read' | 'want_to_read' | 'abandoned';
  rating: number; // 0-100
  notes?: string;
  review?: string; // Mapped to 'notes' in DB
  user_id?: string;
  user_item_id?: number; // DB primary key for user_items
  genres?: string[];
  tags?: string[];
  isFavorite?: boolean;
}

export interface LibraryFilters {
  type?: string;
  status?: string;
  year?: number | null;
  tags?: string[];
  genres?: string[];
  minRating?: number;
}

const FAVORITES_TAG = 'favorites';

function normalizeJoinedWork(rawWork: any): any | null {
  if (!rawWork) return null;
  if (Array.isArray(rawWork)) {
    return rawWork.length > 0 ? rawWork[0] : null;
  }
  return rawWork;
}

// === Status mapping between frontend display and DB enum ===
// DB enum: 'wishlist' | 'in_progress' | 'finished' | 'abandoned'
// Frontend display values vary by type (movie/show vs book)
type DbStatus = 'wishlist' | 'in_progress' | 'finished' | 'abandoned';
type FrontendStatus = 'watched' | 'watching' | 'want_to_watch' | 'reading' | 'read' | 'want_to_read' | 'abandoned';

const frontendToDb: Record<FrontendStatus, DbStatus> = {
    'want_to_watch': 'wishlist',
    'want_to_read': 'wishlist',
    'watching': 'in_progress',
    'reading': 'in_progress',
    'watched': 'finished',
    'read': 'finished',
    'abandoned': 'abandoned',
};

function dbStatusToFrontend(dbStatus: string, type: string): FrontendStatus {
    const isBook = type === 'book';
    switch (dbStatus) {
        case 'wishlist': return isBook ? 'want_to_read' : 'want_to_watch';
        case 'in_progress': return isBook ? 'reading' : 'watching';
        case 'finished': return isBook ? 'read' : 'watched';
        case 'abandoned': return 'abandoned';
        default: return isBook ? 'want_to_read' : 'want_to_watch';
    }
}

function frontendStatusToDb(status: string): DbStatus {
    return frontendToDb[status as FrontendStatus] || 'wishlist';
}

async function getGenresByWorkIds(workIds: Array<string | number>): Promise<Record<string, string[]>> {
  if (workIds.length === 0) return {};
  const numericWorkIds = [...new Set(workIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  if (numericWorkIds.length === 0) return {};

  const { data, error } = await supabase
    .from('work_genres')
    .select(`
      work_id,
      genres (name)
    `)
    .in('work_id', numericWorkIds);
  if (error) throw error;

  const byWorkId: Record<string, string[]> = {};
  for (const row of (data || []) as any[]) {
    const workId = row?.work_id;
    const fromGenres = row?.genres;
    const genreName =
      typeof row?.genre?.name === 'string'
        ? row.genre.name
        : Array.isArray(fromGenres)
          ? fromGenres[0]?.name
          : fromGenres?.name;
    if (workId == null || typeof genreName !== 'string') continue;
    const key = String(workId);
    if (!byWorkId[key]) byWorkId[key] = [];
    if (!byWorkId[key].includes(genreName)) byWorkId[key].push(genreName);
  }
  return byWorkId;
}

export const api = {
  search: async (query: string, type: WorkType = 'all') => {
    if (!query) return [];
    
    const params = new URLSearchParams({ q: query });
    if (type !== 'all') {
        params.append('type', type);
    }
    
    const res = await fetch(`/api/search?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
    });
    
    if (!res.ok) throw new Error('Search failed');
    
    const data = await res.json();
    return data.results.map((item: any) => ({
        id: item.source?.external_id || Math.random(), // Use external ID for key if available
        title: item.title,
        year: item.year,
        type: item.type,
        poster: item.poster_url || item.poster,
        overview: item.overview,
        genres: Array.isArray(item.genre_names) ? item.genre_names : [],
        source: item.source
    }));
  },

  getLibrarySourceKeys: async (): Promise<Set<string>> => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return new Set();

    const { data, error } = await supabase
      .from('user_items')
      .select(`
        work:works (
          tmdb_id,
          openlibrary_id
        )
      `)
      .eq('user_id', session.user.id);
    if (error) throw error;

    const keys = new Set<string>();
    for (const row of (data || []) as any[]) {
      const work = normalizeJoinedWork(row?.work);
      const tmdbId = work?.tmdb_id;
      const openlibraryId = work?.openlibrary_id;
      if (tmdbId !== null && tmdbId !== undefined) {
        keys.add(`tmdb:${String(tmdbId)}`);
      }
      if (openlibraryId) {
        keys.add(`openlibrary:${String(openlibraryId)}`);
      }
    }
    return keys;
  },
  
  addToLibrary: async (item: Work) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    const payload = {
        source: item.source,
        status: frontendStatusToDb(item.type === 'book' ? 'want_to_read' : 'want_to_watch'),
        rating: 0
    };
    
    const res = await fetch('/api/library/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail?.error || 'Failed to add to library');
    }
    
    const data = await res.json();
    // Return a LibraryItem structure
    return {
        success: true,
        item: {
            ...item,
            id: data.work.id, // Use the real DB ID for the work
            status: dbStatusToFrontend(data.user_item.status, item.type),
            rating: data.user_item.rating,
            user_item_id: data.user_item.id
        }
    }
  },
  
  getLibrary: async (filters: LibraryFilters = {}) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return [];

    let query = supabase
        .from('user_items')
        .select(`
            *,
            work:works (
                id, title, year, type, poster_url, overview,
                work_genres (
                    genre:genres (name)
                )
            ),
            user_item_tags (
                tag:user_tag_names (name)
            )
        `)
        .eq('user_id', session.user.id);

    // Apply filters
    // Note: Filtering by joined table fields (work.type) is trickier in simple Supabase query syntax 
    // without flattening or using !inner joins.
    // For now, let's fetch all and filter in memory if needed, or use !inner for strict filtering.
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', frontendStatusToDb(filters.status));
    }

    if (typeof filters.minRating === 'number' && !Number.isNaN(filters.minRating) && filters.minRating > 0) {
      query = query.gte('rating', filters.minRating);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    let items = (data || [])
      .map((row: any) => {
        const work = normalizeJoinedWork(row.work);
        if (!work) return null;
        return {
          id: work.id,
          user_item_id: row.id,
          title: work.title,
          year: work.year,
          type: work.type,
          poster: work.poster_url,
          overview: work.overview,
          status: dbStatusToFrontend(row.status, work.type),
          rating: row.rating,
          review: row.notes, // Map DB notes to frontend review
          notes: row.notes,
          user_id: row.user_id,
          genres: ((work.work_genres || []) as any[])
            .map((item: any) => item?.genre?.name)
            .filter((name: any) => typeof name === 'string'),
          tags: ((row.user_item_tags || []) as any[])
            .map((item: any) => item?.tag?.name)
            .filter((name: any) => typeof name === 'string'),
        };
      })
      .filter(Boolean) as LibraryItem[];

    const genreByWorkId = await getGenresByWorkIds(items.map((item) => item.id));
    items = items.map((item) => ({
      ...item,
      genres: genreByWorkId[String(item.id)] || item.genres || [],
    }));

    const withFavorites = items.map((item) => ({
      ...item,
      isFavorite: (item.tags || []).some((tag) => tag.toLowerCase() === FAVORITES_TAG),
    }));

    let filtered = withFavorites;

    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter((item) => item.type === filters.type);
    }

    if (typeof filters.year === 'number' && !Number.isNaN(filters.year)) {
      filtered = filtered.filter((item) => item.year === filters.year);
    }

    if (Array.isArray(filters.tags) && filters.tags.length > 0) {
      const wanted = new Set(filters.tags.map((tag) => tag.toLowerCase()));
      filtered = filtered.filter((item) =>
        (item.tags || []).some((tag) => wanted.has(tag.toLowerCase()))
      );
    }

    if (Array.isArray(filters.genres) && filters.genres.length > 0) {
      const wantedGenres = new Set(filters.genres.map((genre) => genre.toLowerCase()));
      filtered = filtered.filter((item) =>
        (item.genres || []).some((genre) => wantedGenres.has(genre.toLowerCase()))
      );
    }

    return filtered;
  },

  getUserTagNames: async (): Promise<string[]> => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return [];

    const { data, error } = await supabase
      .from('user_tag_names')
      .select('name')
      .eq('user_id', session.user.id)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || [])
      .map((row: any) => row?.name)
      .filter((name: any) => typeof name === 'string' && name.toLowerCase() !== FAVORITES_TAG);
  },

  setItemTags: async (userItemId: number, tagNames: string[]) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    const cleaned = [...new Set(
      tagNames
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag))
    )];

    const { data: ownerRow, error: ownerError } = await supabase
      .from('user_items')
      .select('id')
      .eq('id', userItemId)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownerRow) throw new Error('Item not found');

    const { error: deleteError } = await supabase
      .from('user_item_tags')
      .delete()
      .eq('user_item_id', userItemId);
    if (deleteError) throw deleteError;

    if (cleaned.length === 0) return { success: true };

    const tagRows = cleaned.map((name) => ({ user_id: session.user.id, name }));
    const { error: upsertTagsError } = await supabase
      .from('user_tag_names')
      .upsert(tagRows, { onConflict: 'user_id,name' });
    if (upsertTagsError) throw upsertTagsError;

    const { data: tagData, error: tagLookupError } = await supabase
      .from('user_tag_names')
      .select('id,name')
      .eq('user_id', session.user.id)
      .in('name', cleaned);
    if (tagLookupError) throw tagLookupError;

    const links = (tagData || []).map((row: any) => ({
      user_item_id: userItemId,
      tag_id: row.id,
    }));
    if (links.length > 0) {
      const { error: insertLinksError } = await supabase
        .from('user_item_tags')
        .insert(links);
      if (insertLinksError) throw insertLinksError;
    }
    return { success: true };
  },

  setFavoriteTag: async (userItemId: number, isFavorite: boolean, currentTags: string[] = []) => {
    const nextWithoutFavorite = currentTags.filter(
      (tag) => tag.toLowerCase() !== FAVORITES_TAG
    );
    const nextTags = isFavorite
      ? [...nextWithoutFavorite, FAVORITES_TAG]
      : nextWithoutFavorite;
    return api.setItemTags(userItemId, nextTags);
  },
  
  updateLibraryItem: async (workId: string | number, updates: Partial<LibraryItem>) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    // Map frontend values back to DB columns
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = frontendStatusToDb(updates.status);
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
    if (updates.review !== undefined) dbUpdates.notes = updates.review;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { error } = await supabase
        .from('user_items')
        .update(dbUpdates)
        .eq('work_id', workId)
        .eq('user_id', session.user.id);
        
    if (error) throw error;
    return { success: true }
  },

  removeLibraryItem: async (workId: string | number) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_items')
      .delete()
      .eq('work_id', workId)
      .eq('user_id', session.user.id);
    if (error) throw error;
    return { success: true };
  },

  getLibraryItem: async (workId: string | number) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return null;

    const { data, error } = await supabase
        .from('user_items')
        .select(`
            *,
            work:works (
                id, title, year, type, poster_url, overview,
                work_genres (
                    genre:genres (name)
                )
            ),
            user_item_tags (
                tag:user_tag_names (name)
            )
        `)
        .eq('work_id', workId)
        .eq('user_id', session.user.id)
        .single();
        
    if (error || !data) return null;
    const work = normalizeJoinedWork(data.work);
    if (!work) return null;
    
    const genreByWorkId = await getGenresByWorkIds([work.id]);

    return {
        id: work.id,
        user_item_id: data.id,
        title: work.title,
        year: work.year,
        type: work.type,
        poster: work.poster_url,
        overview: work.overview,
        status: dbStatusToFrontend(data.status, work.type),
        rating: data.rating,
        review: data.notes,
        notes: data.notes,
        user_id: data.user_id,
        genres: genreByWorkId[String(work.id)] || ((work.work_genres || []) as any[])
          .map((item: any) => item?.genre?.name)
          .filter((name: any) => typeof name === 'string'),
        tags: ((data.user_item_tags || []) as any[])
          .map((item: any) => item?.tag?.name)
          .filter((name: any) => typeof name === 'string'),
        isFavorite: ((data.user_item_tags || []) as any[])
          .map((item: any) => item?.tag?.name)
          .filter((name: any) => typeof name === 'string')
          .some((tag: string) => tag.toLowerCase() === FAVORITES_TAG),
    } as LibraryItem;
  },

  getStats: async (jsonData: any) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');
    
    // If jsonData is provided, we send it (for the manual paste feature)
    // If not, we might want to fetch library items first? 
    // The previous mock implementation calculated from library if empty.
    // The backend endpoint requires a list of items.
    
    let payload = jsonData;
    
    // If no valid manual input array, calculate from the user's library.
    if (!Array.isArray(payload) || payload.length === 0) {
         const items = await api.getLibrary();
         payload = items
           .filter((i: any) => typeof i.rating === 'number' && !Number.isNaN(i.rating))
           .map((i: any) => ({
             type: i.type,
             rating: i.rating
           }));
    }

    const res = await fetch('/api/ratings/stats', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail?.error || 'Failed to calculate stats');
    }
    
    const data = await res.json();
    // Backend returns { stats: { ... } } where stats matches C++ output
    const s = data.stats;
    return {
        average_rating: Math.round(s.overall?.average_rating || 0),
        total_items: s.overall?.count || 0,
        by_type: {
            movie: s.types?.movie?.count || 0,
            show: s.types?.show?.count || 0,
            book: s.types?.book?.count || 0
        }
    }; 
  }
}
