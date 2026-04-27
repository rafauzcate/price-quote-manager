import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  isAuthReady: boolean;
  user: User | null;
  children: ReactNode;
}

export function ProtectedRoute({ isAuthReady, user, children }: ProtectedRouteProps) {
  if (!isAuthReady) {
    return <div className="min-h-screen bg-slatePremium-50 p-8">Checking authentication...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
