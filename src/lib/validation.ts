/**
 * Shared input-validation helpers for API route handlers.
 *
 * Each helper is a pure function that returns a validated value or a
 * fallback. No side effects, no exceptions — callers decide what to
 * do with invalid input (return 400, use default, etc.).
 */

export function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function clampInt(
  raw: string | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

export function clampScore(v: unknown, fallback: number): number {
  if (typeof v !== "number" || isNaN(v)) return fallback;
  return Math.max(0, Math.min(Math.round(v), 5));
}

export function escapeLikePattern(s: string): string {
  return s.replace(/[%_]/g, "\\$&");
}

export function validateIdArray(arr: unknown): number[] | null {
  if (!Array.isArray(arr)) return null;
  if (!arr.every(isPositiveInt)) return null;
  return arr;
}

/**
 * Standard API error response shape. Every route should return errors
 * in this format so the frontend can reliably check `res.error`.
 */
export interface ApiError {
  error: string;
  details?: string;
}

export function apiError(
  message: string,
  status: number,
  details?: string,
): Response {
  const body: ApiError = { error: message };
  if (details) body.details = details;
  return Response.json(body, { status });
}
