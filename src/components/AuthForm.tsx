import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-1/2 bg-contain bg-center bg-no-repeat relative"
        style={{
          backgroundImage: 'url(/Gemini_Generated_Image_9f22oy9f22oy9f22.png)',
          backgroundColor: '#1a1a2e'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-50/5"></div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-slate-50 p-8 lg:p-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex flex-col items-center mb-8">
              <Logo />
              <p className="text-gray-600 mt-4">
                {isLogin ? 'Sign in to continue' : 'Create your account'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                    {isLogin ? 'Sign In' : 'Sign Up'}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">
              VantagePM: Your Strategic Partner in Procurement Intelligence
            </h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Stop losing hours to the "inbox crawl." VantagePM is your AI-powered assistant designed to transform fragmented supplier quotations into a unified, searchable asset. We turn manual data entry into instant project clarity.
            </p>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">The Vantage Workflow:</h3>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">Define</h4>
                    <p className="text-slate-600 text-sm">Assign a unique reference to your project for seamless organization.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">Import</h4>
                    <p className="text-slate-600 text-sm">Drag-and-drop complex PDFs, spreadsheets, or raw email text directly into the portal.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">Synthesize</h4>
                    <p className="text-slate-600 text-sm">Our AI instantly indexes every line item and lead time, generating a unique Vantage Part Number for every entry in your private database.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
