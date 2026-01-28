import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  viewName: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * A lightweight error boundary for individual views.
 * Unlike the app-level ErrorBoundary, this allows the user to
 * recover within the app context without losing navigation.
 */
export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ViewErrorBoundary [${this.props.viewName}]:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-8"
          data-testid={`view-error-${this.props.viewName}`}
        >
          <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-600"
                >
                  <path d="M8 5v4M8 12v.01" />
                  <path d="M3 14h10L8 3 3 14z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  View failed to load
                </h2>
                <p className="text-xs text-gray-500">
                  Something went wrong in {this.props.viewName}
                </p>
              </div>
            </div>

            {this.state.error && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                  Show details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={this.handleRetry}
                className="flex-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                data-testid="view-error-retry"
              >
                Retry
              </button>
              <a
                href="/"
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
