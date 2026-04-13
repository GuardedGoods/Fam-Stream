"use client";

import { ExternalLink } from "lucide-react";
import { ContentBadge } from "@/components/content-badge";
import { maskProfanity } from "@/lib/filters/mask";

/**
 * Per-source content-rating breakdown — collapsible `<details>` strips,
 * one per scraper source (Kids-In-Mind, Common Sense Media, IMDb Parental
 * Guide).
 *
 * Split out into a Client Component in Phase 4H because the "open source"
 * external-link icon inside the `<summary>` row needs an
 * `onClick={(e) => e.stopPropagation()}` to prevent the click from also
 * toggling the `<details>` panel. Event handlers can't be passed from
 * a Server Component to a Client Component, so the whole block has to
 * be a Client Component — otherwise the detail page throws
 * "Error: Event handlers cannot be passed to Client Component props"
 * (Next.js digest 2877816754) for every movie that has source URLs.
 *
 * Props are entirely serializable: plain objects + primitives. No
 * functions crossing the server/client boundary.
 */

export interface ContentSource {
  source: string;
  languageScore: number | null;
  violenceScore: number | null;
  sexualContentScore: number | null;
  scaryScore: number | null;
  languageNotes: string | null;
  violenceNotes: string | null;
  sexualNotes: string | null;
  scaryNotes: string | null;
  profanityWords: Record<string, number>;
  recommendedAge: number | null;
  sourceUrl: string | null;
}

function formatSourceName(source: string): string {
  switch (source) {
    case "kids-in-mind":
      return "Kids-In-Mind";
    case "imdb":
      return "IMDb Parental Guide";
    case "common-sense-media":
      return "Common Sense Media";
    default:
      return source;
  }
}

export function SourceBreakdown({ sources }: { sources: ContentSource[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <section className="mt-16 mb-20 space-y-5">
      <h2 className="small-caps text-[12px] text-muted-foreground">
        Ratings by Source
      </h2>
      <div className="space-y-3">
        {sources.map((source) => (
          <details
            key={source.source}
            className="group border border-border overflow-hidden rounded-md transition-colors hover:border-foreground/20"
          >
            <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-serif text-base truncate">
                  {formatSourceName(source.source)}
                </span>
                {source.recommendedAge && (
                  <span className="small-caps text-[10px] text-muted-foreground shrink-0">
                    Ages {source.recommendedAge}+
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {source.languageScore !== null && (
                  <ContentBadge
                    score={source.languageScore}
                    label="L"
                    size="sm"
                  />
                )}
                {source.violenceScore !== null && (
                  <ContentBadge
                    score={source.violenceScore}
                    label="V"
                    size="sm"
                  />
                )}
                {source.sexualContentScore !== null && (
                  <ContentBadge
                    score={source.sexualContentScore}
                    label="S"
                    size="sm"
                  />
                )}
                {source.scaryScore !== null && (
                  <ContentBadge score={source.scaryScore} label="F" size="sm" />
                )}
                {source.sourceUrl && (
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary ml-1 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Open source"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </summary>
            <div className="border-t border-border p-5 space-y-4 bg-muted/20">
              {Object.keys(source.profanityWords).length > 0 && (
                <div>
                  <p className="small-caps text-[10px] text-muted-foreground mb-2">
                    Language Found
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(source.profanityWords).map(
                      ([word, count]) => (
                        <span
                          key={word}
                          title={`${word}${count && count > 1 ? ` — ${count}×` : ""}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded-sm"
                        >
                          <span>{maskProfanity(word)}</span>
                          {count && count > 1 && (
                            <span className="text-destructive/70 tabular-nums">
                              ×{count}
                            </span>
                          )}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {source.languageNotes && (
                <SourceNote label="Language" text={source.languageNotes} />
              )}
              {source.violenceNotes && (
                <SourceNote label="Violence" text={source.violenceNotes} />
              )}
              {source.sexualNotes && (
                <SourceNote label="Sexual Content" text={source.sexualNotes} />
              )}
              {source.scaryNotes && (
                <SourceNote label="Frightening" text={source.scaryNotes} />
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function SourceNote({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="small-caps text-[10px] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-[13px] text-foreground/85 leading-relaxed">{text}</p>
    </div>
  );
}
