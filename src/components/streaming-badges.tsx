import Image from "next/image";
import { cn, getImageUrl } from "@/lib/utils";
import type { StreamingProviderInfo } from "@/types";

interface StreamingBadgesProps {
  providers: StreamingProviderInfo[];
  size?: "sm" | "md";
}

export function StreamingBadges({ providers, size = "sm" }: StreamingBadgesProps) {
  if (!providers || providers.length === 0) return null;

  const iconSize = size === "sm" ? 20 : 28;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {providers.map((provider) => {
        const isFlatrate = provider.type === "flatrate";
        const badge = (
          <div
            key={`${provider.id}-${provider.type}`}
            className={cn(
              "relative rounded-md overflow-hidden border",
              isFlatrate
                ? "border-gray-300 dark:border-gray-600"
                : "border-gray-200 dark:border-gray-700 opacity-60 grayscale"
            )}
            title={`${provider.name} (${provider.type})`}
          >
            {provider.logoPath ? (
              <Image
                src={getImageUrl(provider.logoPath, "w92")}
                alt={provider.name}
                width={iconSize}
                height={iconSize}
                className="block"
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-[8px] font-medium text-gray-500 dark:text-gray-400",
                  size === "sm" ? "h-5 w-5" : "h-7 w-7"
                )}
              >
                {provider.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        );

        if (provider.link) {
          return (
            <a
              key={`${provider.id}-${provider.type}`}
              href={provider.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex hover:opacity-80 transition-opacity"
            >
              {badge}
            </a>
          );
        }

        return badge;
      })}
    </div>
  );
}
