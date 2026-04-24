"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MoviesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-24 text-center">
      <h1 className="font-serif text-4xl sm:text-5xl">Something went wrong</h1>
      <p className="text-muted-foreground mt-4 max-w-prose mx-auto">
        We hit an unexpected error loading films. This has been logged
        automatically.
      </p>
      {error.digest && (
        <p className="text-[10px] small-caps text-muted-foreground mt-2 tabular-nums">
          Error {error.digest}
        </p>
      )}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Link
          href="/movies"
          className="inline-flex items-center gap-2 text-sm small-caps text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Browse
        </Link>
      </div>
    </div>
  );
}
