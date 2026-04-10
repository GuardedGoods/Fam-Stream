import Image from "next/image";
import Link from "next/link";
import { cn, getImageUrl, getYear } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ContentDot } from "@/components/content-badge";
import { StreamingBadges } from "@/components/streaming-badges";
import type { AggregatedContentRating, StreamingProviderInfo } from "@/types";

interface MovieCardProps {
  title: string;
  slug: string;
  posterPath: string | null;
  releaseDate: string | null;
  mpaaRating: string | null;
  contentRating: AggregatedContentRating | null;
  streamingProviders: StreamingProviderInfo[];
}

export function MovieCard({
  title,
  slug,
  posterPath,
  releaseDate,
  mpaaRating,
  contentRating,
  streamingProviders,
}: MovieCardProps) {
  const year = getYear(releaseDate);
  const posterUrl = getImageUrl(posterPath, "w342");

  return (
    <Link
      href={`/movies/${slug}`}
      className="group block rounded-lg overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="p-2 space-y-1.5">
        {/* Title */}
        <h3 className="text-sm font-medium leading-tight line-clamp-2 text-gray-900 dark:text-gray-100">
          {title}
        </h3>

        {/* Year + MPAA */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {year && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {year}
            </span>
          )}
          {mpaaRating && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {mpaaRating}
            </Badge>
          )}
        </div>

        {/* Content rating dots */}
        {contentRating ? (
          <div className="flex items-center gap-1" title="L / V / S / Scary">
            <ContentDot score={contentRating.languageScore} />
            <ContentDot score={contentRating.violenceScore} />
            <ContentDot score={contentRating.sexualContentScore} />
            <ContentDot score={contentRating.scaryScore} />
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
          >
            Unrated
          </Badge>
        )}

        {/* Streaming providers */}
        {streamingProviders.length > 0 && (
          <div onClick={(e) => e.preventDefault()}>
            <StreamingBadges providers={streamingProviders} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
