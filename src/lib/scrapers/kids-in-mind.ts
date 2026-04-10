// ---------------------------------------------------------------------------
// Kids-In-Mind Web Scraper
// https://kids-in-mind.com
// ---------------------------------------------------------------------------

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KidsInMindResult {
  sexualScore: number;
  violenceScore: number;
  languageScore: number;
  sexualNotes: string;
  violenceNotes: string;
  languageNotes: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Rate limiter – enforces 3-5 second delay between requests
// ---------------------------------------------------------------------------

let lastRequestTime = 0;
const MIN_DELAY_MS = 3_000;
const MAX_DELAY_MS = 5_000;

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
 * Build a plausible Kids-In-Mind URL slug from a movie title.
 * Kids-In-Mind URLs tend to follow the pattern:
 *   https://kids-in-mind.com/movie-name.htm
 */
function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch a page and return the HTML body as a string.
 * Returns null if the page responds with a non-200 status.
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
    console.error(`[kids-in-mind] Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Parse an integer score from text like "SEX/NUDITY 3" or "3".
 * Returns null if no valid score is found.
 */
function parseScore(text: string): number | null {
  const match = text.match(/(\d{1,2})/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return num >= 0 && num <= 10 ? num : null;
}

/**
 * Try to extract scores and notes by parsing the page content.
 * Kids-In-Mind pages typically have sections with headers like:
 *   SEX/NUDITY 3 - ...
 *   VIOLENCE/GORE 5 - ...
 *   LANGUAGE 7 - ...
 */
function parseReviewPage(
  html: string,
  sourceUrl: string,
): KidsInMindResult | null {
  const $ = cheerio.load(html);

  // Strategy 1: Look for the score pattern in the page text.
  // Kids-In-Mind displays scores in the format "X.Y.Z" (sex.violence.language)
  // and also in section headers.

  let sexualScore: number | null = null;
  let violenceScore: number | null = null;
  let languageScore: number | null = null;
  let sexualNotes = '';
  let violenceNotes = '';
  let languageNotes = '';

  // Try to find scores from the page title or header which often contains "X.Y.Z"
  const pageTitle = $('title').text();
  const scorePattern = /(\d{1,2})\.(\d{1,2})\.(\d{1,2})/;
  const titleMatch = pageTitle.match(scorePattern);

  if (titleMatch) {
    sexualScore = parseInt(titleMatch[1], 10);
    violenceScore = parseInt(titleMatch[2], 10);
    languageScore = parseInt(titleMatch[3], 10);
  }

  // Get the full text content for section parsing
  const bodyText = $('body').text();

  // Extract sections using regex on the full text
  const sexMatch = bodyText.match(
    /SEX(?:\/|\s*&\s*)NUDITY\s*(\d{1,2})\s*[-–—]?\s*([\s\S]*?)(?=VIOLENCE(?:\/|\s*&\s*)GORE|$)/i,
  );
  const violenceMatch = bodyText.match(
    /VIOLENCE(?:\/|\s*&\s*)GORE\s*(\d{1,2})\s*[-–—]?\s*([\s\S]*?)(?=LANGUAGE|PROFANITY|$)/i,
  );
  const languageMatch = bodyText.match(
    /(?:LANGUAGE|PROFANITY)\s*(\d{1,2})\s*[-–—]?\s*([\s\S]*?)(?=SUBSTANCE\s*USE|PARENTS|DISCUSSION\s*TOPICS|MESSAGE|$)/i,
  );

  if (sexMatch) {
    sexualScore = sexualScore ?? parseScore(sexMatch[1]);
    sexualNotes = cleanNotes(sexMatch[2]);
  }

  if (violenceMatch) {
    violenceScore = violenceScore ?? parseScore(violenceMatch[1]);
    violenceNotes = cleanNotes(violenceMatch[2]);
  }

  if (languageMatch) {
    languageScore = languageScore ?? parseScore(languageMatch[1]);
    languageNotes = cleanNotes(languageMatch[2]);
  }

  // If we still don't have scores, try parsing from structured HTML elements
  if (sexualScore === null || violenceScore === null || languageScore === null) {
    // Look for score in meta tags or structured elements
    $('p, div, span, td').each((_i, el) => {
      const text = $(el).text().trim();

      if (sexualScore === null) {
        const sexElMatch = text.match(
          /SEX(?:\/|\s*&\s*)NUDITY\s*[-–—:]*\s*(\d{1,2})/i,
        );
        if (sexElMatch) {
          sexualScore = parseScore(sexElMatch[1]);
        }
      }

      if (violenceScore === null) {
        const violElMatch = text.match(
          /VIOLENCE(?:\/|\s*&\s*)GORE\s*[-–—:]*\s*(\d{1,2})/i,
        );
        if (violElMatch) {
          violenceScore = parseScore(violElMatch[1]);
        }
      }

      if (languageScore === null) {
        const langElMatch = text.match(
          /(?:LANGUAGE|PROFANITY)\s*[-–—:]*\s*(\d{1,2})/i,
        );
        if (langElMatch) {
          languageScore = parseScore(langElMatch[1]);
        }
      }
    });
  }

  // If we couldn't find any scores at all, the page likely isn't a valid review
  if (sexualScore === null && violenceScore === null && languageScore === null) {
    return null;
  }

  return {
    sexualScore: sexualScore ?? 0,
    violenceScore: violenceScore ?? 0,
    languageScore: languageScore ?? 0,
    sexualNotes,
    violenceNotes,
    languageNotes,
    sourceUrl,
  };
}

/**
 * Clean up extracted notes text: trim whitespace, collapse multiple spaces/newlines.
 */
function cleanNotes(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000); // Cap length to avoid storing huge blobs
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Kids-In-Mind for a movie and scrape its content ratings.
 *
 * Tries multiple URL patterns since Kids-In-Mind doesn't have a stable
 * search API. Returns null if the movie cannot be found.
 */
export async function scrapeKidsInMind(
  title: string,
  year?: string,
): Promise<KidsInMindResult | null> {
  const slug = buildSlug(title);

  // Try multiple URL patterns that Kids-In-Mind has used over the years
  const candidateUrls: string[] = [
    `https://kids-in-mind.com/${slug}.htm`,
    `https://kids-in-mind.com/${slug}`,
  ];

  // If a year is provided, try year-based directory patterns too
  if (year) {
    candidateUrls.push(`https://kids-in-mind.com/${slug}-${year}.htm`);
    candidateUrls.push(`https://kids-in-mind.com/${year}/${slug}.htm`);
  }

  // Try the search/Google fallback approach
  const searchUrl = `https://kids-in-mind.com/cgi-bin/search/search.pl?q=${encodeURIComponent(title)}`;
  candidateUrls.push(searchUrl);

  for (const url of candidateUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    // If this was a search page, try to find a link to the review
    if (url.includes('search')) {
      const $ = cheerio.load(html);
      const reviewLink = findReviewLink($, title);
      if (reviewLink) {
        const reviewHtml = await fetchPage(reviewLink);
        if (reviewHtml) {
          const result = parseReviewPage(reviewHtml, reviewLink);
          if (result) return result;
        }
      }
      continue;
    }

    // Try parsing this page directly as a review
    const result = parseReviewPage(html, url);
    if (result) return result;
  }

  console.warn(
    `[kids-in-mind] Could not find review for "${title}"${year ? ` (${year})` : ''}`,
  );
  return null;
}

/**
 * Attempt to find a link to a movie review page in search results.
 */
function findReviewLink(
  $: ReturnType<typeof cheerio.load>,
  title: string,
): string | null {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

  let bestLink: string | null = null;

  $('a[href]').each((_i, el) => {
    if (bestLink) return;

    const href = $(el).attr('href');
    const linkText = $(el).text().toLowerCase();

    if (!href) return;

    // Check if the link looks like a review page and matches the title
    const isReviewLink =
      href.endsWith('.htm') &&
      !href.includes('search') &&
      !href.includes('cgi-bin');

    const normalizedLinkText = linkText.replace(/[^a-z0-9]/g, '');
    const titleMatch =
      normalizedLinkText.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedLinkText);

    if (isReviewLink && titleMatch) {
      // Make the URL absolute if it's relative
      if (href.startsWith('http')) {
        bestLink = href;
      } else if (href.startsWith('/')) {
        bestLink = `https://kids-in-mind.com${href}`;
      } else {
        bestLink = `https://kids-in-mind.com/${href}`;
      }
    }
  });

  return bestLink;
}
