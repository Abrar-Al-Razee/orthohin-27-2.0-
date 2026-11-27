import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal ErrorBoundary caught error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyDetail =
      'A temporary connection or rendering issue occurred. Your batch database remains safe.';
    try {
      const parsed = JSON.parse(this.state.errorMessage) as { error?: string };
      if (parsed?.error) {
        if (parsed.error.toLowerCase().includes('quota exceeded')) {
          friendlyDetail =
            'Daily Firestore read quota has been reached. Quota resets automatically tomorrow.';
        } else if (parsed.error.toLowerCase().includes('permission')) {
          friendlyDetail = 'Access was denied for this operation. Please verify your admin sign-in.';
        }
      }
    } catch {
      if (this.state.errorMessage.toLowerCase().includes('quota exceeded')) {
        friendlyDetail =
          'Daily Firestore read quota has been reached. Quota resets automatically tomorrow.';
      }
    }

    return (
      <div className="min-h-screen bg-white dark:bg-[#070709] text-zinc-950 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-zinc-50 dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 p-8 text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
            Something Interrupted the View
          </h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-400 leading-relaxed">
            {friendlyDetail}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            Reload Portal
          </button>
        </div>
      </div>
    );
  }
}
