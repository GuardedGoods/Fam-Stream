import type {
  TmdbCreditsResponse,
  TmdbCastMember,
  TmdbCrewMember,
} from "@/lib/apis/tmdb";

/**
 * Row shape written to `movie_cast` by the orchestrator. Kept here as a
 * DB-agnostic type so the mapper below is trivially unit-testable without
 * spinning up Drizzle.
 */
export interface MovieCastRow {
  tmdbPersonId: number;
  name: string;
  character: string | null;
  profilePath: string | null;
  castOrder: number | null;
  isCrew: number; // 0 | 1
  crewJob: string | null;
}

/**
 * Jobs from the crew list we care about. Director comes first so
 * duplicate-person deduplication (a rare case — director who also writes)
 * keeps the director credit.
 */
const CREW_JOBS_TO_KEEP = ["Director", "Writer", "Screenplay"] as const;
const TOP_CAST_COUNT = 12;

/**
 * Deterministic mapping from a TMDB credits response to a set of
 * `movie_cast` rows.
 *
 * Rules:
 *   - Keep top `TOP_CAST_COUNT` cast members by `order` ascending (0 = lead).
 *   - Skip cast without a name (defensive — TMDB occasionally returns empty).
 *   - Keep crew members whose job ∈ CREW_JOBS_TO_KEEP.
 *   - Deduplicate by (tmdbPersonId, crewJob). One person can appear as
 *     BOTH a cast member AND as Director; that's two rows because the
 *     crewJob differs ("" for cast, "Director" for crew).
 *   - Character is trimmed to 120 chars; some TMDB entries have long
 *     descriptive character names.
 */
export function mapCreditsToRows(
  credits: TmdbCreditsResponse,
): MovieCastRow[] {
  const rows: MovieCastRow[] = [];
  const seen = new Set<string>();

  const cast = [...(credits.cast ?? [])]
    .filter((c): c is TmdbCastMember => !!c && !!c.name)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, TOP_CAST_COUNT);

  for (const c of cast) {
    const key = `${c.id}|`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      tmdbPersonId: c.id,
      name: c.name,
      character: c.character ? c.character.slice(0, 120) : null,
      profilePath: c.profile_path,
      castOrder: typeof c.order === "number" ? c.order : null,
      isCrew: 0,
      crewJob: null,
    });
  }

  // Crew — keep in CREW_JOBS_TO_KEEP priority order so a single person
  // who directed AND wrote shows up once as Director + once as Writer.
  const crew = credits.crew ?? [];
  for (const job of CREW_JOBS_TO_KEEP) {
    const matches = crew.filter(
      (c: TmdbCrewMember): c is TmdbCrewMember =>
        !!c && !!c.name && c.job === job,
    );
    for (const c of matches) {
      const key = `${c.id}|${job}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        tmdbPersonId: c.id,
        name: c.name,
        character: null,
        profilePath: c.profile_path,
        castOrder: null,
        isCrew: 1,
        crewJob: job,
      });
    }
  }

  return rows;
}
