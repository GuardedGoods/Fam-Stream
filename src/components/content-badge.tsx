import { cn } from "@/lib/utils";

interface ContentBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

function getScoreColor(score: number): string {
  if (score <= 1) return "bg-green-500 text-white";
  if (score <= 3) return "bg-amber-500 text-white";
  if (score === 4) return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

function getScoreDotColor(score: number): string {
  if (score <= 1) return "bg-green-500";
  if (score <= 3) return "bg-amber-500";
  if (score === 4) return "bg-orange-500";
  return "bg-red-500";
}

export function ContentBadge({ score, label, size = "md" }: ContentBadgeProps) {
  const colorClass = getScoreColor(score);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold",
          colorClass,
          size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs"
        )}
      >
        {score}
      </span>
      <span
        className={cn(
          "text-gray-600 dark:text-gray-400",
          size === "sm" ? "text-[11px]" : "text-xs"
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
      className={cn("inline-block h-2 w-2 rounded-full", getScoreDotColor(score))}
      title={`Score: ${score}`}
    />
  );
}

export { getScoreColor, getScoreDotColor };
