"use client";

/**
 * /admin — status dashboard + manual sync triggers.
 *
 * Editorial treatment: small-caps metric labels, Fraunces figures with
 * tabular-nums, percentage bars using the score-color tokens. No pie
 * charts. No "Database" lucide icon + heading combo — that's the generic
 * dashboard pattern we rejected in Phase 3C.
 */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OmdbStatus {
  keyPresent: boolean;
  lastFailureKind: "rate-limit" | "invalid-key" | "no-key" | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
}

interface AdminStatus {
  totalMovies: number;
  withImdbId: number;
  withRtScore: number;
  withMetacriticScore: number;
  withImdbRating: number;
  withContentRating: number;
  envOmdbKeyPresent: boolean;
  envTmdbKeyPresent: boolean;
  envOpenaiKeyPresent: boolean;
  lastSyncedAt: string | null;
  omdbStatus?: OmdbStatus;
}

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/admin/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as AdminStatus;
      setStatus(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load status";
      setStatusError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

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
        setSyncResult(`Started: ${data.message || type}`);
        setTimeout(fetchStatus, 2000);
      } else {
        setSyncResult(`Error: ${data.error || "Unknown"}`);
      }
    } catch {
      setSyncResult("Failed to trigger sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-10">
      <header className="mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
          Admin
        </h1>
        <p className="small-caps text-[11px] text-muted-foreground mt-2">
          Pipeline status · Manual triggers
        </p>
      </header>

      {/* Pipeline status */}
      <section className="mb-12 pb-10 border-b border-border">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="small-caps text-[11px] text-muted-foreground">
            Pipeline Status
          </h2>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="small-caps text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Refresh
          </button>
        </div>

        {statusError && (
          <div className="border border-destructive/30 bg-destructive/5 p-4 rounded-md text-sm text-destructive">
            Failed to load status: {statusError}
          </div>
        )}

        {status && (
          <div className="space-y-6">
            {/* Env-var presence — the most common "why is nothing working" */}
            <div className="grid grid-cols-3 gap-4">
              <EnvRow label="TMDB" present={status.envTmdbKeyPresent} />
              <EnvRow label="OMDb" present={status.envOmdbKeyPresent} />
              <EnvRow label="OpenAI" present={status.envOpenaiKeyPresent} />
            </div>

            {/* Phase 4E: circuit-breaker warning. Rendered only when the
                orchestrator's OMDb call hit a pipeline-fatal failure
                (rate-limit or key-config). Explains why RT% is stuck. */}
            {status.omdbStatus?.lastFailureKind && (
              <OmdbFailureBanner omdb={status.omdbStatus} />
            )}

            {/* Pipeline progress */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
              <Stat
                label="Total Films"
                value={status.totalMovies}
              />
              <ProgressStat
                label="With IMDb ID"
                value={status.withImdbId}
                total={status.totalMovies}
              />
              <ProgressStat
                label="Rotten Tomatoes"
                value={status.withRtScore}
                total={status.totalMovies}
              />
              <ProgressStat
                label="Metacritic"
                value={status.withMetacriticScore}
                total={status.totalMovies}
              />
              <ProgressStat
                label="IMDb Rating"
                value={status.withImdbRating}
                total={status.totalMovies}
              />
              <ProgressStat
                label="Content Advisory"
                value={status.withContentRating}
                total={status.totalMovies}
              />
            </div>

            {status.lastSyncedAt && (
              <p className="small-caps text-[10px] text-muted-foreground pt-2">
                Last enriched movie: {formatDate(status.lastSyncedAt)}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Manual triggers */}
      <section>
        <h2 className="small-caps text-[11px] text-muted-foreground mb-6">
          Manual Triggers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SyncCard
            title="Movie sync"
            description="Fetch new movies from TMDB + enrich existing movies that lack IMDb ID or Rotten Tomatoes score."
            onClick={() => triggerSync("movies")}
            disabled={syncing}
          />
          <SyncCard
            title="Content scrape"
            description="Scrape Kids-In-Mind, Common Sense Media, and IMDb Parental Guide for unrated films. Rate-limited; takes hours."
            onClick={() => triggerSync("content")}
            disabled={syncing}
          />
          <SyncCard
            title="Streaming refresh"
            description="Update which films are on which services."
            onClick={() => triggerSync("streaming")}
            disabled={syncing}
          />
          <SyncCard
            title="Full re-sync"
            description="All three in sequence. Long-running."
            onClick={() => triggerSync("full")}
            disabled={syncing}
          />
        </div>

        {syncResult && (
          <div
            className={cn(
              "mt-5 p-3 rounded-md border text-sm",
              syncResult.startsWith("Error")
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-muted/30 text-foreground",
            )}
          >
            {syncResult}
          </div>
        )}
      </section>
    </div>
  );
}

function OmdbFailureBanner({ omdb }: { omdb: OmdbStatus }) {
  const kind = omdb.lastFailureKind;
  let headline = "OMDb pipeline halted";
  let body: React.ReactNode = null;

  if (kind === "rate-limit") {
    headline = "OMDb quota exhausted";
    body = (
      <>
        Free tier = <span className="tabular-nums">1,000</span> calls/day.
        Quota resets at UTC 00:00, and the pipeline will automatically
        retry on the next scheduled sync. To backfill faster, upgrade your
        key at{" "}
        <a
          href="https://www.omdbapi.com/apikey.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-from-font underline-offset-2 hover:text-foreground"
        >
          omdbapi.com/apikey.aspx
        </a>
        .
      </>
    );
  } else if (kind === "invalid-key" || kind === "no-key") {
    headline = "OMDb key rejected";
    body = (
      <>
        OMDb returned <span className="font-mono text-[12px]">&ldquo;{omdb.lastFailureMessage}&rdquo;</span>.
        Check{" "}
        <code className="font-mono text-[12px] bg-background/60 px-1 py-0.5 rounded-sm">
          OMDB_API_KEY
        </code>{" "}
        in your <code className="font-mono text-[12px] bg-background/60 px-1 py-0.5 rounded-sm">.env</code>{" "}
        (new keys must be activated via the email OMDb sends) and restart the
        container.
      </>
    );
  }

  return (
    <div
      role="status"
      className="border-l-2 pl-4 py-3 bg-[color:var(--score-5)]/5 border-[color:var(--score-5)]"
    >
      <h3 className="font-serif text-lg text-foreground">{headline}</h3>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
        {body}
      </p>
      {omdb.lastFailureAt && (
        <p className="small-caps text-[10px] text-muted-foreground mt-2 tabular-nums">
          First tripped {formatDate(omdb.lastFailureAt)}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-3xl tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="small-caps text-[10px] text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const scoreVar = pctToScoreVar(pct);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-2xl tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="small-caps text-[10px] text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: scoreVar }}
        />
      </div>
      <div className="small-caps text-[10px] text-muted-foreground mt-1.5">
        {label}
      </div>
    </div>
  );
}

function EnvRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          present ? "bg-[var(--score-0)]" : "bg-[var(--score-5)]",
        )}
        aria-hidden="true"
      />
      <span className="small-caps text-[11px] text-foreground">
        {label}
      </span>
      <span className="small-caps text-[10px] text-muted-foreground ml-auto">
        {present ? "Set" : "Missing"}
      </span>
    </div>
  );
}

function SyncCard({
  title,
  description,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border border-border p-5 rounded-md space-y-3">
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
        <RefreshCw
          className={cn("h-4 w-4", disabled && "animate-spin")}
        />
        {disabled ? "Syncing…" : "Run"}
      </Button>
    </div>
  );
}

/**
 * Map a completion percentage to the content-severity color scale, but
 * INVERTED — low completion = bad (red), high = good (green). Uses the
 * same `--score-N` tokens so the dashboard stays on the warm palette.
 */
function pctToScoreVar(pct: number): string {
  if (pct >= 90) return "var(--score-0)";
  if (pct >= 75) return "var(--score-1)";
  if (pct >= 50) return "var(--score-2)";
  if (pct >= 25) return "var(--score-3)";
  if (pct >= 10) return "var(--score-4)";
  return "var(--score-5)";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
