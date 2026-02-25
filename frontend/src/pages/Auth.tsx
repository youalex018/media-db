import { useState } from 'react'
import { supabase } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Film, BookOpen, Tv, Star, BarChart2, Library } from 'lucide-react'

const FEATURES = [
  { icon: Film, label: 'Movies', description: "Track every film you've watched or want to watch" },
  { icon: Tv, label: 'TV Shows', description: 'Follow and review each series at your own pace' },
  { icon: BookOpen, label: 'Books', description: 'Log your reading list and reading progress' },
  { icon: Star, label: 'Ratings & Reviews', description: 'Score and review everything in your own words' },
  { icon: BarChart2, label: 'Stats', description: 'Visualise your ratings and consumption habits' },
  { icon: Library, label: 'Your Library', description: 'One unified shelf for all your media' },
]

export function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      let error = null

      if (mode === 'otp') {
        const res = await supabase.auth.signInWithOtp({ email })
        error = res.error
        if (!error) setMessage('Check your email for the magic link!')
      } else {
        if (isSignUp) {
          const res = await supabase.auth.signUp({ email, password })
          error = res.error
          if (!error) setMessage('Account created! Please check your email to confirm.')
        } else {
          const res = await supabase.auth.signInWithPassword({ email, password })
          error = res.error
        }
      }

      if (error) setMessage('Error: ' + error.message)
    } catch (err: any) {
      setMessage('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = () => {
    localStorage.setItem('sb-fake-session', 'true')
    window.location.reload()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1e]">

      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-cyan-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[100px]" />
        {/* Subtle dot grid */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Page layout */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-12 px-4 py-16 lg:flex-row lg:items-start lg:justify-center lg:gap-20 lg:pt-24">

        {/* Left — branding + features */}
        <div className="flex max-w-md flex-col gap-8 text-white">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg">
              <span className="text-xl font-black text-white">M</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Media DB</h1>
              <p className="text-xs font-medium text-cyan-300/80">Your personal media shelf</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <h2 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
              One place for every
              <span className="block bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                story you love.
              </span>
            </h2>
            <p className="text-base text-slate-300">
              Track, rate, and review every movie, show, and book — all in one personal library.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — auth card */}
        <div className="w-full max-w-md">
          <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-white">
                {mode === 'otp' ? 'Magic Link Login' : isSignUp ? 'Create Account' : 'Welcome back'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {isSignUp ? 'Start building your personal library.' : 'Sign in to access your library.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-white/10">
                  <TabsTrigger value="password" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-slate-400">
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="otp" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-slate-400">
                    Magic Link
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-white/20 bg-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500"
                  />
                </div>

                {mode === 'password' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-slate-300">Password</Label>
                      {!isSignUp && (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs text-cyan-400 hover:text-cyan-300"
                          type="button"
                          onClick={() => {
                            supabase.auth.resetPasswordForEmail(email).then(({ error }) => {
                              if (error) setMessage(error.message)
                              else setMessage('Password reset email sent!')
                            })
                          }}
                        >
                          Forgot password?
                        </Button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-white/20 bg-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500"
                    />
                  </div>
                )}

                {message && (
                  <div className={`rounded p-2 text-sm ${message.startsWith('Error') ? 'bg-red-500/20 text-red-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                    {message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 font-semibold text-white hover:from-cyan-400 hover:to-indigo-400"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : mode === 'otp' ? 'Send Magic Link' : isSignUp ? 'Sign Up' : 'Sign In'}
                </Button>
              </form>

              {mode === 'password' && (
                <p className="text-center text-sm text-slate-400">
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-cyan-400 underline hover:text-cyan-300"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Button>
                </p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-slate-500">Or continue with</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={handleDevLogin}
              >
                Dev Bypass (Fake Login)
              </Button>
            </CardFooter>
          </Card>
        </div>

      </div>
    </div>
  )
}
