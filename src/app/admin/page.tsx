"use client";

import { useState } from "react";
import { RefreshCw, Database, AlertCircle } from "lucide-react";

export default function AdminPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const triggerSync = async (type: string) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Sync started: ${data.message || type}`);
      } else {
        setSyncResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch {
      setSyncResult("Failed to trigger sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-3xl py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Admin</h1>
      <p className="text-muted-foreground mb-8">
        Manage data sync and content ratings.
      </p>

      {/* Sync Controls */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Data Sync</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SyncCard
            title="Full Movie Sync"
            description="Fetch popular movies from TMDB, enrich with OMDb ratings, and update streaming availability."
            buttonText="Sync Movies"
            onClick={() => triggerSync("movies")}
            disabled={syncing}
          />
          <SyncCard
            title="Content Rating Scrape"
            description="Scrape Kids-In-Mind, Common Sense Media, and IMDb for content ratings on movies missing ratings."
            buttonText="Scrape Ratings"
            onClick={() => triggerSync("content")}
            disabled={syncing}
          />
          <SyncCard
            title="Streaming Availability"
            description="Refresh which streaming services have each movie."
            buttonText="Update Availability"
            onClick={() => triggerSync("streaming")}
            disabled={syncing}
          />
          <SyncCard
            title="Full Re-sync"
            description="Run all sync tasks: movies, ratings, and streaming. This may take a while."
            buttonText="Full Sync"
            onClick={() => triggerSync("full")}
            disabled={syncing}
          />
        </div>

        {syncResult && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              syncResult.includes("Error")
                ? "border-destructive/50 bg-destructive/5 text-destructive"
                : "border-score-green/50 bg-score-green/5 text-score-green"
            }`}
          >
            <div className="flex items-center gap-2">
              {syncResult.includes("Error") ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="text-sm">{syncResult}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SyncCard({
  title,
  description,
  buttonText,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${disabled ? "animate-spin" : ""}`} />
        {disabled ? "Syncing..." : buttonText}
      </button>
    </div>
  );
}
