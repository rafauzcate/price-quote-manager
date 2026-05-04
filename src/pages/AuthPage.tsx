import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type AuthMode = 'login' | 'signup' | 'reset';
type ResetStage = 'request' | 'update';

interface AuthPageProps {
  mode: AuthMode;
}

const PASSWORD_MIN_LENGTH = 8;

async function getSupabaseClient() {
  const module = await import('../lib/supabase');
  return module.getSupabaseClient();
}

function validatePasswordStrength(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (!/[a-z]/.test(value)) {
    return 'Password must contain at least one lowercase letter.';
  }

  if (!/\d/.test(value)) {
    return 'Password must contain at least one number.';
  }

  return null;
}

function hasRecoveryTokenInUrl(): boolean {
  if (typeof window === 'undefined') return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const tokenPresent = Boolean(
    hashParams.get('access_token') ||
      searchParams.get('access_token') ||
      hashParams.get('refresh_token') ||
      searchParams.get('refresh_token') ||
      searchParams.get('code'),
  );

  const isRecoveryType = [hashParams.get('type'), searchParams.get('type')].includes('recovery');
  return tokenPresent || isRecoveryType;
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStage, setResetStage] = useState<ResetStage>('request');

  useEffect(() => {
    const queryEmail = new URLSearchParams(location.search).get('email');
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, [location.search]);

  useEffect(() => {
    if (mode !== 'reset') return;

    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    const initResetFlow = async () => {
      const supabase = await getSupabaseClient();

      await supabase.auth.getSession();

      if (!isActive) return;

      if (hasRecoveryTokenInUrl()) {
        setResetStage('update');
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (!isActive) return;

        if (event === 'PASSWORD_RECOVERY') {
          setResetStage('update');
          setError(null);
          setMessage('Recovery session verified. Set your new password below.');
        }
      });

      unsubscribe = () => subscription.unsubscribe();
    };

    initResetFlow();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [mode]);

  const title = useMemo(() => {
    if (mode === 'login') return 'Welcome back';
    if (mode === 'signup') return 'Start your 14-day trial';
    return resetStage === 'update' ? 'Set a new password' : 'Reset password';
  }, [mode, resetStage]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = await getSupabaseClient();

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/app/dashboard');
        return;
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account created. Please check your email to verify your account.');
        return;
      }

      if (resetStage === 'request') {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;

        setMessage('Password reset email sent. Check your inbox (and spam folder) for the recovery link.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const passwordValidationError = validatePasswordStrength(password);
      if (passwordValidationError) {
        setError(passwordValidationError);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage('Password updated successfully. Redirecting to sign in...');
      setPassword('');
      setConfirmPassword('');
      window.setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
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
            {mode === 'reset' && resetStage === 'request' && (
              <p className="mt-2 text-sm text-slatePremium-600">Enter your account email and we will send a secure reset link valid for a limited time.</p>
            )}
            {mode === 'reset' && resetStage === 'update' && (
              <p className="mt-2 text-sm text-slatePremium-600">Create a strong new password to complete your password recovery.</p>
            )}

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {(mode !== 'reset' || resetStage === 'request') && (
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              )}

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

              {mode === 'reset' && resetStage === 'update' && (
                <>
                  <Input
                    label="New password"
                    type="password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slatePremium-500">Use at least 8 characters including uppercase, lowercase, and a number.</p>
                </>
              )}

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                {mode === 'login'
                  ? 'Sign in'
                  : mode === 'signup'
                    ? 'Create account'
                    : resetStage === 'request'
                      ? 'Send reset link'
                      : 'Update password'}
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
                  <Link
                    to={email ? `/reset-password?email=${encodeURIComponent(email)}` : '/reset-password'}
                    className="mt-2 inline-block text-navy-700"
                  >
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
