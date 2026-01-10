import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Generic Error Boundary
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    console.error('Error caught by boundary:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback UI
interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
  showDetails?: boolean;
}

export function DefaultErrorFallback({
  error,
  onReset,
  showDetails = false,
}: DefaultErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
      <div className="bg-red-50 rounded-full p-4 mb-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-600 mb-6 max-w-md">
        We encountered an unexpected error. Please try again or refresh the page.
      </p>

      {showDetails && error && (
        <details className="mb-6 w-full max-w-md text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Error details
          </summary>
          <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-auto">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

// Board-specific error boundary with retry
interface BoardErrorBoundaryProps {
  children: ReactNode;
  boardId?: string;
  onRetry?: () => void;
}

interface BoardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class BoardErrorBoundary extends Component<BoardErrorBoundaryProps, BoardErrorBoundaryState> {
  constructor(props: BoardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<BoardErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Board error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: BoardErrorBoundaryProps) {
    // Reset when board changes
    if (this.state.hasError && prevProps.boardId !== this.props.boardId) {
      this.setState({
        hasError: false,
        error: null,
        retryCount: 0,
      });
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-red-50 rounded-full p-4 w-fit mx-auto mb-4">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Board Loading Error
            </h2>
            <p className="text-gray-600 mb-6">
              {this.state.error?.message || 'Failed to load the board. Please try again.'}
            </p>

            {this.state.retryCount < 3 ? (
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-3"
              >
                <RefreshCw className="h-4 w-4" />
                Retry ({3 - this.state.retryCount} attempts left)
              </button>
            ) : (
              <p className="text-sm text-red-600 mb-3">
                Maximum retry attempts reached.
              </p>
            )}

            <a
              href="/dashboard"
              className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Card modal error boundary
interface CardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface CardErrorBoundaryProps {
  children: ReactNode;
  cardId?: string;
  onClose?: () => void;
}

export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  constructor(props: CardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CardErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Card modal error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: CardErrorBoundaryProps) {
    // Reset when card changes
    if (this.state.hasError && prevProps.cardId !== this.props.cardId) {
      this.setState({
        hasError: false,
        error: null,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <div className="bg-red-50 rounded-full p-3 w-fit mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error Loading Card
          </h3>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'Failed to load card details.'}
          </p>
          <button
            onClick={this.props.onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional component error handling
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);

    // You could send to an error tracking service here
    // e.g., Sentry.captureException(error);
  };

  return { handleError };
}

// Utility to wrap async operations with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    onError?.(error as Error);
    console.error('Async operation failed:', error);
    return fallback;
  }
}
