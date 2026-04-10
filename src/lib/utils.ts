import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null, size: string = 'w500'): string {
  if (!path) return '/icons/no-poster.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getYear(dateStr: string | null): string {
  if (!dateStr) return '';
  return dateStr.substring(0, 4);
}

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
