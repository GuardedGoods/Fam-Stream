import Image from "next/image";
import { cn, getImageUrl } from "@/lib/utils";

/**
 * <MovieCast/> — editorial cast strip on the detail page.
 *
 * Design notes (warm-editorial brief):
 *   - Director(s) rendered as a quiet "Directed by" serif line ABOVE the
 *     cast strip. Writers trail after Director if present. Typographic,
 *     not avatars — readers care more about the name than the face.
 *   - Cast tiles: circular headshot (74px), actor name in Fraunces,
 *     character in small-caps beneath. 3-column grid on mobile, 4-col on
 *     sm, 6-col on md+. Scrollable horizontally on very narrow screens if
 *     needed (rare).
 *   - Placeholder: the actor's initials in a warm muted disc when TMDB
 *     has no profile photo. Not a generic silhouette SVG.
 *
 * References: Letterboxd's cast strip (text-forward), Apple TV app's
 * credits band (large circular heads), Mubi's "Cast & Crew" (editorial
 * credit block). We lean closer to Letterboxd/Mubi — a design language
 * for films, not tiles.
 */
export interface CastRow {
  name: string;
  character: string | null;
  profilePath: string | null;
  castOrder: number | null;
  isCrew: number;
  crewJob: string | null;
}

interface MovieCastProps {
  cast: CastRow[];
}

export function MovieCast({ cast }: MovieCastProps) {
  if (!cast || cast.length === 0) return null;

  const actors = cast.filter((c) => c.isCrew === 0);
  const directors = cast.filter((c) => c.isCrew === 1 && c.crewJob === "Director");
  const writers = cast.filter(
    (c) => c.isCrew === 1 && (c.crewJob === "Writer" || c.crewJob === "Screenplay"),
  );

  return (
    <section className="mt-16 space-y-6">
      <h2 className="small-caps text-[12px] text-muted-foreground">
        Cast &amp; Crew
      </h2>

      {(directors.length > 0 || writers.length > 0) && (
        <div className="font-serif text-[15px] text-foreground/80 space-y-1">
          {directors.length > 0 && (
            <p>
              <span className="small-caps text-[10px] text-muted-foreground mr-2">
                Directed by
              </span>
              {directors.map((d) => d.name).join(" · ")}
            </p>
          )}
          {writers.length > 0 && (
            <p>
              <span className="small-caps text-[10px] text-muted-foreground mr-2">
                Written by
              </span>
              {writers.map((w) => w.name).join(" · ")}
            </p>
          )}
        </div>
      )}

      {actors.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-6">
          {actors.map((actor, idx) => (
            <CastTile key={`${actor.name}-${idx}`} actor={actor} />
          ))}
        </div>
      )}
    </section>
  );
}

function CastTile({ actor }: { actor: CastRow }) {
  const imgUrl = actor.profilePath
    ? getImageUrl(actor.profilePath, "w185")
    : null;
  const initials = actor.name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "relative h-[74px] w-[74px] sm:h-20 sm:w-20 rounded-full overflow-hidden ring-1 ring-border/60",
          "bg-muted",
        )}
      >
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={actor.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-lg text-muted-foreground">
            {initials || "?"}
          </div>
        )}
      </div>
      <p className="font-serif text-[13px] leading-tight mt-2 line-clamp-2 text-foreground">
        {actor.name}
      </p>
      {actor.character && (
        <p className="small-caps text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
          {actor.character}
        </p>
      )}
    </div>
  );
}
