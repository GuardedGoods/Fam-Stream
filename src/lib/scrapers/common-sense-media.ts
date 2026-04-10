// ---------------------------------------------------------------------------
// Common Sense Media Web Scraper
// https://www.commonsensemedia.org
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommonSenseContentRating {
  /** Score from 0-5 (0 = not present, 5 = extreme) */
  score: number;
  /** Human-readable label like "Some", "A lot", etc. */
  label: string;
  /** Detailed description of the content */
  notes: string;
}

export interface CommonSenseMediaResult {
  title: string;
  recommendedAge: number | null;
  /** Star quality rating (1-5) if available */
  qualityRating: number | null;
  violence: CommonSenseContentRating;
  sex: CommonSenseContentRating;
  language: CommonSenseContentRating;
  consumerism: CommonSenseContentRating;
  drugsAndAlcohol: CommonSenseContentRating;
  /** Positive messages rating */
  positiveMessages: CommonSenseContentRating;
  /** Positive role models rating */
  positiveRoleModels: CommonSenseContentRating;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Rate limiter – 5-10 second delay between requests
// ---------------------------------------------------------------------------

let lastRequestTime = 0;
const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = 10_000;

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
 * Fetch a page with rate limiting and return the HTML or null on error.
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
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[common-sense-media] Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Map a CSM label string to a numeric score (0-5).
 */
function labelToScore(label: string): number {
  const normalized = label.toLowerCase().trim();

  const mapping: Record<string, number> = {
    'not present': 0,
    'none': 0,
    '0': 0,
    'a little': 1,
    'little': 1,
    '1': 1,
    'some': 2,
    'fair amount': 2,
    '2': 2,
    'a lot': 3,
    'lot': 3,
    '3': 3,
    'very heavy': 4,
    'heavy': 4,
    '4': 4,
    'extreme': 5,
    'excessive': 5,
    '5': 5,
  };

  return mapping[normalized] ?? 0;
}

/**
 * Create a default empty content rating.
 */
function emptyRating(): CommonSenseContentRating {
  return { score: 0, label: '', notes: '' };
}

/**
 * Build a URL slug for Common Sense Media from a movie title.
 */
function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Content category mapping
// ---------------------------------------------------------------------------

/** Map from CSM category headings to our result field names. */
const CATEGORY_MAP: Record<string, keyof Pick<
  CommonSenseMediaResult,
  'violence' | 'sex' | 'language' | 'consumerism' | 'drugsAndAlcohol' | 'positiveMessages' | 'positiveRoleModels'
>> = {
  'violence': 'violence',
  'violence & scariness': 'violence',
  'sex': 'sex',
  'sex, romance & nudity': 'sex',
  'language': 'language',
  'consumerism': 'consumerism',
  'drinking, drugs & smoking': 'drugsAndAlcohol',
  'drinking drugs smoking': 'drugsAndAlcohol',
  'positive messages': 'positiveMessages',
  'positive role models': 'positiveRoleModels',
  'positive role models & representations': 'positiveRoleModels',
};

/**
 * Normalize a category heading text for lookup.
 */
function normalizeCategoryText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[&,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to match a category heading to one of our known categories.
 */
function matchCategory(text: string): keyof Pick<
  CommonSenseMediaResult,
  'violence' | 'sex' | 'language' | 'consumerism' | 'drugsAndAlcohol' | 'positiveMessages' | 'positiveRoleModels'
> | null {
  const normalized = normalizeCategoryText(text);

  // Direct match
  if (CATEGORY_MAP[normalized]) {
    return CATEGORY_MAP[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseReviewPage(
  html: string,
  sourceUrl: string,
): CommonSenseMediaResult | null {
  const $ = cheerio.load(html);

  const result: CommonSenseMediaResult = {
    title: '',
    recommendedAge: null,
    qualityRating: null,
    violence: emptyRating(),
    sex: emptyRating(),
    language: emptyRating(),
    consumerism: emptyRating(),
    drugsAndAlcohol: emptyRating(),
    positiveMessages: emptyRating(),
    positiveRoleModels: emptyRating(),
    sourceUrl,
  };

  // --- Extract title ---
  const titleEl =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    '';
  result.title = titleEl.replace(/\s*review\s*$/i, '').trim();

  // --- Extract recommended age ---
  // CSM shows age prominently. Look for patterns like "age 8+", "Ages 8+"
  const bodyText = $('body').text();

  // Try structured age element first
  const ageSelectors = [
    '[class*="age-rating"]',
    '[class*="ageRating"]',
    '[class*="recommended-age"]',
    '[data-age]',
  ];

  for (const selector of ageSelectors) {
    const ageEl = $(selector).first();
    if (ageEl.length) {
      const ageText = ageEl.text().trim();
      const ageMatch = ageText.match(/(\d{1,2})\+?/);
      if (ageMatch) {
        result.recommendedAge = parseInt(ageMatch[1], 10);
        break;
      }

      // Check data attribute
      const dataAge = ageEl.attr('data-age');
      if (dataAge) {
        const parsed = parseInt(dataAge, 10);
        if (!isNaN(parsed)) {
          result.recommendedAge = parsed;
          break;
        }
      }
    }
  }

  // Fallback: search full text for age patterns
  if (result.recommendedAge === null) {
    const agePatterns = [
      /(?:recommended\s+(?:for\s+)?)?age[s]?\s*:?\s*(\d{1,2})\s*\+/i,
      /(\d{1,2})\s*\+\s*(?:years?\s+old|year-olds?)/i,
      /suitable\s+for\s+(?:ages?\s+)?(\d{1,2})\s*\+/i,
    ];

    for (const pattern of agePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        result.recommendedAge = parseInt(match[1], 10);
        break;
      }
    }
  }

  // --- Extract quality rating (star rating 1-5) ---
  const starSelectors = [
    '[class*="star-rating"]',
    '[class*="starRating"]',
    '[class*="quality-rating"]',
  ];

  for (const selector of starSelectors) {
    const starEl = $(selector).first();
    if (starEl.length) {
      const starText = starEl.text().trim();
      const starMatch = starText.match(/(\d)/);
      if (starMatch) {
        const stars = parseInt(starMatch[1], 10);
        if (stars >= 1 && stars <= 5) {
          result.qualityRating = stars;
          break;
        }
      }
    }
  }

  // --- Extract content ratings ---
  // CSM has structured sections for each content category.
  // Try multiple parsing strategies.

  let foundCategories = 0;

  // Strategy 1: Look for structured content category sections by class/id
  const contentSelectors = [
    '[class*="content-grid"] [class*="cell"]',
    '[class*="content-rating"]',
    '[class*="contentRating"]',
    '[class*="review-content"] section',
    '[class*="category"]',
  ];

  for (const selector of contentSelectors) {
    $(selector).each((_i, el) => {
      const sectionText = $(el).text().trim();
      const headingEl = $(el).find('h2, h3, h4, strong, [class*="title"], [class*="heading"]').first();
      const heading = headingEl.length ? headingEl.text().trim() : '';

      const category = matchCategory(heading);
      if (!category) return;

      foundCategories++;

      // Look for the severity label
      const labelEl = $(el).find(
        '[class*="severity"], [class*="rating-level"], [class*="level"]',
      ).first();
      const label = labelEl.length
        ? labelEl.text().trim()
        : extractLabelFromText(sectionText);

      // Look for description/notes
      const notesEl = $(el).find('p, [class*="description"], [class*="detail"]').first();
      const notes = notesEl.length
        ? notesEl.text().trim()
        : '';

      result[category] = {
        score: labelToScore(label),
        label,
        notes: notes.slice(0, 2000),
      };
    });

    if (foundCategories > 0) break;
  }

  // Strategy 2: If structured parsing found nothing, try text-based extraction
  if (foundCategories === 0) {
    const categoryPatterns: Array<{
      pattern: RegExp;
      field: keyof Pick<
        CommonSenseMediaResult,
        'violence' | 'sex' | 'language' | 'consumerism' | 'drugsAndAlcohol'
      >;
    }> = [
      { pattern: /violence\s*(?:&\s*scariness)?[:\s]*(none|not present|a little|some|a lot|heavy|extreme)/i, field: 'violence' },
      { pattern: /sex(?:,?\s*romance)?\s*(?:&\s*nudity)?[:\s]*(none|not present|a little|some|a lot|heavy|extreme)/i, field: 'sex' },
      { pattern: /language[:\s]*(none|not present|a little|some|a lot|heavy|extreme)/i, field: 'language' },
      { pattern: /consumerism[:\s]*(none|not present|a little|some|a lot|heavy|extreme)/i, field: 'consumerism' },
      { pattern: /drinking[,\s]*drugs?\s*(?:&\s*smoking)?[:\s]*(none|not present|a little|some|a lot|heavy|extreme)/i, field: 'drugsAndAlcohol' },
    ];

    for (const { pattern, field } of categoryPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        const label = match[1].trim();
        result[field] = {
          score: labelToScore(label),
          label,
          notes: '',
        };
        foundCategories++;
      }
    }
  }

  // If we found essentially nothing, warn about possible client-side rendering
  if (foundCategories === 0 && !result.recommendedAge) {
    console.warn(
      '[common-sense-media] No content ratings extracted. The page may use ' +
      'client-side rendering that Cheerio cannot parse. URL: ' + sourceUrl,
    );
    return null;
  }

  return result;
}

/**
 * Extract a severity label from a block of text by looking for known label words.
 */
function extractLabelFromText(text: string): string {
  const labels = [
    'Not present',
    'A little',
    'Some',
    'A lot',
    'Heavy',
    'Extreme',
    'None',
  ];

  for (const label of labels) {
    if (text.toLowerCase().includes(label.toLowerCase())) {
      return label;
    }
  }

  return '';
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

/**
 * Search Common Sense Media for a movie and return the review URL, or null.
 */
async function searchForReview(
  title: string,
  year?: string,
): Promise<string | null> {
  const searchQuery = year ? `${title} ${year}` : title;
  const searchUrl = `https://www.commonsensemedia.org/search/${encodeURIComponent(searchQuery)}?type=movie`;

  const html = await fetchPage(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Look for review links in search results
  let bestMatch: string | null = null;

  const linkSelectors = [
    'a[href*="/movie-reviews/"]',
    'a[href*="/movies/"]',
    '.search-result a',
    '[class*="result"] a',
    'a',
  ];

  for (const selector of linkSelectors) {
    $(selector).each((_i, el) => {
      if (bestMatch) return;

      const href = $(el).attr('href');
      if (!href) return;

      // Must look like a movie review URL
      const isReviewUrl =
        href.includes('/movie-reviews/') || href.includes('/movies/');
      if (!isReviewUrl) return;

      const linkText = $(el).text().toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        linkText.includes(normalizedTitle) ||
        normalizedTitle.includes(linkText)
      ) {
        if (href.startsWith('http')) {
          bestMatch = href;
        } else {
          bestMatch = `https://www.commonsensemedia.org${href}`;
        }
      }
    });

    if (bestMatch) break;
  }

  // Fallback: try constructing a direct URL
  if (!bestMatch) {
    const slug = buildSlug(title);
    const directUrl = `https://www.commonsensemedia.org/movie-reviews/${slug}`;

    const directHtml = await fetchPage(directUrl);
    if (directHtml) {
      return directUrl;
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Common Sense Media for a movie and scrape its content ratings.
 * Returns null if the movie is not found or content cannot be parsed.
 *
 * Note: Common Sense Media may use client-side rendering for some content.
 * If scraping returns empty results, a warning will be logged.
 */
export async function scrapeCommonSenseMedia(
  title: string,
  year?: string,
): Promise<CommonSenseMediaResult | null> {
  try {
    const reviewUrl = await searchForReview(title, year);
    if (!reviewUrl) {
      console.warn(
        `[common-sense-media] Could not find review for "${title}"${year ? ` (${year})` : ''}`,
      );
      return null;
    }

    const html = await fetchPage(reviewUrl);
    if (!html) {
      console.warn(
        `[common-sense-media] Failed to fetch review page: ${reviewUrl}`,
      );
      return null;
    }

    return parseReviewPage(html, reviewUrl);
  } catch (error) {
    console.error(
      `[common-sense-media] Error scraping "${title}":`,
      error,
    );
    return null;
  }
}
