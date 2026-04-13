import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Calendar, ShieldCheck } from "lucide-react";
import { ContentBadge } from "@/components/content-badge";
import { StreamingBadges } from "@/components/streaming-badges";
import { WatchlistButton } from "@/components/watchlist-button";
import { MovieCast, type CastRow } from "@/components/movie-cast";
import { SourceBreakdown } from "@/components/source-breakdown";
import { getImageUrl, getYear, formatRuntime } from "@/lib/utils";
import { maskProfanity } from "@/lib/filters/mask";
import type { StreamingProviderInfo } from "@/types";
import { db } from "@/lib/db";
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
  movieCast,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getUserMovieStatus } from "@/lib/watchlist/server";

function getMovie(slug: string) {
  const movie = db
    .select()
    .from(movies)
    .where(eq(movies.slug, slug))
    .get();

  if (!movie) return null;

  // Phase 4G diagnostic wrapping — each sub-query isolated so an exception
  // in one doesn't 500 the whole detail page. Three detail pages
  // (ids 1/2/3/6/7) were reliably 500ing with Next.js error digest
  // "2877816754" after Phase 4F deploy, and without docker logs access
  // we couldn't see which query threw. Now each failure logs its own
  // tagged error line, the page degrades to empty sections, and the
  // surrounding render still succeeds.

  let aggregated: typeof contentRatingsAggregated.$inferSelect | undefined;
  try {
    aggregated = db
      .select()
      .from(contentRatingsAggregated)
      .where(eq(contentRatingsAggregated.movieId, movie.id))
      .get();
  } catch (e) {
    console.error(
      `[movie-detail:aggregated] ${movie.slug} id=${movie.id}:`,
      e instanceof Error ? e.message : e,
    );
  }

  let sources: Array<typeof contentRatings.$inferSelect> = [];
  try {
    sources = db
      .select()
      .from(contentRatings)
      .where(eq(contentRatings.movieId, movie.id))
      .all();
  } catch (e) {
    console.error(
      `[movie-detail:sources] ${movie.slug} id=${movie.id}:`,
      e instanceof Error ? e.message : e,
    );
  }

  let providers: Array<{
    id: number;
    name: string;
    logoPath: string | null;
    type: string;
    link: string | null;
  }> = [];
  try {
    providers = db
      .select({
        id: streamingProviders.id,
        name: streamingProviders.name,
        logoPath: streamingProviders.logoPath,
        type: movieProviders.type,
        link: movieProviders.link,
      })
      .from(movieProviders)
      .innerJoin(
        streamingProviders,
        eq(movieProviders.providerId, streamingProviders.id),
      )
      .where(eq(movieProviders.movieId, movie.id))
      .all();
  } catch (e) {
    console.error(
      `[movie-detail:providers] ${movie.slug} id=${movie.id}:`,
      e instanceof Error ? e.message : e,
    );
  }

  // Phase 4C — pull cast + director/writers. Cast sorted by billing order
  // (lead first), crew trails (isCrew=1) regardless of order. SQLite puts
  // NULL first in ASC, but since we order by isCrew first, all cast rows
  // land before all crew rows, so the NULL-castOrder crew rows end up in
  // their own group. Simple column ordering — was previously a CASE
  // expression wrapped in `sql`, which introduced a detail-page regression
  // in a subset of prod environments (Phase 4F).
  //
  // Wrapped in try/catch: if the `movie_cast` table migration failed
  // (happened once on an in-place rebuild) or the query hits some edge
  // case, the detail page still renders with an empty cast strip rather
  // than 500-ing the whole page. The MovieCast component returns null
  // on an empty array, so this degrades gracefully.
  let castRows: Array<{
    name: string;
    character: string | null;
    profilePath: string | null;
    castOrder: number | null;
    isCrew: number | null;
    crewJob: string | null;
  }> = [];
  try {
    castRows = db
      .select({
        name: movieCast.name,
        character: movieCast.character,
        profilePath: movieCast.profilePath,
        castOrder: movieCast.castOrder,
        isCrew: movieCast.isCrew,
        crewJob: movieCast.crewJob,
      })
      .from(movieCast)
      .where(eq(movieCast.movieId, movie.id))
      .orderBy(asc(movieCast.isCrew), asc(movieCast.castOrder))
      .all();
  } catch (e) {
    console.error(
      `[movie-detail] cast query failed for ${movie.slug}:`,
      e instanceof Error ? e.message : e,
    );
  }

  // Parse specificWords — supports both old format (string[]) and new format ({word: count})
  let specificWords: string[] = [];
  let profanityWordCounts: Record<string, number> = {};
  if (aggregated?.specificWords) {
    try {
      const parsed = JSON.parse(aggregated.specificWords);
      if (Array.isArray(parsed)) {
        specificWords = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        profanityWordCounts = parsed;
        specificWords = Object.keys(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }

  // Find recommended age from any source
  const recommendedAge = sources.find((s) => s.recommendedAge)?.recommendedAge ?? null;

  let parsedGenres: string[] = [];
  try {
    parsedGenres = movie.genres ? JSON.parse(movie.genres) : [];
  } catch {
    parsedGenres = [];
  }

  return {
    ...movie,
    genres: parsedGenres,
    contentRating: aggregated
      ? {
          languageScore: aggregated.languageScore,
          violenceScore: aggregated.violenceScore,
          sexualContentScore: aggregated.sexualContentScore,
          scaryScore: aggregated.scaryScore,
          languageNotes: aggregated.languageNotes,
          violenceNotes: aggregated.violenceNotes,
          sexualNotes: aggregated.sexualNotes,
          scaryNotes: aggregated.scaryNotes,
          specificWords,
          profanityWordCounts,
        }
      : null,
    recommendedAge,
    contentSources: sources.map((s) => ({
      source: s.source,
      languageScore: s.languageScore,
      violenceScore: s.violenceScore,
      sexualContentScore: s.sexualContentScore,
      scaryScore: s.scaryScore,
      languageNotes: s.languageNotes,
      violenceNotes: s.violenceNotes,
      sexualNotes: s.sexualNotes,
      scaryNotes: s.scaryNotes,
      profanityWords: (() => { try { return s.profanityWords ? JSON.parse(s.profanityWords) : {}; } catch { return {}; } })(),
      recommendedAge: s.recommendedAge,
      sourceUrl: s.sourceUrl,
    })),
    streamingProviders: providers as StreamingProviderInfo[],
    cast: castRows.map((row) => ({
      name: row.name,
      character: row.character,
      profilePath: row.profilePath,
      castOrder: row.castOrder,
      isCrew: row.isCrew ?? 0,
      crewJob: row.crewJob,
    })) as CastRow[],
  };
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Phase 4G — wrap the whole data fetch in an outer try/catch so that a
  // malformed DB row or unexpected shape ends in a friendly fallback
  // rather than Next.js's "Application error" generic 500. The getMovie
  // sub-queries are now individually try/caught too, but this is the
  // safety net for anything thrown during the fallthrough mappers
  // (JSON.parse inside contentSources, getUserMovieStatus, etc.).
  let movie: ReturnType<typeof getMovie> = null;
  let currentStatus: Awaited<ReturnType<typeof getUserMovieStatus>> = null;
  let loadError: string | null = null;
  try {
    movie = getMovie(slug);
    if (movie) {
      currentStatus = await getUserMovieStatus(movie.id);
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error(
      `[movie-detail:fatal] slug=${slug}:`,
      e instanceof Error ? e.stack ?? e.message : e,
    );
  }

  if (loadError) {
    // Degrade to a soft error page rather than throwing further up —
    // user gets a readable page + Back to Browse instead of a browser
    // hard-error. The tagged stack is in the container logs for us to
    // diagnose.
    return (
      <div className="container mx-auto px-4 max-w-3xl py-24 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">Unable to load</h1>
        <p className="text-muted-foreground mt-4 max-w-prose mx-auto">
          We hit an unexpected error rendering this film. It&apos;s been logged
          and we&apos;ll look into it.
        </p>
        <Link
          href="/movies"
          className="inline-flex items-center gap-2 mt-8 text-sm small-caps text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Browse
        </Link>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="container mx-auto px-4 max-w-3xl py-24 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">Not found</h1>
        <p className="text-muted-foreground mt-4 max-w-prose mx-auto">
          We couldn&apos;t find that film. It may not be in our database yet —
          check back once the content sync has caught up.
        </p>
        <Link
          href="/movies"
          className="inline-flex items-center gap-2 mt-8 text-sm small-caps text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Browse
        </Link>
      </div>
    );
  }

  const contentRating = movie.contentRating;
  const hasRating = contentRating !== null;

  return (
    <div className="min-h-screen">
      {/* Backdrop — fades into paper, not a harsh scrim. Serves as warm
          context for the poster below, then gets out of the way. */}
      {movie.backdropPath && (
        <div className="relative h-72 md:h-96 lg:h-[28rem] w-full overflow-hidden">
          <Image
            src={getImageUrl(movie.backdropPath, "w1280")}
            alt=""
            fill
            className="object-cover opacity-70"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
        <div
          className={`flex flex-col md:flex-row gap-8 md:gap-12 ${movie.backdropPath ? "-mt-40 relative z-10" : "pt-10"}`}
        >
          {/* Poster — sharp, photographic, generous margin */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="relative w-48 md:w-64 aspect-[2/3] overflow-hidden shadow-2xl ring-1 ring-border/80">
              <Image
                src={getImageUrl(movie.posterPath, "w500")}
                alt={movie.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Masthead */}
          <div className="flex-1 space-y-5 min-w-0">
            <Link
              href="/movies"
              className="inline-flex items-center gap-1 small-caps text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Browse
            </Link>

            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
              {movie.title}
            </h1>

            {/* Meta — small-caps rule with serif interpuncts for rhythm */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              {movie.releaseDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="tabular-nums">
                    {getYear(movie.releaseDate)}
                  </span>
                </span>
              )}
              {movie.runtimeMinutes && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="tabular-nums">
                    {formatRuntime(movie.runtimeMinutes)}
                  </span>
                </span>
              )}
              {movie.mpaaRating && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border font-semibold text-foreground text-xs tracking-wide">
                  {movie.mpaaRating}
                </span>
              )}
              {movie.recommendedAge && (
                <span className="inline-flex items-center gap-1 small-caps text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ages {movie.recommendedAge}+
                </span>
              )}
              {(movie.genres as string[]).map((g: string) => (
                <span
                  key={g}
                  className="text-[12px] small-caps text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Ratings — editorial typographic stats, no colored pills */}
            {(movie.imdbRating ||
              movie.rottenTomatoesScore ||
              movie.metacriticScore) && (
              <div className="flex items-stretch gap-6 border-y border-border py-4">
                {movie.imdbRating !== null &&
                  movie.imdbRating !== undefined && (
                    <Stat
                      value={movie.imdbRating.toFixed(1)}
                      label="IMDb"
                      suffix=""
                    />
                  )}
                {movie.rottenTomatoesScore !== null &&
                  movie.rottenTomatoesScore !== undefined && (
                    <Stat
                      value={String(movie.rottenTomatoesScore)}
                      label="Rotten Tomatoes"
                      suffix="%"
                    />
                  )}
                {movie.metacriticScore !== null &&
                  movie.metacriticScore !== undefined && (
                    <Stat
                      value={String(movie.metacriticScore)}
                      label="Metacritic"
                      suffix=""
                    />
                  )}
              </div>
            )}

            {movie.overview && (
              <p className="font-serif text-[17px] leading-relaxed text-foreground/90 max-w-prose">
                {movie.overview}
              </p>
            )}

            <WatchlistButton
              movieId={movie.id}
              currentStatus={currentStatus}
            />
          </div>
        </div>

        {/* Content Advisory */}
        <section className="mt-16 space-y-6">
          <h2 className="small-caps text-[12px] text-muted-foreground">
            Content Advisory
          </h2>

          {hasRating ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ContentBadge
                score={contentRating.languageScore ?? 0}
                label="Language"
                size="md"
              />
              <ContentBadge
                score={contentRating.violenceScore ?? 0}
                label="Violence"
                size="md"
              />
              <ContentBadge
                score={contentRating.sexualContentScore ?? 0}
                label="Sexual Content"
                size="md"
              />
              <ContentBadge
                score={contentRating.scaryScore ?? 0}
                label="Frightening"
                size="md"
              />
            </div>
          ) : (
            <div className="border border-dashed border-border bg-muted/30 p-6 text-center">
              <p className="font-serif text-lg text-foreground">
                Not yet rated
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Content ratings haven&apos;t been collected for this film yet.
                They&apos;ll be fetched automatically in the background —
                check back shortly.
              </p>
            </div>
          )}

          {/* Specific language found with counts — rendered with the
              mask helper so the UI doesn't enumerate every bad word verbatim
              while still communicating WHAT was found. The tooltip shows
              the raw word + count on hover. */}
          {hasRating &&
            contentRating.specificWords &&
            contentRating.specificWords.length > 0 && (
              <div className="border-t border-border pt-5">
                <h3 className="small-caps text-[11px] text-muted-foreground mb-3">
                  Specific Language Found
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {contentRating.specificWords.map((word: string) => {
                    const count = contentRating.profanityWordCounts[word];
                    return (
                      <span
                        key={word}
                        title={`${word}${count && count > 1 ? ` — ${count}×` : ""}`}
                        className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-sm"
                      >
                        <span>{maskProfanity(word)}</span>
                        {count && count > 1 && (
                          <span className="text-destructive/70 tabular-nums">
                            ×{count}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Detailed notes — editorial two-column, subtle dividers */}
          {hasRating && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              {contentRating.languageNotes && (
                <DetailCard label="Language" text={contentRating.languageNotes} />
              )}
              {contentRating.violenceNotes && (
                <DetailCard label="Violence" text={contentRating.violenceNotes} />
              )}
              {contentRating.sexualNotes && (
                <DetailCard
                  label="Sexual Content"
                  text={contentRating.sexualNotes}
                />
              )}
              {contentRating.scaryNotes && (
                <DetailCard label="Frightening" text={contentRating.scaryNotes} />
              )}
            </div>
          )}
        </section>

        {/* Cast & Crew — editorial strip, director line above */}
        <MovieCast cast={movie.cast} />

        {/* Where to Watch */}
        {movie.streamingProviders && movie.streamingProviders.length > 0 && (
          <section className="mt-16 space-y-5">
            <h2 className="small-caps text-[12px] text-muted-foreground">
              Where to Watch
            </h2>
            <StreamingBadges providers={movie.streamingProviders} />
          </section>
        )}

        {/* Per-Source Content Breakdown — extracted to a Client Component
            in 4H because its `onClick={e.stopPropagation()}` on the source
            link couldn't cross the server/client boundary (Next.js error
            digest 2877816754 for every movie that had source URLs). */}
        <SourceBreakdown sources={movie.contentSources ?? []} />
      </div>
    </div>
  );
}

/**
 * Editorial stat — a single large figure with a small-caps label below.
 * Used for IMDb / RT / Metacritic scores. No colored pill chrome.
 */
function Stat({
  value,
  label,
  suffix,
}: {
  value: string;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-start">
      <div className="font-serif text-2xl leading-none tabular-nums">
        {value}
        {suffix && (
          <span className="text-xl text-muted-foreground">{suffix}</span>
        )}
      </div>
      <div className="small-caps text-[10px] text-muted-foreground mt-1.5">
        {label}
      </div>
    </div>
  );
}

/**
 * Labeled paragraph of scraped detail text. Editorial: tiny small-caps
 * label rule across the top, then body in Fraunces so it reads as an
 * inline article rather than a form-filled card.
 */
function DetailCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-t border-border pt-4">
      <h3 className="small-caps text-[10px] text-muted-foreground mb-2">
        {label}
      </h3>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/90">
        {text}
      </p>
    </div>
  );
}

