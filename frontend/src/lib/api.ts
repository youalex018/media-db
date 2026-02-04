// Mock API for development purposes

import { createClient } from '@supabase/supabase-js'

// Basic Supabase setup if env vars are present, otherwise mock
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export type WorkType = 'movie' | 'show' | 'book' | 'all';

export interface Work {
  id: string | number;
  title: string;
  year: string;
  type: WorkType;
  poster: string;
  overview: string;
}

export interface LibraryItem extends Work {
  status: 'watched' | 'watching' | 'want_to_watch' | 'reading' | 'read' | 'want_to_read';
  rating: number; // 0-100
  notes?: string;
  user_id?: string;
}

// Mock data
const MOCK_SEARCH_RESULTS: Work[] = [
  { id: 1, title: 'Inception', year: '2010', type: 'movie', poster: 'https://placehold.co/150x225/png?text=Inception', overview: 'A thief who steals corporate secrets through the use of dream-sharing technology...' },
  { id: 2, title: 'Interstellar', year: '2014', type: 'movie', poster: 'https://placehold.co/150x225/png?text=Interstellar', overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.' },
  { id: 3, title: 'The Dark Knight', year: '2008', type: 'movie', poster: 'https://placehold.co/150x225/png?text=Dark+Knight', overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham...' },
  { id: 4, title: 'Breaking Bad', year: '2008', type: 'show', poster: 'https://placehold.co/150x225/png?text=Breaking+Bad', overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine...' },
  { id: 5, title: 'Dune', year: '1965', type: 'book', poster: 'https://placehold.co/150x225/png?text=Dune', overview: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...' },
  { id: 6, title: 'The Matrix', year: '1999', type: 'movie', poster: 'https://placehold.co/150x225/png?text=The+Matrix', overview: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.' },
]

let MOCK_LIBRARY: LibraryItem[] = [
  { id: 1, title: 'Inception', year: '2010', type: 'movie', poster: 'https://placehold.co/150x225/png?text=Inception', overview: '...', status: 'watched', rating: 95 },
  { id: 4, title: 'Breaking Bad', year: '2008', type: 'show', poster: 'https://placehold.co/150x225/png?text=Breaking+Bad', overview: '...', status: 'watching', rating: 100 },
]

export const api = {
  search: async (query: string, type: WorkType = 'all') => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (!query) return [];

    return MOCK_SEARCH_RESULTS.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) && 
      (type === 'all' || item.type === type)
    )
  },
  
  addToLibrary: async (item: Work) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const newItem: LibraryItem = { 
        ...item, 
        status: item.type === 'book' ? 'want_to_read' : 'want_to_watch', 
        rating: 0 
    };
    
    // Check if already exists
    if (!MOCK_LIBRARY.find(i => i.id === item.id)) {
        MOCK_LIBRARY = [newItem, ...MOCK_LIBRARY];
    }
    
    return { success: true, item: newItem }
  },
  
  getLibrary: async (filters: { type?: string, status?: string } = {}) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let items = [...MOCK_LIBRARY];
    
    if (filters.type && filters.type !== 'all') {
        items = items.filter(i => i.type === filters.type);
    }
    
    if (filters.status && filters.status !== 'all') {
        items = items.filter(i => i.status === filters.status);
    }
    
    return items;
  },
  
  updateLibraryItem: async (id: string | number, updates: Partial<LibraryItem>) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    MOCK_LIBRARY = MOCK_LIBRARY.map(item => 
        item.id === id ? { ...item, ...updates } : item
    );
    return { success: true }
  },

  getStats: async (jsonData: any) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    // Calculate real stats from mock library if json input is empty, otherwise pretend to process json
    const total = MOCK_LIBRARY.length;
    const avg = total > 0 ? MOCK_LIBRARY.reduce((acc, i) => acc + i.rating, 0) / total : 0;
    
    return {
      average_rating: Math.round(avg),
      total_items: total,
      by_type: { 
          movie: MOCK_LIBRARY.filter(i => i.type === 'movie').length,
          show: MOCK_LIBRARY.filter(i => i.type === 'show').length,
          book: MOCK_LIBRARY.filter(i => i.type === 'book').length
      }
    }
  }
}
