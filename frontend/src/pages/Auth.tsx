import { useState } from 'react'
import { supabase } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
        let error = null;

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
                // No success message needed, redirect happens automatically via onAuthStateChange
            }
        }

        if (error) {
            setMessage('Error: ' + error.message)
        }
    } catch (err: any) {
        setMessage('Error: ' + err.message)
    } finally {
        setLoading(false)
    }
  }
  
  // Fake login for dev
  const handleDevLogin = () => {
      localStorage.setItem('sb-fake-session', 'true');
      window.location.reload();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === 'otp' ? 'Magic Link Login' : (isSignUp ? 'Create Account' : 'Login')}
          </CardTitle>
          <CardDescription>Enter your credentials to access your library</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full mb-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="password">Password</TabsTrigger>
                    <TabsTrigger value="otp">Magic Link</TabsTrigger>
                </TabsList>
            </Tabs>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {mode === 'password' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                        <Button variant="link" className="p-0 h-auto text-xs" type="button" onClick={() => {
                            supabase.auth.resetPasswordForEmail(email).then(({ error }) => {
                                if (error) setMessage(error.message)
                                else setMessage('Password reset email sent!')
                            })
                        }}>
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
                  />
                </div>
            )}

            {message && (
                <div className={`text-sm p-2 rounded ${message.startsWith('Error') ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'}`}>
                    {message}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : (
                  mode === 'otp' ? 'Send Magic Link' : (isSignUp ? 'Sign Up' : 'Sign In')
              )}
            </Button>
          </form>

          {mode === 'password' && (
              <div className="mt-4 text-center text-sm">
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                  <Button variant="link" className="p-0 h-auto font-normal underline" onClick={() => setIsSignUp(!isSignUp)}>
                      {isSignUp ? "Sign In" : "Sign Up"}
                  </Button>
              </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
             <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            <Button variant="outline" className="w-full" onClick={handleDevLogin}>
                Dev Bypass (Fake Login)
            </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
