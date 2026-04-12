"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Film, Search, Menu, User, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";

interface NavBarProps {
  // Optional: let callers inject custom search behavior. If absent, the search
  // bar navigates to the movies page with ?search=<query>.
  onSearch?: (query: string) => void;
}

export function NavBar({ onSearch }: NavBarProps = {}) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user ?? null;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignIn = () => {
    // Go through Auth.js's signIn() so NEXTAUTH_URL and CSRF are handled for us.
    signIn("google", { callbackUrl: "/" });
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

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
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95 dark:supports-[backdrop-filter]:bg-gray-950/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-gray-100 mr-6"
        >
          <Film className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">MovieNight</span>
        </Link>

        {/* Center: Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          <Link
            href="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            Browse
          </Link>
          <Link
            href="/watchlist"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            Watchlist
          </Link>
        </nav>

        {/* Desktop search + user area */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          {searchOpen ? (
            <div className="flex items-center gap-2">
              <SearchBar
                onSearch={handleSearch}
                autoFocus
                className="w-64"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close search</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? "User"}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleSignIn}>
              <User className="h-4 w-4 mr-1" />
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile: search + hamburger */}
        <div className="flex items-center gap-1 ml-auto md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 md:hidden">
          <SearchBar onSearch={handleSearch} autoFocus />
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 dark:border-gray-800 md:hidden">
          <nav className="flex flex-col px-4 py-3 space-y-1">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Film className="h-4 w-4" />
              Browse
            </Link>
            <Link
              href="/watchlist"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Watchlist
            </Link>

            <div className="my-1 h-px bg-gray-200 dark:bg-gray-800" />

            {user ? (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name ?? "User"}
                      className="h-7 w-7 rounded-full"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {user.name ?? "User"}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mx-3"
                onClick={handleSignIn}
              >
                <User className="h-4 w-4 mr-1" />
                Sign In
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
