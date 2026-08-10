import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  // Optional: label shown in the fallback so you know which part of the
  // app crashed (e.g. "Dashboard", "Task Detail").
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Wrap any page/route in this to stop a render-time crash (e.g. calling
// .map() on an undefined field from the API) from blanking the whole
// screen. React error boundaries only catch errors during render, in
// lifecycle methods, and in constructors of the tree below them — they do
// NOT catch errors in event handlers or async code, so keep try/catch in
// those spots too.
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Swap for your logging/monitoring tool if you have one (Sentry, etc.)
    console.error(`[ErrorBoundary${this.props.section ? ` — ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="font-display text-lg font-bold mb-1">
            {this.props.section ? `${this.props.section} hit an error` : "Something went wrong"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {this.state.error?.message || "This section couldn't be displayed. You can try again or go back."}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;