import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8 text-center">
            <div>
              <h2 className="font-display font-bold text-2xl mb-3">حدث خطأ غير متوقع</h2>
              <p className="text-muted-foreground font-body mb-6">نعتذر عن ذلك، يرجى تحديث الصفحة</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-lg bg-accent text-accent-foreground font-display font-bold hover:-translate-y-0.5 transition-all"
              >
                تحديث الصفحة
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
