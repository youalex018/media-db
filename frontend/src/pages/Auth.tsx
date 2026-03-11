import { useState } from 'react'
import { supabase } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Film, BookOpen, Tv, Star, BarChart2, Library } from 'lucide-react'
import { ShelfIcon } from '@/components/ShelfIcon'

const FEATURES = [
  { icon: Film, label: 'Movies', description: "Track every film you've watched or want to watch" },
  { icon: Tv, label: 'TV Shows', description: 'Follow and review each series at your own pace' },
  { icon: BookOpen, label: 'Books', description: 'Log your reading list and reading progress' },
  { icon: Star, label: 'Ratings & Reviews', description: 'Score and review everything in your own words' },
  { icon: BarChart2, label: 'Stats', description: 'Visualise your ratings and consumption habits' },
  { icon: Library, label: 'Your Library', description: 'One unified shelf for all your media' },
]

function DustMotes() {
  const motes = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: `${10 + Math.random() * 80}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${7 + Math.random() * 5}s`,
    size: 2 + Math.random() * 2,
    startY: `${25 + Math.random() * 50}%`,
  }))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m) => (
        <div
          key={m.id}
          className="absolute rounded-full bg-timber-300/40 animate-dust"
          style={{
            left: m.left,
            top: m.startY,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  )
}

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
    <div className="relative min-h-screen overflow-hidden bg-timber-950">

      {/* Warm radial lamp glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[15%] h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-timber-300/[0.04] blur-[100px]" />
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-timber-950" />
      </div>

      <DustMotes />

      {/* Page layout */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-12 px-4 py-16 lg:flex-row lg:items-start lg:justify-center lg:gap-20 lg:pt-28">

        {/* Left — branding + features */}
        <div className="flex max-w-md flex-col gap-8 text-timber-100">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <ShelfIcon className="h-12 w-12" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Shelflife</h1>
              <p className="text-xs font-medium text-timber-100/50">Your personal media shelf</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
              One place for every
              <span className="block text-timber-300">
                story you love.
              </span>
            </h2>
            <p className="text-base text-timber-100/60">
              Track, rate, and review every movie, show, and book — all in one personal library.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="rounded-xl border border-timber-100/[0.06] bg-timber-100/[0.02] p-3"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-timber-300" />
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-timber-100/40">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — auth card */}
        <div className="w-full max-w-md">
          <Card className="border-timber-100/[0.06] bg-timber-100/[0.03] backdrop-blur-xl text-timber-100 shadow-2xl shadow-black/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-timber-100">
                {mode === 'otp' ? 'Magic Link Login' : isSignUp ? 'Create Account' : 'Welcome back'}
              </CardTitle>
              <CardDescription className="text-timber-100/40">
                {isSignUp ? 'Start building your personal library.' : 'Sign in to access your library.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-timber-100/[0.05]">
                  <TabsTrigger value="password" className="data-[state=active]:bg-timber-100/[0.1] data-[state=active]:text-timber-100 text-timber-100/40">
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="otp" className="data-[state=active]:bg-timber-100/[0.1] data-[state=active]:text-timber-100 text-timber-100/40">
                    Magic Link
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-timber-100/70">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-timber-100/[0.08] bg-timber-100/[0.04] text-timber-100 placeholder:text-timber-100/25 focus-visible:ring-timber-300"
                  />
                </div>

                {mode === 'password' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-timber-100/70">Password</Label>
                      {!isSignUp && (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs text-timber-300 hover:text-timber-200"
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
                      className="border-timber-100/[0.08] bg-timber-100/[0.04] text-timber-100 placeholder:text-timber-100/25 focus-visible:ring-timber-300"
                    />
                  </div>
                )}

                {message && (
                  <div className={`rounded-lg p-3 text-sm ${message.startsWith('Error') ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 'bg-timber-300/15 text-timber-300 border border-timber-300/20'}`}>
                    {message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-timber-300 font-semibold text-timber-950 hover:bg-timber-200"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : mode === 'otp' ? 'Send Magic Link' : isSignUp ? 'Sign Up' : 'Sign In'}
                </Button>
              </form>

              {mode === 'password' && (
                <p className="text-center text-sm text-timber-100/40">
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-timber-300 underline hover:text-timber-200"
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
                  <span className="w-full border-t border-timber-100/[0.06]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-timber-100/25">Or continue with</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-timber-100/[0.08] bg-timber-100/[0.03] text-timber-100/60 hover:bg-timber-100/[0.06] hover:text-timber-100"
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
