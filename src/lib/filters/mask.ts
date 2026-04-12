/**
 * Present a blocked-word in a human-scannable but non-literal form:
 * first letter, dashes for the interior, last letter. `fuck → f--k`.
 *
 * The raw word is still stored in the DB and still used for matching — this
 * helper exists purely to keep the UI from enumerating every profanity
 * verbatim (a user request on this feature).
 *
 * Strings of length <= 2, or that already contain a hyphen (e.g. preset
 * labels like `f-word`), are returned unchanged — there's nothing
 * meaningful to mask.
 */
export function maskProfanity(word: string): string {
  if (!word) return word;
  if (word.length <= 2) return word;
  if (word.includes("-")) return word;

  const first = word[0];
  const last = word[word.length - 1];
  return `${first}${"-".repeat(word.length - 2)}${last}`;
}
