"use client";

/**
 * /settings — per-user preferences.
 *
 * Editorial refresh:
 *   - Fraunces masthead "Settings" at 5xl
 *   - Sections delimited by small-caps rule labels, no lucide section icons
 *     (icon-plus-heading is the SaaS chrome pattern)
 *   - Sliders render the score token as the thumb color so the 0-5 scale
 *     reads visually (green → brick)
 *   - Streaming services render as a logo grid (matches the filter panel
 *     so the surface is consistent)
 *   - Blocked words: masked presentation (f--k), compact monospace chips
 *   - Save affordance uses the Button primitive with primary variant
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { maskProfanity } from "@/lib/filters/mask";
import { cn, getImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StreamingService {
  id: number;
  name: string;
  logoPath: string | null;
  active: boolean;
}

const MPAA_OPTIONS = ["G", "PG", "PG-13", "R"];

export default function SettingsPage() {
  const [services, setServices] = useState<StreamingService[]>([]);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState("");
  const [maxLanguage, setMaxLanguage] = useState(2);
  const [maxViolence, setMaxViolence] = useState(3);
  const [maxSexual, setMaxSexual] = useState(1);
  const [maxScary, setMaxScary] = useState(2);
  const [maxMpaa, setMaxMpaa] = useState("PG");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/user/services").then((r) => r.json()),
      fetch("/api/user/blocked-words").then((r) => r.json()),
    ])
      .then(([servicesData, wordsData]) => {
        setServices(servicesData.services || []);
        setBlockedWords(wordsData.words || []);
        if (servicesData.filterProfile) {
          const p = servicesData.filterProfile;
          setMaxLanguage(p.maxLanguageScore ?? 2);
          setMaxViolence(p.maxViolenceScore ?? 3);
          setMaxSexual(p.maxSexualContentScore ?? 1);
          setMaxScary(p.maxScaryScore ?? 2);
          setMaxMpaa(p.maxMpaa ?? "PG");
        }
      })
      .catch(() => {});
  }, []);

  const toggleService = (id: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  };

  const addBlockedWord = () => {
    const word = newWord.trim().toLowerCase();
    if (word && !blockedWords.includes(word)) {
      setBlockedWords((prev) => [...prev, word]);
      setNewWord("");
    }
  };

  const removeBlockedWord = (word: string) => {
    setBlockedWords((prev) => prev.filter((w) => w !== word));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await Promise.all([
        fetch("/api/user/services", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            services: services.filter((s) => s.active).map((s) => s.id),
          }),
        }),
        fetch("/api/user/blocked-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: blockedWords }),
        }),
        // Phase 4B: persist content-threshold sliders via the new
        // filter-profile route so Browse can seed them on mount.
        fetch("/api/user/filter-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxLanguageScore: maxLanguage,
            maxViolenceScore: maxViolence,
            maxSexualContentScore: maxSexual,
            maxScaryScore: maxScary,
            maxMpaa,
          }),
        }),
      ]);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-3xl py-10">
      <header className="mb-12">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight">
          Settings
        </h1>
        <p className="small-caps text-[11px] text-muted-foreground mt-2">
          Services · Content · Blocked words
        </p>
      </header>

      {/* Streaming Services */}
      <Section
        label="My Streaming Services"
        helper="Select the services you subscribe to. Films are filtered to only what's available."
      >
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Streaming services will appear here once the sync has completed.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                aria-pressed={service.active}
                title={service.name}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                  service.active
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border opacity-50 grayscale hover:opacity-100 hover:grayscale-0",
                )}
              >
                {service.logoPath ? (
                  <Image
                    src={getImageUrl(service.logoPath, "w92")}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold">
                    {service.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Content Filter Thresholds */}
      <Section
        label="Content Thresholds"
        helper="Maximum severity (0 clean → 5 extreme) tolerated for each category."
      >
        <div className="space-y-6">
          <SliderSetting
            label="Language"
            value={maxLanguage}
            onChange={setMaxLanguage}
          />
          <SliderSetting
            label="Violence"
            value={maxViolence}
            onChange={setMaxViolence}
          />
          <SliderSetting
            label="Sexual Content"
            value={maxSexual}
            onChange={setMaxSexual}
          />
          <SliderSetting
            label="Frightening"
            value={maxScary}
            onChange={setMaxScary}
          />

          <div>
            <p className="small-caps text-[11px] text-muted-foreground mb-2">
              Max MPAA Rating
            </p>
            <div className="flex gap-2">
              {MPAA_OPTIONS.map((rating) => (
                <button
                  key={rating}
                  onClick={() => setMaxMpaa(rating)}
                  className={cn(
                    "px-4 py-2 rounded-md border text-sm font-semibold transition-colors",
                    maxMpaa === rating
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Blocked Words */}
      <Section
        label="Blocked Words"
        helper="Films whose advisory notes contain any of these words are hidden."
      >
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlockedWord()}
            placeholder="Add a word…"
            className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={addBlockedWord} variant="default" size="default">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {blockedWords.map((word) => (
            <span
              key={word}
              title="Word hidden — click × to remove"
              className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-sm"
            >
              {maskProfanity(word)}
              <button
                onClick={() => removeBlockedWord(word)}
                className="hover:bg-destructive/20 rounded p-0.5"
                aria-label={`Remove ${word}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {blockedWords.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No blocked words set.
            </p>
          )}
        </div>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-6 border-t border-border">
        <Button onClick={handleSave} disabled={saving} variant="default" size="lg">
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {message && (
          <span
            className={cn(
              "small-caps text-[11px]",
              message.includes("Failed")
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 pb-10 border-b border-border last:border-b-0">
      <header className="mb-5">
        <h2 className="small-caps text-[11px] text-muted-foreground">
          {label}
        </h2>
        {helper && (
          <p className="text-sm text-muted-foreground mt-1 max-w-prose">
            {helper}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * 0-5 slider with the value rendered as a score-colored figure. The thumb
 * takes the score token for its current value, so the bar itself visualizes
 * "how far into dangerous territory" the setting lives.
 */
function SliderSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold text-white tabular-nums"
          style={{ backgroundColor: `var(--score-${value})` }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
      />
      <div className="flex justify-between small-caps text-[10px] text-muted-foreground mt-1">
        <span>None</span>
        <span>Extreme</span>
      </div>
    </div>
  );
}
