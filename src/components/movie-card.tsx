import Image from "next/image";
import Link from "next/link";
import { Bookmark, Check } from "lucide-react";
import { cn, getImageUrl, getYear } from "@/lib/utils";
import { ContentMicroCaption } from "@/components/content-badge";
import { StreamingBadges } from "@/components/streaming-badges";
import type { AggregatedContentRating, StreamingProviderInfo } from "@/types";

/**
 * MovieCard — editorial poster tile.
 *
 * Design notes (warm-editorial brief):
 *   - Poster is the hero: sharp (no radius) so it reads as a photographic
 *     object, not a UI chiclet; meta below is the caption.
 *   - Title set in Fraunces (serif) at ~15px, 2-line clamp. The serif
 *     character is what makes the grid feel like an indie-film magazine
 *     page rather than a SaaS dashboard.
 *   - Content severity is a typographic micro-caption (`L2 V3 S0 F1`) not
 *     a row of colored dots — readable AND colorblind-friendlier, and keeps
 *     the editorial rhythm with titles.
 *   - Hover: 2px lift + slight background warm-up. No scale (scale is the
 *     Tailwind-tutorial fingerprint we're rejecting).
 *   - Watchlist/Watched badge is pinned to the top-right of the poster with
 *     a subtle inner ring so it reads as "sticker" not "button".
 */
export type WatchlistStatus = "watchlist" | "watched" | null;

interface MovieCardProps {
  title: string;
  slug: string;
  posterPath: string | null;
  releaseDate: string | null;
  mpaaRating: string | null;
  contentRating: AggregatedContentRating | null;
  streamingProviders: StreamingProviderInfo[];
  /** Signed-in user's status for this movie. Absent or null renders no badge. */
  watchlistStatus?: WatchlistStatus;
}

export function MovieCard({
  title,
  slug,
  posterPath,
  releaseDate,
  mpaaRating,
  contentRating,
  streamingProviders,
  watchlistStatus,
}: MovieCardProps) {
  const year = getYear(releaseDate);
  const posterUrl = getImageUrl(posterPath, "w342");

  return (
    <Link
      href={`/movies/${slug}`}
      className={cn(
        "group block transition-all duration-200",
        // 2px lift on hover — the editorial tell. No scale.
        "hover:-translate-y-0.5",
      )}
    >
      {/* Poster — sharp corners; treated as a photograph, not a card */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted ring-1 ring-border/60 transition-shadow group-hover:ring-border group-hover:shadow-xl group-hover:shadow-black/30">
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />

        {watchlistStatus && (
          <div
            className={cn(
              "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-lg ring-2 ring-background/80 backdrop-blur-sm",
              watchlistStatus === "watched"
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground",
            )}
            aria-label={
              watchlistStatus === "watched"
                ? "Already watched"
                : "On your watchlist"
            }
            title={
              watchlistStatus === "watched"
                ? "Already watched"
                : "On your watchlist"
            }
          >
            {watchlistStatus === "watched" ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <Bookmark className="h-4 w-4" fill="currentColor" />
            )}
          </div>
        )}

        {mpaaRating && (
          <span
            className="absolute bottom-2 left-2 inline-flex items-center rounded-sm bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground ring-1 ring-border/60"
            aria-label={`MPAA rating ${mpaaRating}`}
          >
            {mpaaRating}
          </span>
        )}
      </div>

      {/* Caption */}
      <div className="mt-3 space-y-1.5">
        <h3 className="font-serif text-[15px] leading-tight line-clamp-2 text-foreground">
          {title}
        </h3>

        <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
          {year && <span className="tabular-nums">{year}</span>}
        </div>

        {contentRating ? (
          <ContentMicroCaption
            languageScore={contentRating.languageScore}
            violenceScore={contentRating.violenceScore}
            sexualContentScore={contentRating.sexualContentScore}
            scaryScore={contentRating.scaryScore}
          />
        ) : (
          <span className="small-caps text-[10px] text-muted-foreground/70">
            No advisory yet
          </span>
        )}

        {streamingProviders?.length > 0 && (
          <div
            className="pt-0.5"
            onClick={(e) => e.preventDefault()}
          >
            <StreamingBadges providers={streamingProviders} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
