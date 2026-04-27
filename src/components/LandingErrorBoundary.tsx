import { Component, type ErrorInfo, type ReactNode } from 'react';

interface LandingErrorBoundaryProps {
  children: ReactNode;
}

interface LandingErrorBoundaryState {
  hasError: boolean;
}

export class LandingErrorBoundary extends Component<LandingErrorBoundaryProps, LandingErrorBoundaryState> {
  state: LandingErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LandingErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn('[LandingErrorBoundary] Suppressed landing page runtime error.', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen bg-slatePremium-50" />;
    }

    return this.props.children;
  }
}
