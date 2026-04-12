"use client";

import Image from "next/image";
import { RotateCcw } from "lucide-react";
import { cn, getImageUrl } from "@/lib/utils";
import { maskProfanity } from "@/lib/filters/mask";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SearchBar } from "@/components/search-bar";
import type { MovieFilters } from "@/types";

interface StreamingProvider {
  id: number;
  name: string;
  logoPath?: string | null;
}

interface FilterPanelProps {
  currentFilters: MovieFilters;
  onFilterChange: (filters: Partial<MovieFilters>) => void;
  streamingProviders: StreamingProvider[];
  genres: string[];
}

const MPAA_RATINGS = ["G", "PG", "PG-13", "R"];

function FilterContent({
  currentFilters,
  onFilterChange,
  streamingProviders,
  genres: genreNames,
}: FilterPanelProps) {
  function updateFilter(updates: Partial<MovieFilters>) {
    onFilterChange({ ...currentFilters, ...updates });
  }

  function toggleArrayItem<T>(arr: T[] | undefined, item: T): T[] {
    const current = arr ?? [];
    return current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
  }

  function resetFilters() {
    onFilterChange({
      page: 1,
      limit: currentFilters.limit,
    });
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block">
          Search
        </Label>
        <SearchBar
          onSearch={(query) => updateFilter({ search: query || undefined })}
          defaultValue={currentFilters.search ?? ""}
        />
      </div>

      <Separator />

      {/* MPAA Rating */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          MPAA Rating
        </Label>
        <div className="flex flex-wrap gap-3">
          {MPAA_RATINGS.map((rating) => {
            const checked = currentFilters.mpaaRatings?.includes(rating) ?? false;
            return (
              <div key={rating} className="flex items-center gap-1.5">
                <Checkbox
                  id={`mpaa-${rating}`}
                  checked={checked}
                  onCheckedChange={() =>
                    updateFilter({
                      mpaaRatings: toggleArrayItem(
                        currentFilters.mpaaRatings,
                        rating
                      ),
                    })
                  }
                />
                <Label
                  htmlFor={`mpaa-${rating}`}
                  className="text-sm cursor-pointer"
                >
                  {rating}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Region */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          Region
        </Label>
        <div className="flex items-center justify-between">
          <Label htmlFor="us-only" className="text-sm cursor-pointer">
            US market only
          </Label>
          <Switch
            id="us-only"
            checked={currentFilters.usOnly ?? false}
            onCheckedChange={(checked) => updateFilter({ usOnly: checked })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Hides non-English, foreign-market productions.
        </p>
      </div>

      <Separator />

      {/* Content Score Sliders */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          Max Content Scores
        </Label>
        <div className="space-y-4">
          {/* Language */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Language</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxLanguageScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxLanguageScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxLanguageScore: val })
              }
            />
          </div>

          {/* Violence */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Violence</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxViolenceScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxViolenceScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxViolenceScore: val })
              }
            />
          </div>

          {/* Sexual Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sexual</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxSexualContentScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxSexualContentScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxSexualContentScore: val })
              }
            />
          </div>

          {/* Scary */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Scary</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxScaryScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxScaryScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxScaryScore: val })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Mature Themes — backed by IMDb Parental Guide severity columns.
          Sliders map to 0-5 normalized (None=0, Mild=1, Moderate=3, Severe=5)
          same as the 4 core sliders. Set to 5 = no filter applied. */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          Mature Themes
        </Label>
        <div className="space-y-4">
          {/* Alcohol / Drugs / Smoking */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Alcohol, Drugs &amp; Smoking</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxAlcoholDrugsScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxAlcoholDrugsScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxAlcoholDrugsScore: val })
              }
            />
          </div>

          {/* Frightening / Intense Scenes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Frightening / Intense Scenes</Label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {currentFilters.maxIntenseScenesScore ?? 5}
              </span>
            </div>
            <Slider
              min={0}
              max={5}
              step={1}
              value={[currentFilters.maxIntenseScenesScore ?? 5]}
              onValueChange={([val]) =>
                updateFilter({ maxIntenseScenesScore: val })
              }
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Sourced from IMDb Parental Guide severity labels.
        </p>
      </div>

      <Separator />

      {/* Blocked Words */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          Block Specific Words
        </Label>
        <div className="flex flex-wrap gap-2">
          {["f-word", "s-word", "damn", "hell", "ass", "bitch", "bastard", "crap", "goddamn"].map((word) => {
            const checked = currentFilters.blockedWords?.includes(word) ?? false;
            return (
              <button
                key={word}
                type="button"
                onClick={() =>
                  updateFilter({
                    blockedWords: toggleArrayItem(currentFilters.blockedWords, word),
                  })
                }
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium font-mono border transition-colors",
                  checked
                    ? "bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
                )}
                title={`Block movies containing this word`}
              >
                {maskProfanity(word)}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Movies containing selected words will be hidden
        </p>
      </div>

      <Separator />

      {/* Streaming Services — logo tiles */}
      {streamingProviders.length > 0 && (
        <>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
              Streaming Services
            </Label>
            <div
              className="grid grid-cols-4 gap-2"
              role="group"
              aria-label="Filter by streaming service"
            >
              {streamingProviders.map((provider) => {
                const checked =
                  currentFilters.streamingServices?.includes(provider.id) ??
                  false;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() =>
                      updateFilter({
                        streamingServices: toggleArrayItem(
                          currentFilters.streamingServices,
                          provider.id
                        ),
                      })
                    }
                    aria-pressed={checked}
                    aria-label={provider.name}
                    title={provider.name}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 overflow-hidden transition-all",
                      checked
                        ? "border-primary ring-2 ring-primary/40 scale-105"
                        : "border-gray-200 dark:border-gray-700 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    )}
                  >
                    {provider.logoPath ? (
                      <Image
                        src={getImageUrl(provider.logoPath, "w92")}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {provider.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Release Year */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
          Release Year
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="min-year" className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              From
            </Label>
            <Input
              id="min-year"
              type="number"
              min={1900}
              max={2099}
              placeholder="Min"
              value={currentFilters.minYear ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                updateFilter({
                  minYear: raw === "" ? undefined : Number(raw),
                });
              }}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="max-year" className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              To
            </Label>
            <Input
              id="max-year"
              type="number"
              min={1900}
              max={2099}
              placeholder="Max"
              value={currentFilters.maxYear ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                updateFilter({
                  maxYear: raw === "" ? undefined : Number(raw),
                });
              }}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Genres */}
      {genreNames.length > 0 && (
        <>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
              Genres
            </Label>
            <div className="flex flex-wrap gap-2">
              {genreNames.map((genre) => {
                const checked =
                  currentFilters.genres?.includes(genre) ?? false;
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() =>
                      updateFilter({
                        genres: toggleArrayItem(
                          currentFilters.genres,
                          genre
                        ),
                      })
                    }
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      checked
                        ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
                    )}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="hide-watched" className="text-sm cursor-pointer">
            Hide Watched
          </Label>
          <Switch
            id="hide-watched"
            checked={currentFilters.hideWatched ?? false}
            onCheckedChange={(checked) =>
              updateFilter({ hideWatched: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="hide-unrated" className="text-sm cursor-pointer">
            Hide Unrated
          </Label>
          <Switch
            id="hide-unrated"
            checked={currentFilters.hideUnrated ?? false}
            onCheckedChange={(checked) =>
              updateFilter({ hideUnrated: checked })
            }
          />
        </div>
      </div>

      <Separator />

      {/* Reset */}
      <Button
        variant="outline"
        className="w-full"
        onClick={resetFilters}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset Filters
      </Button>
    </div>
  );
}

export function FilterPanel(props: FilterPanelProps) {
  return <FilterContent {...props} />;
}
