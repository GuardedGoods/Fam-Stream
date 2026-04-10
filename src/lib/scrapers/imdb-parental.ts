// ---------------------------------------------------------------------------
// IMDb Parental Guide Scraper
// https://www.imdb.com/title/{imdbId}/parentalguide
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImdbSeverity = 'None' | 'Mild' | 'Moderate' | 'Severe';

export interface ImdbParentalCategory {
  /** Severity rating: None, Mild, Moderate, or Severe */
  severity: ImdbSeverity;
  /** Numeric score mapped from severity: None=0, Mild=2, Moderate=5, Severe=8 */
  score: number;
  /** Combined text descriptions from user-submitted guide entries */
  notes: string;
  /** Individual text entries for this category */
  entries: string[];
}

export interface ImdbParentalGuideResult {
  sexAndNudity: ImdbParentalCategory;
  violenceAndGore: ImdbParentalCategory;
  profanity: ImdbParentalCategory;
  alcoholDrugsSmoking: ImdbParentalCategory;
  frighteningIntenseScenes: ImdbParentalCategory;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_SCORE_MAP: Record<ImdbSeverity, number> = {
  None: 0,
  Mild: 2,
  Moderate: 5,
  Severe: 8,
};

/** Maps from the section IDs/headings used on IMDb to our result field names. */
const SECTION_MAP: Record<
  string,
  keyof Omit<ImdbParentalGuideResult, 'sourceUrl'>
> = {
  'advisory-nudity': 'sexAndNudity',
  'advisory-violence': 'violenceAndGore',
  'advisory-profanity': 'profanity',
  'advisory-alcohol': 'alcoholDrugsSmoking',
  'advisory-frightening': 'frighteningIntenseScenes',
  'sex & nudity': 'sexAndNudity',
  'sex and nudity': 'sexAndNudity',
  'violence & gore': 'violenceAndGore',
  'violence and gore': 'violenceAndGore',
  'profanity': 'profanity',
  'alcohol, drugs & smoking': 'alcoholDrugsSmoking',
  'alcohol drugs smoking': 'alcoholDrugsSmoking',
  'alcohol drugs & smoking': 'alcoholDrugsSmoking',
  'frightening & intense scenes': 'frighteningIntenseScenes',
  'frightening and intense scenes': 'frighteningIntenseScenes',
};

// ---------------------------------------------------------------------------
// Rate limiter – 2-3 second delay between requests
// ---------------------------------------------------------------------------

let lastRequestTime = 0;
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 3_000;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const delay =
    MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  if (elapsed < delay) {
    await new Promise((resolve) => setTimeout(resolve, delay - elapsed));
  }

  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Create a default empty parental category.
 */
function emptyCategory(): ImdbParentalCategory {
  return {
    severity: 'None',
    score: 0,
    notes: '',
    entries: [],
  };
}

/**
 * Parse a severity string from the page into a typed severity value.
 */
function parseSeverity(text: string): ImdbSeverity {
  const normalized = text.toLowerCase().trim();

  if (normalized.includes('severe')) return 'Severe';
  if (normalized.includes('moderate')) return 'Moderate';
  if (normalized.includes('mild')) return 'Mild';
  if (normalized.includes('none')) return 'None';

  return 'None';
}

/**
 * Resolve a section ID or heading text to a result field name.
 */
function resolveSection(
  text: string,
): keyof Omit<ImdbParentalGuideResult, 'sourceUrl'> | null {
  const normalized = text.toLowerCase().trim();

  // Try direct match
  if (SECTION_MAP[normalized]) {
    return SECTION_MAP[normalized];
  }

  // Try partial match
  for (const [key, value] of Object.entries(SECTION_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

/**
 * Fetch a page with rate limiting and proper headers.
 */
async function fetchPage(url: string): Promise<string | null> {
  await waitForRateLimit();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(
        `[imdb-parental] HTTP ${response.status} for ${url}`,
      );
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[imdb-parental] Failed to fetch ${url}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseParentalGuidePage(
  html: string,
  sourceUrl: string,
): ImdbParentalGuideResult | null {
  const $ = cheerio.load(html);

  const result: ImdbParentalGuideResult = {
    sexAndNudity: emptyCategory(),
    violenceAndGore: emptyCategory(),
    profanity: emptyCategory(),
    alcoholDrugsSmoking: emptyCategory(),
    frighteningIntenseScenes: emptyCategory(),
    sourceUrl,
  };

  let sectionsFound = 0;

  // Strategy 1: Parse using section IDs (advisory-nudity, advisory-violence, etc.)
  const sectionIds = [
    'advisory-nudity',
    'advisory-violence',
    'advisory-profanity',
    'advisory-alcohol',
    'advisory-frightening',
  ];

  for (const sectionId of sectionIds) {
    const sectionEl = $(`#${sectionId}, [id="${sectionId}"]`);
    if (!sectionEl.length) continue;

    const field = SECTION_MAP[sectionId];
    if (!field) continue;

    sectionsFound++;

    // Extract severity from the section
    const severityEl = sectionEl.find(
      '[class*="severity"], [class*="ipl-status-pill"], ' +
      'span[class*="advisory-severity-vote"], [class*="advisory-severity"]',
    ).first();

    let severity: ImdbSeverity = 'None';
    if (severityEl.length) {
      severity = parseSeverity(severityEl.text());
    } else {
      // Try finding severity in nearby elements
      const parentSection = sectionEl.closest('section, div');
      const severityText = parentSection
        .find('[class*="severity"], [class*="pill"]')
        .first()
        .text();
      if (severityText) {
        severity = parseSeverity(severityText);
      }
    }

    // Extract text entries (spoiler items)
    const entries: string[] = [];
    sectionEl
      .find(
        'li[class*="ipl-zebra-list__item"], li, [class*="advisory-text"], p',
      )
      .each((_i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 5 && !isSeverityLabel(text)) {
          // Remove "Edit" buttons and other UI artifacts
          const cleaned = text
            .replace(/\s*Edit\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleaned.length > 5) {
            entries.push(cleaned);
          }
        }
      });

    result[field] = {
      severity,
      score: SEVERITY_SCORE_MAP[severity],
      notes: entries.join(' | ').slice(0, 5000),
      entries,
    };
  }

  // Strategy 2: If section IDs didn't work, try parsing by headings
  if (sectionsFound === 0) {
    $('section, [class*="advisory"], [class*="guide-section"]').each(
      (_i, el) => {
        const headingEl = $(el).find('h2, h3, h4').first();
        if (!headingEl.length) return;

        const headingText = headingEl.text().trim();
        const field = resolveSection(headingText);
        if (!field) return;

        sectionsFound++;

        // Find severity
        const severityEl = $(el).find(
          '[class*="severity"], [class*="pill"], [class*="status"]',
        ).first();
        const severity = severityEl.length
          ? parseSeverity(severityEl.text())
          : 'None';

        // Find entries
        const entries: string[] = [];
        $(el).find('li, p').each((_j, entryEl) => {
          const text = $(entryEl).text().trim();
          if (text && text.length > 5 && !isSeverityLabel(text)) {
            const cleaned = text
              .replace(/\s*Edit\s*$/i, '')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleaned.length > 5) {
              entries.push(cleaned);
            }
          }
        });

        result[field] = {
          severity,
          score: SEVERITY_SCORE_MAP[severity],
          notes: entries.join(' | ').slice(0, 5000),
          entries,
        };
      },
    );
  }

  // Strategy 3: Regex-based text extraction as a last resort
  if (sectionsFound === 0) {
    const bodyText = $('body').text();

    const sections: Array<{
      pattern: RegExp;
      field: keyof Omit<ImdbParentalGuideResult, 'sourceUrl'>;
    }> = [
      {
        pattern:
          /Sex\s*(?:&|and)\s*Nudity\s*[-–—:]?\s*(None|Mild|Moderate|Severe)?/i,
        field: 'sexAndNudity',
      },
      {
        pattern:
          /Violence\s*(?:&|and)\s*Gore\s*[-–—:]?\s*(None|Mild|Moderate|Severe)?/i,
        field: 'violenceAndGore',
      },
      {
        pattern:
          /Profanity\s*[-–—:]?\s*(None|Mild|Moderate|Severe)?/i,
        field: 'profanity',
      },
      {
        pattern:
          /Alcohol[,\s]*Drugs?\s*(?:&|and)\s*Smoking\s*[-–—:]?\s*(None|Mild|Moderate|Severe)?/i,
        field: 'alcoholDrugsSmoking',
      },
      {
        pattern:
          /Frightening\s*(?:&|and)\s*Intense\s*Scenes?\s*[-–—:]?\s*(None|Mild|Moderate|Severe)?/i,
        field: 'frighteningIntenseScenes',
      },
    ];

    for (const { pattern, field } of sections) {
      const match = bodyText.match(pattern);
      if (match) {
        const severity = match[1] ? parseSeverity(match[1]) : 'None';
        result[field] = {
          severity,
          score: SEVERITY_SCORE_MAP[severity],
          notes: '',
          entries: [],
        };
        sectionsFound++;
      }
    }
  }

  if (sectionsFound === 0) {
    console.warn(
      `[imdb-parental] No parental guide sections found at ${sourceUrl}`,
    );
    return null;
  }

  return result;
}

/**
 * Check if a text string is just a severity label (not actual content).
 */
function isSeverityLabel(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return ['none', 'mild', 'moderate', 'severe'].includes(normalized);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape the IMDb Parental Guide page for a given movie.
 *
 * @param imdbId - The IMDb ID (e.g. "tt0110357")
 * @returns Parsed parental guide data, or null if the page cannot be fetched/parsed
 */
export async function scrapeImdbParentalGuide(
  imdbId: string,
): Promise<ImdbParentalGuideResult | null> {
  // Validate IMDb ID format
  if (!/^tt\d{7,}$/.test(imdbId)) {
    console.error(
      `[imdb-parental] Invalid IMDb ID format: "${imdbId}". Expected format: tt0000000`,
    );
    return null;
  }

  const sourceUrl = `https://www.imdb.com/title/${imdbId}/parentalguide`;

  try {
    const html = await fetchPage(sourceUrl);
    if (!html) {
      console.warn(
        `[imdb-parental] Failed to fetch parental guide for ${imdbId}`,
      );
      return null;
    }

    return parseParentalGuidePage(html, sourceUrl);
  } catch (error) {
    console.error(
      `[imdb-parental] Error scraping parental guide for ${imdbId}:`,
      error,
    );
    return null;
  }
}
