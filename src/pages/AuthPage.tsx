import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthPageProps {
  mode: AuthMode;
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Start your 14-day trial' : 'Reset password';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/app/dashboard');
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account created. Please check your email to verify your account.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage('Password reset link sent. Check your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-premium-gradient p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-premium lg:grid-cols-2">
        <div className="hidden bg-navy-950 p-10 text-slate-200 lg:block">
          <BrandLogo />
          <h2 className="mt-10 text-4xl font-bold">Premium quote operations for modern procurement teams.</h2>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li>• AI quote extraction</li>
            <li>• Team and organization controls</li>
            <li>• Admin and subscription analytics</li>
          </ul>
        </div>

        <div className="flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md">
            <BrandLogo />
            <p className="mt-6 text-3xl font-bold text-navy-950">{title}</p>
            {mode === 'signup' && <p className="mt-2 inline-flex rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-600">Free trial enabled</p>}

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {mode !== 'reset' && (
                <Input
                  label="Password"
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
              </Button>
            </form>

            <div className="mt-6 text-sm text-slatePremium-600">
              {mode === 'login' && (
                <>
                  <p>
                    New to VantagePM?{' '}
                    <Link to="/signup" className="font-semibold text-navy-800">
                      Sign up
                    </Link>
                  </p>
                  <Link to="/reset-password" className="mt-2 inline-block text-navy-700">
                    Forgot password?
                  </Link>
                </>
              )}
              {mode === 'signup' && (
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-navy-800">
                    Sign in
                  </Link>
                </p>
              )}
              {mode === 'reset' && (
                <p>
                  Remembered it?{' '}
                  <Link to="/login" className="font-semibold text-navy-800">
                    Back to sign in
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
