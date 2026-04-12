import OpenAI from "openai";

/**
 * Thin wrapper around the OpenAI client.
 *
 * Graceful-missing behavior: if `OPENAI_API_KEY` is not set, this module
 * exports `null` for the client and `isOpenAiEnabled()` returns false.
 * Callers check that flag before using the client — the recommendations
 * feature then renders a "Recommendations aren't configured" empty state
 * instead of crashing, and the admin dashboard shows the env dot red.
 */

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey });
  return _client;
}

export function isOpenAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAi(): OpenAI | null {
  return getClient();
}

/**
 * Default model. gpt-4o-mini is roughly 60× cheaper than gpt-4o for
 * recommendation-style JSON tasks while producing quality ≈ as good for
 * the prompt shape we send. Tuning knob — admins can override via
 * OPENAI_MODEL if they want to upgrade.
 */
export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
