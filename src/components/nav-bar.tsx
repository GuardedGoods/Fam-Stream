"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, Menu, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";

/**
 * NavBar — slim editorial chrome.
 *
 * Design notes:
 *   - No logo icon — the Fraunces wordmark is the mark. Cinema marquees,
 *     film-magazine mastheads, and Mubi-style editorial all use just
 *     type. A bolted-on icon is the SaaS tell we're rejecting.
 *   - 48px height (was 56) so the mark reads as a tight top rule, not a
 *     chunky app bar. Posters breathe below.
 *   - Links hang on the right in Public Sans, weight 500, small-cap ish
 *     (we use all-small-caps via `.small-caps`) so they feel like section
 *     headers rather than button labels.
 *   - Mobile menu opens a full-screen sheet with oversized type — app-like
 *     on phones, not a dropdown afterthought.
 */

interface NavBarProps {
  onSearch?: (query: string) => void;
}

export function NavBar({ onSearch }: NavBarProps = {}) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user ?? null;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignIn = () => signIn("google", { callbackUrl: "/" });
  const handleSignOut = () => signOut({ callbackUrl: "/" });

  const handleSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
      return;
    }
    const q = query.trim();
    if (!q) return;
    router.push(`/movies?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-12 max-w-7xl items-center px-4 sm:px-6">
        {/* Wordmark — Fraunces, no icon. "Night" picks up a secondary hue
            so the mark reads as two beats, like a film-magazine masthead. */}
        <Link
          href="/"
          className="mr-8 font-serif text-lg font-medium tracking-tight text-foreground"
        >
          Movie<span className="text-primary">Night</span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          <Link
            href="/movies"
            className="small-caps text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse
          </Link>
          {user && (
            <Link
              href="/watchlist"
              className="small-caps text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Watchlist
            </Link>
          )}
          {user && (
            <Link
              href="/settings"
              className="small-caps text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          )}
        </nav>

        {/* Desktop — search + user */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          {searchOpen ? (
            <div className="flex items-center gap-2">
              <SearchBar onSearch={handleSearch} autoFocus className="w-64" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {user ? (
            <div className="flex items-center gap-2 pl-2">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "User"}
                  className="h-7 w-7 rounded-full ring-1 ring-border"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {(user.name ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" onClick={handleSignIn}>
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile — search + hamburger */}
        <div className="flex items-center gap-1 ml-auto md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile search */}
      {searchOpen && (
        <div className="border-t border-border px-4 py-2 md:hidden">
          <SearchBar onSearch={handleSearch} autoFocus />
        </div>
      )}

      {/* Mobile menu — full-width sheet, oversized editorial type */}
      {mobileMenuOpen && (
        <div className="border-t border-border md:hidden">
          <nav className="flex flex-col p-6 gap-1">
            <Link
              href="/movies"
              onClick={() => setMobileMenuOpen(false)}
              className="font-serif text-2xl text-foreground py-2"
            >
              Browse
            </Link>
            {user && (
              <Link
                href="/watchlist"
                onClick={() => setMobileMenuOpen(false)}
                className="font-serif text-2xl text-foreground py-2"
              >
                Watchlist
              </Link>
            )}
            {user && (
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="font-serif text-2xl text-foreground py-2"
              >
                Settings
              </Link>
            )}

            <div className="my-4 h-px bg-border" />

            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name ?? "User"}
                      className="h-9 w-9 rounded-full ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {(user.name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {user.name ?? "User"}
                    </span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button variant="default" size="lg" onClick={handleSignIn}>
                Sign In
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
