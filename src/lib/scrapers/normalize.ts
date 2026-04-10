// ---------------------------------------------------------------------------
// Score Normalization
// Normalizes content scores from different sources into a unified 0-5 scale.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedScores {
  language: number;
  violence: number;
  sexual: number;
  scary: number;
}

export interface SourceScores {
  source: string;
  languageScore: number;
  violenceScore: number;
  sexualScore: number;
  scaryScore?: number;
}

// ---------------------------------------------------------------------------
// Normalization functions
// ---------------------------------------------------------------------------

/**
 * Normalize a Kids-In-Mind score (0-10 scale) to a 0-5 scale.
 * Divides by 2 and rounds to the nearest integer.
 *
 * @param score - A Kids-In-Mind score from 0 to 10
 * @returns Normalized score from 0 to 5
 */
export function normalizeKidsInMindScore(score: number | null | undefined): number {
  if (score === null || score === undefined || isNaN(score)) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(10, score));
  return Math.round(clamped / 2);
}

/**
 * Normalize an IMDb severity label to a 0-5 numeric score.
 *
 * Mapping:
 *   None     = 0
 *   Mild     = 1
 *   Moderate = 3
 *   Severe   = 5
 *
 * @param severity - IMDb severity string (None, Mild, Moderate, or Severe)
 * @returns Normalized score from 0 to 5
 */
export function normalizeImdbSeverity(severity: string | null | undefined): number {
  if (!severity || typeof severity !== 'string') {
    return 0;
  }

  const normalized = severity.toLowerCase().trim();

  switch (normalized) {
    case 'none':
      return 0;
    case 'mild':
      return 1;
    case 'moderate':
      return 3;
    case 'severe':
      return 5;
    default:
      return 0;
  }
}

/**
 * Map a Common Sense Media recommended age to approximate 0-5 content scores.
 *
 * The mapping is based on typical content expectations for each age bracket:
 *
 *   Age  2-4  => very mild content across the board (scary might be 1)
 *   Age  5-7  => mild content, slightly higher scary potential
 *   Age  8-9  => some content in most categories
 *   Age 10-12 => moderate content
 *   Age 13-14 => moderate-to-high content
 *   Age 15-16 => high content
 *   Age 17+   => near-maximum content
 *
 * @param age - Recommended age from Common Sense Media
 * @returns Approximate content scores on a 0-5 scale
 */
export function normalizeCommonSenseAge(
  age: number | null | undefined,
): NormalizedScores {
  if (age === null || age === undefined || isNaN(age)) {
    return { language: 0, violence: 0, sexual: 0, scary: 0 };
  }

  // Clamp to a reasonable range
  const clampedAge = Math.max(2, Math.min(18, age));

  if (clampedAge <= 4) {
    return { language: 0, violence: 0, sexual: 0, scary: 1 };
  }

  if (clampedAge <= 7) {
    return { language: 0, violence: 1, sexual: 0, scary: 1 };
  }

  if (clampedAge <= 9) {
    return { language: 1, violence: 1, sexual: 0, scary: 2 };
  }

  if (clampedAge <= 12) {
    return { language: 2, violence: 2, sexual: 1, scary: 2 };
  }

  if (clampedAge <= 14) {
    return { language: 3, violence: 3, sexual: 2, scary: 3 };
  }

  if (clampedAge <= 16) {
    return { language: 4, violence: 4, sexual: 3, scary: 4 };
  }

  // 17+
  return { language: 5, violence: 5, sexual: 4, scary: 5 };
}

/**
 * Aggregate content scores across multiple sources using a conservative
 * (maximum) approach. For each category, the highest score from any source
 * is used. This is the safest strategy for family content filtering —
 * if any source flags something as concerning, we treat it as concerning.
 *
 * @param sources - Array of source score objects
 * @returns Aggregated scores with the maximum value per category
 */
export function aggregateScores(
  sources: SourceScores[] | null | undefined,
): NormalizedScores {
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return { language: 0, violence: 0, sexual: 0, scary: 0 };
  }

  const result: NormalizedScores = {
    language: 0,
    violence: 0,
    sexual: 0,
    scary: 0,
  };

  for (const source of sources) {
    if (!source) continue;

    const langScore = safeScore(source.languageScore);
    const violScore = safeScore(source.violenceScore);
    const sexScore = safeScore(source.sexualScore);
    const scaryScore = safeScore(source.scaryScore);

    result.language = Math.max(result.language, langScore);
    result.violence = Math.max(result.violence, violScore);
    result.sexual = Math.max(result.sexual, sexScore);
    result.scary = Math.max(result.scary, scaryScore);
  }

  // Clamp all values to 0-5 range
  result.language = clamp(result.language, 0, 5);
  result.violence = clamp(result.violence, 0, 5);
  result.sexual = clamp(result.sexual, 0, 5);
  result.scary = clamp(result.scary, 0, 5);

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely convert a potentially null/undefined/NaN score to a number.
 */
function safeScore(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return value;
}

/**
 * Clamp a number between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
