import { useState } from 'react'
import { supabase } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Film, BookOpen, Tv, Star, BarChart2, Library } from 'lucide-react'
import Aurora from '@/components/reactbits/Aurora'
import BlurText from '@/components/reactbits/BlurText'
import ShinyText from '@/components/reactbits/ShinyText'
import SpotlightCard from '@/components/reactbits/SpotlightCard'

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
    <div className="relative min-h-screen overflow-hidden bg-abyss">

      {/* Aurora WebGL background */}
      <div className="pointer-events-none absolute inset-0">
        <Aurora
          colorStops={['#0891b2', '#7c3aed', '#06b6d4']}
          amplitude={1.2}
          blend={0.6}
          speed={0.6}
        />
      </div>

      {/* Subtle overlay grain */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-abyss/30 via-transparent to-abyss/60" />

      {/* Page layout */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-12 px-4 py-16 lg:flex-row lg:items-start lg:justify-center lg:gap-20 lg:pt-28">

        {/* Left — branding + features */}
        <div className="flex max-w-md flex-col gap-8 text-white">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-400 to-violet-500 shadow-lg shadow-ocean-400/20">
              <span className="text-xl font-black text-white">M</span>
            </div>
            <div>
              <BlurText
                text="Mediarium"
                className="text-3xl font-extrabold tracking-tight"
                delay={80}
                animateBy="letters"
              />
              <ShinyText
                text="Your personal media universe"
                className="text-xs font-medium"
                color="#94a3b8"
                shineColor="#22d3ee"
                speed={3}
              />
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
              One place for every
              <span className="block bg-gradient-to-r from-ocean-400 via-violet-400 to-ocean-300 bg-clip-text text-transparent">
                story you love.
              </span>
            </h2>
            <p className="text-base text-slate-300/80">
              Track, rate, and review every movie, show, and book — all in one personal library.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <SpotlightCard
                key={label}
                className="border-white/[0.08] bg-white/[0.03]"
                spotlightColor="rgba(34, 211, 238, 0.08)"
              >
                <div className="flex flex-col gap-1.5 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-ocean-400" />
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{description}</p>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* Right — auth card */}
        <div className="w-full max-w-md">
          <Card className="border-white/[0.08] bg-white/[0.04] backdrop-blur-xl text-white shadow-2xl shadow-black/20">
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
                <TabsList className="grid w-full grid-cols-2 bg-white/[0.06]">
                  <TabsTrigger value="password" className="data-[state=active]:bg-white/[0.12] data-[state=active]:text-white text-slate-400">
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="otp" className="data-[state=active]:bg-white/[0.12] data-[state=active]:text-white text-slate-400">
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
                    className="border-white/[0.1] bg-white/[0.06] text-white placeholder:text-slate-500 focus-visible:ring-ocean-400"
                  />
                </div>

                {mode === 'password' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-slate-300">Password</Label>
                      {!isSignUp && (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs text-ocean-400 hover:text-ocean-300"
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
                      className="border-white/[0.1] bg-white/[0.06] text-white placeholder:text-slate-500 focus-visible:ring-ocean-400"
                    />
                  </div>
                )}

                {message && (
                  <div className={`rounded-lg p-3 text-sm ${message.startsWith('Error') ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 'bg-ocean-500/15 text-ocean-300 border border-ocean-500/20'}`}>
                    {message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-ocean-500 to-violet-500 font-semibold text-white hover:from-ocean-400 hover:to-violet-400 shadow-lg shadow-ocean-500/20"
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
                    className="h-auto p-0 text-ocean-400 underline hover:text-ocean-300"
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
                  <span className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-slate-500">Or continue with</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-white/[0.1] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
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
