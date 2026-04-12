"use client";

/**
 * /recommendations — AI-picked films for the signed-in user.
 *
 * Editorial treatment:
 *   - Fraunces 6xl "For You" masthead with a small-caps dateline
 *     ("CURATED · APR 12") that reads like a magazine issue marker.
 *   - Each pick = left-poster + right-column rationale block. Title in
 *     Fraunces, year + genres small-caps, rationale in serif at 15px
 *     so the AI's sentence reads as a byline blurb, not a chatbot reply.
 *   - "Because you enjoyed X, and Y lives on your Netflix" style of
 *     copy is produced by the model itself (see prompt in
 *     lib/recommendations/server.ts); we just typeset it properly.
 *   - Empty states are never alerts. "Nothing to curate yet" is a
 *     warm paper block with a Fraunces headline and a quiet prompt to
 *     mark some films watched first.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn, getImageUrl } from "@/lib/utils";
import { ContentMicroCaption } from "@/components/content-badge";

interface RecommendationPick {
  id: number;
  title: string;
  slug: string;
  posterPath: string | null;
  year: string | null;
  mpaaRating: string | null;
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
  genres: string[];
  overview: string | null;
  contentScores: {
    language: number | null;
    violence: number | null;
    sexual: number | null;
    scary: number | null;
  };
  reason: string;
}

type Response =
  | { kind: "ok"; picks: RecommendationPick[]; pickedAt: string; fromCache: boolean }
  | { kind: "disabled" }
  | { kind: "empty-history" }
  | { kind: "error"; error?: string; details?: string };

export default function RecommendationsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/recommendations", { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json()) as Response;
        setData(body);
      })
      .catch((e) => {
        setData({ kind: "error", error: e instanceof Error ? e.message : "Unknown error" });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-5xl py-10">
      <header className="mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
          For You
        </h1>
        <p className="small-caps text-[11px] text-muted-foreground mt-2">
          {data?.kind === "ok" && data.pickedAt
            ? `Curated · ${formatDateline(data.pickedAt)}`
            : "Curated · Today"}
        </p>
      </header>

      {loading && (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-6 animate-pulse"
            >
              <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 bg-muted ring-1 ring-border/60" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-6 bg-muted-foreground/15 rounded w-2/3" />
                <div className="h-3 bg-muted-foreground/10 rounded w-1/3" />
                <div className="h-4 bg-muted-foreground/10 rounded w-full" />
                <div className="h-4 bg-muted-foreground/10 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && data?.kind === "disabled" && (
        <EmptyBlock
          headline="Recommendations aren't configured"
          body={
            <>
              This server is missing the <code className="font-mono text-[12px] bg-muted px-1 py-0.5 rounded-sm">OPENAI_API_KEY</code>{" "}
              environment variable. Add one to your{" "}
              <code className="font-mono text-[12px] bg-muted px-1 py-0.5 rounded-sm">.env</code>{" "}
              and restart the container to enable this page.
            </>
          }
        />
      )}

      {!loading && data?.kind === "empty-history" && (
        <EmptyBlock
          headline="Nothing to curate yet"
          body={
            <>
              Mark a handful of films you&apos;ve seen as{" "}
              <span className="small-caps text-foreground">Watched</span> and we&apos;ll
              start recommending based on your taste.
            </>
          }
        />
      )}

      {!loading && data?.kind === "error" && (
        <EmptyBlock
          headline="Something went wrong"
          body={data.details ?? data.error ?? "Try again in a minute."}
        />
      )}

      {!loading && data?.kind === "ok" && data.picks.length === 0 && (
        <EmptyBlock
          headline="No picks this round"
          body="The curator couldn't find films that suit you on your current services + thresholds. Try loosening a content slider or adding another streaming service."
        />
      )}

      {!loading && data?.kind === "ok" && data.picks.length > 0 && (
        <div className="space-y-12 sm:space-y-16">
          {data.picks.map((pick) => (
            <PickRow key={pick.id} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}

function PickRow({ pick }: { pick: RecommendationPick }) {
  return (
    <Link
      href={`/movies/${pick.slug}`}
      className="group block grid grid-cols-[theme(spacing.28)_1fr] sm:grid-cols-[theme(spacing.36)_1fr] gap-5 sm:gap-8"
    >
      <div className="aspect-[2/3] relative bg-muted ring-1 ring-border/60 overflow-hidden transition-shadow group-hover:ring-border group-hover:shadow-xl group-hover:shadow-black/30">
        <Image
          src={getImageUrl(pick.posterPath, "w342")}
          alt={pick.title}
          fill
          sizes="(max-width: 640px) 112px, 144px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 space-y-2 sm:space-y-3">
        <h2 className="font-serif text-2xl sm:text-3xl leading-tight tracking-tight">
          {pick.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 small-caps text-[10px] text-muted-foreground">
          {pick.year && <span className="tabular-nums">{pick.year}</span>}
          {pick.mpaaRating && <span>{pick.mpaaRating}</span>}
          {pick.genres.slice(0, 3).map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>

        {/* Rationale — the editorial heart of the page */}
        <p className="font-serif text-[15px] leading-relaxed text-foreground/90 max-w-prose">
          {pick.reason}
        </p>

        <div className="flex items-center gap-4 pt-1">
          {pick.contentScores.language !== null && (
            <ContentMicroCaption
              languageScore={pick.contentScores.language ?? 0}
              violenceScore={pick.contentScores.violence ?? 0}
              sexualContentScore={pick.contentScores.sexual ?? 0}
              scaryScore={pick.contentScores.scary ?? 0}
            />
          )}
          {pick.imdbRating !== null && (
            <span className="small-caps text-[10px] text-muted-foreground tabular-nums">
              IMDb {pick.imdbRating.toFixed(1)}
            </span>
          )}
          {pick.rottenTomatoesScore !== null && (
            <span className="small-caps text-[10px] text-muted-foreground tabular-nums">
              RT {pick.rottenTomatoesScore}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyBlock({
  headline,
  body,
}: {
  headline: string;
  body: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border border-dashed border-border bg-muted/30 p-10 text-center",
      )}
    >
      <h2 className="font-serif text-2xl sm:text-3xl">{headline}</h2>
      <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function formatDateline(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Today";
  }
}
