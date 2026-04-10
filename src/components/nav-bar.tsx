"use client";

import { useState } from "react";
import Link from "next/link";
import { Film, Search, Menu, User, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";

interface NavBarProps {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
  onSearch?: (query: string) => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export function NavBar({ user, onSearch, onSignIn, onSignOut }: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95 dark:supports-[backdrop-filter]:bg-gray-950/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-gray-100 mr-6"
        >
          <Film className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Fam-Stream</span>
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
          {searchOpen && onSearch ? (
            <div className="flex items-center gap-2">
              <SearchBar
                onSearch={onSearch}
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
              {onSignOut && (
                <Button variant="ghost" size="icon" onClick={onSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign out</span>
                </Button>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onSignIn}>
              <User className="h-4 w-4 mr-1" />
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile: search + hamburger */}
        <div className="flex items-center gap-1 ml-auto md:hidden">
          {onSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
          )}
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
      {searchOpen && onSearch && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 md:hidden">
          <SearchBar onSearch={onSearch} autoFocus />
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
                {onSignOut && (
                  <Button variant="ghost" size="sm" onClick={onSignOut}>
                    <LogOut className="h-4 w-4 mr-1" />
                    Sign Out
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mx-3"
                onClick={onSignIn}
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
