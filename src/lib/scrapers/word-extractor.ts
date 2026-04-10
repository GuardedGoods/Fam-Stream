// ---------------------------------------------------------------------------
// Profanity Word Extractor
// Parses parental guide text to extract specific profanity mentions & counts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A map of profanity terms to their occurrence counts. */
export type ProfanityMap = Record<string, number>;

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Each pattern rule maps a regex to a canonical profanity key.
 * The regex should capture a count group (optional) indicating how many times
 * the word appears. If no count is captured, we default to 1.
 */
interface ProfanityPattern {
  /** Canonical key used in the output map (e.g. "f-word", "s-word") */
  key: string;
  /** Regex patterns that match mentions of this profanity in text */
  patterns: RegExp[];
}

const PROFANITY_RULES: ProfanityPattern[] = [
  // --- F-word ---
  {
    key: 'f-word',
    patterns: [
      /(\d+)\s+(?:F[- ]?words?|uses?\s+of\s+(?:the\s+)?(?:"f\*+k"|"f\*+"|f\*+k|f-word|"fuck"))/gi,
      /(?:an?\s+|one\s+)(?:F[- ]?word|use\s+of\s+(?:the\s+)?(?:"f\*+k"|f\*+k|f-word|"fuck"))/gi,
      /(?:F[- ]?word|f\*+k|f\*\*k)\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /(?:F[- ]?word|f\*+k|f\*\*k)\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- S-word ---
  {
    key: 's-word',
    patterns: [
      /(\d+)\s+(?:S[- ]?words?|scatological\s+terms?|uses?\s+of\s+(?:the\s+)?(?:"s\*+t"|"s\*+"|s\*+t|s-word|"shit"))/gi,
      /(?:an?\s+|one\s+)(?:S[- ]?word|scatological\s+term|use\s+of\s+(?:the\s+)?(?:"s\*+t"|s\*+t|s-word|"shit"))/gi,
      /(?:S[- ]?word|s\*+t|s\*\*t)\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /(?:S[- ]?word|s\*+t|s\*\*t)\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Damn ---
  {
    key: 'damn',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?damn[""']?|(?:uses?\s+of\s+)?[""']damn[""'])/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?damn[""']?/gi,
      /[""']?damn[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?damn[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Hell ---
  {
    key: 'hell',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?hell[""']?|(?:uses?\s+of\s+)?[""']hell[""'])/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?hell[""']?/gi,
      /[""']?hell[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?hell[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Ass ---
  {
    key: 'ass',
    patterns: [
      /(\d+)\s+(?:A[- ]?words?|uses?\s+of\s+(?:the\s+word\s+)?[""']?ass(?:hole)?[""']?|(?:uses?\s+of\s+)?[""']ass(?:hole)?[""'])/gi,
      /(?:an?\s+|one\s+)(?:A[- ]?word|use\s+of\s+(?:the\s+word\s+)?[""']?ass(?:hole)?[""']?)/gi,
      /[""']?ass(?:hole)?[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?ass(?:hole)?[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Bastard ---
  {
    key: 'bastard',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?bastard[""']?|(?:uses?\s+of\s+)?[""']bastard[""'])/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?bastard[""']?/gi,
      /[""']?bastard[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?bastard[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Crap ---
  {
    key: 'crap',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?crap[""']?|(?:uses?\s+of\s+)?[""']crap[""'])/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?crap[""']?/gi,
      /[""']?crap[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?crap[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Goddamn / God's name in vain ---
  {
    key: 'goddamn',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?god\s*damn?[""']?|(?:uses?\s+of\s+)?[""']god\s*damn?[""'])/gi,
      /(\d+)\s+(?:(?:uses?\s+of\s+)?God'?s?\s+name\s+in\s+vain|profanit(?:y|ies)\s+(?:involving|using)\s+God'?s?\s+name)/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?god\s*damn?[""']?/gi,
      /God'?s?\s+name\s+(?:is\s+)?(?:used|taken)\s+in\s+vain\s+(\d+)\s+times?/gi,
      /God'?s?\s+name\s+(?:is\s+)?(?:used|taken)\s+in\s+vain/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?God'?s?\s+name\s+in\s+vain/gi,
    ],
  },

  // --- Bitch ---
  {
    key: 'bitch',
    patterns: [
      /(\d+)\s+(?:uses?\s+of\s+(?:the\s+word\s+)?[""']?bitch[""']?|(?:uses?\s+of\s+)?[""']bitch[""'])/gi,
      /(?:an?\s+|one\s+)(?:use\s+of\s+)?[""']?bitch[""']?/gi,
      /[""']?bitch[""']?\s+(?:is\s+)?(?:used|said|spoken|heard|uttered)\s+(\d+)\s+times?/gi,
      /[""']?bitch[""']?\s+(?:is\s+)?(?:used|said|spoken|heard)/gi,
    ],
  },

  // --- Generic obscenities pattern ---
  // Matches patterns like "N obscenities", "N mild obscenities",
  // "N anatomical terms", "N religious exclamations/profanities"
  {
    key: 'obscenities',
    patterns: [
      /(\d+)\s+(?:mild\s+)?obscenit(?:y|ies)/gi,
      /(\d+)\s+(?:mild\s+)?profanit(?:y|ies)/gi,
      /(\d+)\s+anatomical\s+terms?/gi,
      /(\d+)\s+religious\s+(?:exclamations?|profanit(?:y|ies))/gi,
      /(\d+)\s+mild\s+expletives?/gi,
      /(\d+)\s+derogatory\s+terms?/gi,
    ],
  },
];

// ---------------------------------------------------------------------------
// Core extraction logic
// ---------------------------------------------------------------------------

/**
 * Extract a numeric count from a regex match.
 *
 * If the regex captured a digit group, parse that as the count.
 * Otherwise, check if the match starts with a word like "an" or "one" => 1.
 * Default to 1 if no count is determinable.
 */
function extractCount(match: RegExpMatchArray): number {
  // Check captured groups for a number
  for (let i = 1; i < match.length; i++) {
    if (match[i] && /^\d+$/.test(match[i])) {
      return parseInt(match[i], 10);
    }
  }

  // Check if the match text implies a single occurrence
  const text = match[0].toLowerCase();
  if (text.startsWith('a ') || text.startsWith('an ') || text.startsWith('one ')) {
    return 1;
  }

  return 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse text (typically from a parental guide) to extract specific profanity
 * word mentions with their counts.
 *
 * @param text - The source text to parse
 * @returns A map of profanity terms to their counts (e.g. {"f-word": 3, "damn": 2})
 */
export function extractProfanityWords(text: string): ProfanityMap {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const result: ProfanityMap = {};

  for (const rule of PROFANITY_RULES) {
    let totalForKey = 0;

    for (const pattern of rule.patterns) {
      // Reset lastIndex for global regex patterns
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        totalForKey += extractCount(match);

        // Safety: prevent infinite loops on zero-width matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    if (totalForKey > 0) {
      // If we already have a count for this key (from overlapping patterns),
      // take the larger value since patterns may double-count
      result[rule.key] = Math.max(result[rule.key] ?? 0, totalForKey);
    }
  }

  return result;
}

/**
 * Aggregate profanity counts across multiple text sources.
 * For each profanity term, the maximum count across all sources is used.
 * This avoids double-counting when the same data appears in multiple sources,
 * while still capturing the most comprehensive count.
 *
 * @param sources - Array of objects containing text to parse
 * @returns Aggregated profanity map with max counts per term
 */
export function extractAllProfanity(
  sources: Array<{ text: string }>,
): ProfanityMap {
  if (!sources || !Array.isArray(sources)) {
    return {};
  }

  const aggregated: ProfanityMap = {};

  for (const source of sources) {
    if (!source?.text) continue;

    const extracted = extractProfanityWords(source.text);

    for (const [word, count] of Object.entries(extracted)) {
      aggregated[word] = Math.max(aggregated[word] ?? 0, count);
    }
  }

  return aggregated;
}
