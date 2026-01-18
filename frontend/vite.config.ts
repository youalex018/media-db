import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Log env vars for debugging (remove in production)
  console.log('Vite Environment Check:')
  console.log('  Mode:', mode)
  console.log('  CWD:', process.cwd())
  console.log('  VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET')
  console.log('  VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET')
  
  return {
    plugins: [react()],
    // Explicitly define env prefix (Vite default is VITE_)
    envPrefix: 'VITE_',
    server: {
      port: 3000,
    },
  }
})