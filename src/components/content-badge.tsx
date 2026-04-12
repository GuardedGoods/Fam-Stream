import { cn } from "@/lib/utils";

/**
 * Content-advisory severity components.
 *
 * Severity maps to a warm-editorial 6-step palette (tokens --score-0..5)
 * instead of Tailwind's default green/amber/orange/red quartet. Severity-5
 * deliberately reuses the primary brick accent so "severe" reads as a
 * stop-cue, not a pastel red.
 *
 * ---
 * Three surfaces:
 *   - <ContentBadge score label/>    — full pill with label, detail page use.
 *   - <ContentDot score/>            — 8px dot, compact.
 *   - <ContentMicroCaption .../>     — `L2 V3 S0 F1` monospaced caption for
 *                                      movie-card captions; more precise
 *                                      than dots (you can read the numbers)
 *                                      and takes the same visual weight.
 */

function getScoreBackgroundVar(score: number): string {
  // Clamp + map to severity-color CSS variable.
  const s = Math.max(0, Math.min(5, Math.round(score)));
  return `var(--score-${s})`;
}

interface ContentBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

export function ContentBadge({ score, label, size = "md" }: ContentBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-white shadow-sm",
          size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-sm",
        )}
        style={{ backgroundColor: getScoreBackgroundVar(score) }}
      >
        {score}
      </span>
      <span
        className={cn(
          "small-caps text-muted-foreground",
          size === "sm" ? "text-[11px]" : "text-xs",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function ContentDot({ score }: { score: number }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: getScoreBackgroundVar(score) }}
      title={`Severity ${score}`}
      aria-label={`Severity ${score}`}
    />
  );
}

/**
 * Editorial micro-caption for movie-card content scores. Renders as
 * `L2 V3 S0 F1` in a monospaced tabular row, with each number color-shifted
 * to its severity hue. Replaces the dots on card surfaces — you can READ
 * the severity, not just sense it by color (colorblind-friendly), and the
 * character-based layout keeps editorial rhythm with the titles above.
 */
interface ContentMicroCaptionProps {
  languageScore: number;
  violenceScore: number;
  sexualContentScore: number;
  scaryScore: number;
  className?: string;
}

export function ContentMicroCaption({
  languageScore,
  violenceScore,
  sexualContentScore,
  scaryScore,
  className,
}: ContentMicroCaptionProps) {
  const cells: Array<{ letter: string; score: number; full: string }> = [
    { letter: "L", score: languageScore, full: "Language" },
    { letter: "V", score: violenceScore, full: "Violence" },
    { letter: "S", score: sexualContentScore, full: "Sexual" },
    { letter: "F", score: scaryScore, full: "Frightening" },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] tabular-nums",
        className,
      )}
      title="Language · Violence · Sexual · Frightening"
    >
      {cells.map(({ letter, score, full }) => (
        <span
          key={letter}
          className="inline-flex items-center gap-0.5"
          title={`${full}: ${score}/5`}
          aria-label={`${full} severity ${score} of 5`}
        >
          <span className="text-muted-foreground">{letter}</span>
          <span
            className="font-semibold"
            style={{ color: getScoreBackgroundVar(score) }}
          >
            {score}
          </span>
        </span>
      ))}
    </div>
  );
}

export { getScoreBackgroundVar };
