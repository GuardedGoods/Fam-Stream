import type { AggregatedContentRating, ContentVerdict, MovieVerdict } from '@/types';

const MPAA_ORDER: Record<string, number> = {
  'G': 0,
  'PG': 1,
  'PG-13': 2,
  'R': 3,
  'NC-17': 4,
};

/**
 * Evaluate a movie against a filter profile and blocked words list.
 *
 * Returns a verdict indicating whether the movie passes, should be shown
 * with caution, is blocked, or has no content rating data.
 */
export function evaluateMovie(
  movie: {
    mpaaRating: string | null;
    contentRating: AggregatedContentRating | null;
  },
  profile: {
    maxLanguageScore: number;
    maxViolenceScore: number;
    maxSexualContentScore: number;
    maxScaryScore: number;
    maxMpaa: string;
  },
  blockedWords: string[]
): MovieVerdict {
  // No content rating data available
  if (!movie.contentRating) {
    return { verdict: 'unrated', reasons: ['No content rating data'] };
  }

  const reasons: string[] = [];
  let hasBlock = false;
  let hasCaution = false;

  // 1. Check MPAA rating
  if (movie.mpaaRating) {
    const movieMpaaLevel = MPAA_ORDER[movie.mpaaRating];
    const maxMpaaLevel = MPAA_ORDER[profile.maxMpaa];

    if (movieMpaaLevel !== undefined && maxMpaaLevel !== undefined) {
      if (movieMpaaLevel > maxMpaaLevel) {
        reasons.push(
          `MPAA rating ${movie.mpaaRating} exceeds maximum ${profile.maxMpaa}`
        );
        // MPAA exceeding threshold is a block
        hasBlock = true;
      }
    }
  }

  // 2. Check each content score against thresholds
  const scoreChecks: {
    label: string;
    score: number;
    max: number;
  }[] = [
    {
      label: 'Language',
      score: movie.contentRating.languageScore,
      max: profile.maxLanguageScore,
    },
    {
      label: 'Violence',
      score: movie.contentRating.violenceScore,
      max: profile.maxViolenceScore,
    },
    {
      label: 'Sexual content',
      score: movie.contentRating.sexualContentScore,
      max: profile.maxSexualContentScore,
    },
    {
      label: 'Scary/intense',
      score: movie.contentRating.scaryScore,
      max: profile.maxScaryScore,
    },
  ];

  for (const check of scoreChecks) {
    const diff = check.score - check.max;
    if (diff > 0) {
      reasons.push(
        `${check.label} score ${check.score} exceeds limit of ${check.max}`
      );
      if (diff >= 3) {
        hasBlock = true;
      } else {
        hasCaution = true;
      }
    }
  }

  // 3. Check specific words against blocked words
  if (blockedWords.length > 0 && movie.contentRating.specificWords?.length > 0) {
    const normalizedBlocked = blockedWords.map((w) => w.toLowerCase());
    const matchedWords: string[] = [];

    for (const word of movie.contentRating.specificWords) {
      if (normalizedBlocked.includes(word.toLowerCase())) {
        matchedWords.push(word);
      }
    }

    if (matchedWords.length > 0) {
      reasons.push(`Contains blocked words: ${matchedWords.join(', ')}`);
      hasBlock = true;
    }
  }

  // 4. Determine final verdict
  let verdict: ContentVerdict;
  if (hasBlock) {
    verdict = 'blocked';
  } else if (hasCaution) {
    verdict = 'caution';
  } else {
    verdict = 'pass';
  }

  return { verdict, reasons };
}
