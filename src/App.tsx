import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingErrorBoundary } from './components/LandingErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { Pricing } from './pages/Pricing';

const ProtectedApp = lazy(() => import('./app/ProtectedApp').then((m) => ({ default: m.ProtectedApp })));

function PublicApp() {
  const location = useLocation();

  useEffect(() => {
    console.log('[PublicApp] Route changed', { pathname: location.pathname });
  }, [location.pathname]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingErrorBoundary>
            <LandingPage />
          </LandingErrorBoundary>
        }
      />
      <Route
        path="/pricing"
        element={
          <div className="min-h-screen bg-slatePremium-50 px-6 py-10">
            <div className="mx-auto max-w-7xl">
              <Pricing publicMode />
            </div>
          </div>
        }
      />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/reset-password" element={<AuthPage mode="reset" />} />
      <Route path="/auth/login" element={<Navigate to="/login" replace />} />
      <Route path="/auth/signup" element={<Navigate to="/signup" replace />} />
      <Route path="/auth/reset" element={<Navigate to="/reset-password" replace />} />
      <Route
        path="/app/*"
        element={
          <Suspense fallback={<div className="min-h-screen bg-slatePremium-50 p-8">Loading protected workspace...</div>}>
            <ProtectedApp />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <PublicApp />
    </BrowserRouter>
  );
}

export default App;
