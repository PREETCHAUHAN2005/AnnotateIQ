"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Error boundary — catches client-side exceptions (e.g. failed fetches when the
 * dev server restarts) and shows a retry UI instead of a blank crash screen.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isFetchError = this.state.error?.message?.includes("Failed to fetch");
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center">
          <div className="rounded-full bg-foreground/10 p-4">
            <AlertTriangle className="h-8 w-8 text-foreground/60" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {isFetchError ? "Connection interrupted" : "Something went wrong"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {isFetchError
                ? "The dev server may have restarted. The connection will recover automatically — click retry."
                : this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <Button onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
