import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { ContentBadge } from "@/components/content-badge";
import { StreamingBadges } from "@/components/streaming-badges";
import { WatchlistButton } from "@/components/watchlist-button";
import { getImageUrl, getYear, formatRuntime } from "@/lib/utils";
import type { StreamingProviderInfo } from "@/types";
import { db } from "@/lib/db";
import {
  movies,
  contentRatings,
  contentRatingsAggregated,
  movieProviders,
  streamingProviders,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getMovie(slug: string) {
  const movie = db
    .select()
    .from(movies)
    .where(eq(movies.slug, slug))
    .get();

  if (!movie) return null;

  const aggregated = db
    .select()
    .from(contentRatingsAggregated)
    .where(eq(contentRatingsAggregated.movieId, movie.id))
    .get();

  const sources = db
    .select()
    .from(contentRatings)
    .where(eq(contentRatings.movieId, movie.id))
    .all();

  const providers = db
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
      eq(movieProviders.providerId, streamingProviders.id)
    )
    .where(eq(movieProviders.movieId, movie.id))
    .all();

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
  };
}

function formatSourceName(source: string): string {
  switch (source) {
    case "kids-in-mind": return "Kids-In-Mind";
    case "imdb": return "IMDb Parental Guide";
    case "common-sense-media": return "Common Sense Media";
    default: return source;
  }
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const movie = getMovie(slug);

  if (!movie) {
    return (
      <div className="container mx-auto px-4 max-w-6xl py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Movie Not Found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t find that movie. It may not be in our database yet.
        </p>
        <Link
          href="/movies"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse
        </Link>
      </div>
    );
  }

  const contentRating = movie.contentRating;
  const hasRating = contentRating !== null;

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      {movie.backdropPath && (
        <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden">
          <Image
            src={getImageUrl(movie.backdropPath, "w1280")}
            alt={movie.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
      )}

      <div className="container mx-auto px-4 max-w-6xl">
        <div className={`flex flex-col md:flex-row gap-8 ${movie.backdropPath ? "-mt-32 relative z-10" : "pt-8"}`}>
          {/* Poster */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-border">
              <Image
                src={getImageUrl(movie.posterPath, "w500")}
                alt={movie.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <Link
              href="/movies"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Browse
            </Link>

            <h1 className="text-3xl md:text-4xl font-bold">{movie.title}</h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {movie.releaseDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {getYear(movie.releaseDate)}
                </span>
              )}
              {movie.runtimeMinutes && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRuntime(movie.runtimeMinutes)}
                </span>
              )}
              {movie.mpaaRating && (
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-border font-medium text-foreground">
                  {movie.mpaaRating}
                </span>
              )}
              {movie.recommendedAge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ages {movie.recommendedAge}+
                </span>
              )}
              {(movie.genres as string[]).map((g: string) => (
                <span
                  key={g}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Ratings */}
            <div className="flex flex-wrap gap-4">
              {movie.imdbRating && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold">{movie.imdbRating}</span>
                  <span className="text-xs text-muted-foreground">IMDb</span>
                </div>
              )}
              {movie.rottenTomatoesScore !== null &&
                movie.rottenTomatoesScore !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="font-bold">
                      {movie.rottenTomatoesScore}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Rotten Tomatoes
                    </span>
                  </div>
                )}
              {movie.metacriticScore !== null &&
                movie.metacriticScore !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="font-bold text-green-600">
                      {movie.metacriticScore}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Metacritic
                    </span>
                  </div>
                )}
            </div>

            {/* Overview */}
            {movie.overview && (
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                {movie.overview}
              </p>
            )}

            {/* Watchlist Button */}
            <WatchlistButton
              movieId={movie.id}
              currentStatus={null}
            />
          </div>
        </div>

        {/* Content Advisory Section */}
        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold">Content Advisory</h2>

          {hasRating ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                label="Scary/Intense"
                size="md"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-6 text-center">
              <p className="text-muted-foreground">
                Content ratings haven&apos;t been collected for this movie yet.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ratings will be fetched automatically in the background.
              </p>
            </div>
          )}

          {/* Specific language found with counts */}
          {hasRating &&
            contentRating.specificWords &&
            contentRating.specificWords.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold mb-2">Specific Language Found</h3>
                <div className="flex flex-wrap gap-2">
                  {contentRating.specificWords.map((word: string) => {
                    const count = contentRating.profanityWordCounts[word];
                    return (
                      <span
                        key={word}
                        className="inline-flex items-center px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium"
                      >
                        {word}{count && count > 1 ? ` (${count}\u00d7)` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Detailed notes */}
          {hasRating && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentRating.languageNotes && (
                <DetailCard title="Language Details" text={contentRating.languageNotes} />
              )}
              {contentRating.violenceNotes && (
                <DetailCard title="Violence Details" text={contentRating.violenceNotes} />
              )}
              {contentRating.sexualNotes && (
                <DetailCard title="Sexual Content Details" text={contentRating.sexualNotes} />
              )}
              {contentRating.scaryNotes && (
                <DetailCard title="Scary/Intense Details" text={contentRating.scaryNotes} />
              )}
            </div>
          )}
        </section>

        {/* Where to Watch */}
        {movie.streamingProviders && movie.streamingProviders.length > 0 && (
          <section className="mt-12 space-y-4">
            <h2 className="text-2xl font-bold">Where to Watch</h2>
            <StreamingBadges providers={movie.streamingProviders} />
          </section>
        )}

        {/* Per-Source Content Breakdown */}
        {movie.contentSources && movie.contentSources.length > 0 && (
          <section className="mt-12 mb-12 space-y-4">
            <h2 className="text-xl font-bold">Ratings by Source</h2>
            <div className="space-y-3">
              {movie.contentSources.map(
                (source: {
                  source: string;
                  languageScore: number | null;
                  violenceScore: number | null;
                  sexualContentScore: number | null;
                  scaryScore: number | null;
                  languageNotes: string | null;
                  violenceNotes: string | null;
                  sexualNotes: string | null;
                  scaryNotes: string | null;
                  profanityWords: Record<string, number>;
                  recommendedAge: number | null;
                  sourceUrl: string | null;
                }) => (
                  <details
                    key={source.source}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">
                          {formatSourceName(source.source)}
                        </span>
                        {source.recommendedAge && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            Ages {source.recommendedAge}+
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {source.languageScore !== null && (
                          <ContentBadge score={source.languageScore} label="L" size="sm" />
                        )}
                        {source.violenceScore !== null && (
                          <ContentBadge score={source.violenceScore} label="V" size="sm" />
                        )}
                        {source.sexualContentScore !== null && (
                          <ContentBadge score={source.sexualContentScore} label="S" size="sm" />
                        )}
                        {source.scaryScore !== null && (
                          <ContentBadge score={source.scaryScore} label="Sc" size="sm" />
                        )}
                        {source.sourceUrl && (
                          <a
                            href={source.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline ml-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </summary>
                    <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                      {/* Profanity words from this source */}
                      {Object.keys(source.profanityWords).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Language found:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(source.profanityWords).map(([word, count]) => (
                              <span
                                key={word}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs"
                              >
                                {word}{(count as number) > 1 ? ` (${count}\u00d7)` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {source.languageNotes && (
                        <NoteBlock label="Language" text={source.languageNotes} />
                      )}
                      {source.violenceNotes && (
                        <NoteBlock label="Violence" text={source.violenceNotes} />
                      )}
                      {source.sexualNotes && (
                        <NoteBlock label="Sexual Content" text={source.sexualNotes} />
                      )}
                      {source.scaryNotes && (
                        <NoteBlock label="Scary/Intense" text={source.scaryNotes} />
                      )}
                    </div>
                  </details>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DetailCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-0.5">{label}:</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
