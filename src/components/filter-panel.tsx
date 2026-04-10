"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SearchBar } from "@/components/search-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MovieFilters } from "@/types";

interface StreamingProvider {
  id: number;
  name: string;
}

interface FilterPanelProps {
  currentFilters: MovieFilters;
  onFilterChange: (filters: Partial<MovieFilters>) => void;
  streamingProviders: StreamingProvider[];
  genres: string[];
}

const MPAA_RATINGS = ["G", "PG", "PG-13", "R"];

const SORT_OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "imdb_rating", label: "Rating" },
  { value: "release_date", label: "Release Date" },
  { value: "title", label: "Title" },
] as const;

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

      {/* Streaming Services */}
      {streamingProviders.length > 0 && (
        <>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 block">
              Streaming Services
            </Label>
            <div className="flex flex-wrap gap-3">
              {streamingProviders.map((provider) => {
                const checked =
                  currentFilters.streamingServices?.includes(provider.id) ??
                  false;
                return (
                  <div key={provider.id} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`provider-${provider.id}`}
                      checked={checked}
                      onCheckedChange={() =>
                        updateFilter({
                          streamingServices: toggleArrayItem(
                            currentFilters.streamingServices,
                            provider.id
                          ),
                        })
                      }
                    />
                    <Label
                      htmlFor={`provider-${provider.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {provider.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
          <Separator />
        </>
      )}

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

      {/* Sort */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block">
          Sort By
        </Label>
        <Select
          value={currentFilters.sort ?? "popularity"}
          onValueChange={(val) =>
            updateFilter({
              sort: val as MovieFilters["sort"],
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

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
