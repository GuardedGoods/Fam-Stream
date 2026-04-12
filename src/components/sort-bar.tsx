"use client";

import { ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MovieFilters } from "@/types";

export const SORT_OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "imdb_rating", label: "Rating" },
  { value: "rt_score", label: "Rotten Tomatoes" },
  { value: "release_date", label: "Release Date" },
  { value: "title", label: "Title" },
] as const;

interface SortBarProps {
  sort: MovieFilters["sort"];
  sortDirection: MovieFilters["sortDirection"];
  onChange: (
    updates: Pick<MovieFilters, "sort" | "sortDirection">,
  ) => void;
  className?: string;
}

export function SortBar({
  sort,
  sortDirection,
  onChange,
  className,
}: SortBarProps) {
  const effectiveSort = sort ?? "popularity";
  const effectiveDir = sortDirection ?? "desc";

  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${className ?? ""}`}
      aria-label="Sort controls"
    >
      {/* "Sort" label is redundant on mobile where the dropdown speaks for
          itself. Hidden below sm so the select + direction button fit
          comfortably on narrow viewports. */}
      <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Sort
      </span>
      <Select
        value={effectiveSort}
        onValueChange={(val) =>
          onChange({
            sort: val as MovieFilters["sort"],
            sortDirection: effectiveDir,
          })
        }
      >
        <SelectTrigger className="h-9 w-full sm:w-[160px] min-w-0">
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
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() =>
          onChange({
            sort: effectiveSort,
            sortDirection: effectiveDir === "desc" ? "asc" : "desc",
          })
        }
        aria-label={
          effectiveDir === "desc" ? "Sort descending" : "Sort ascending"
        }
        title={effectiveDir === "desc" ? "Descending" : "Ascending"}
      >
        {effectiveDir === "desc" ? (
          <ArrowDownNarrowWide className="h-4 w-4" />
        ) : (
          <ArrowUpNarrowWide className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
