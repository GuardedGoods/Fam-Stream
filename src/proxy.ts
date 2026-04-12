import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

/**
 * Edge-safe Auth.js v5 instance for use in the Next.js 16 proxy (renamed
 * from `middleware` in Next 16). Initialized with only the JWT-aware
 * config — no DB adapter — because this file runs in the Edge runtime.
 *
 * The resulting `auth()` wrapper decodes the v5 session cookie using the
 * correct name (`__Secure-authjs.session-token` over HTTPS, plain
 * `authjs.session-token` over HTTP) and exposes the session on `req.auth`.
 * The v4-era `getToken()` helper this file previously used did NOT find
 * the cookie under an HTTPS reverse proxy, which broke /watchlist and
 * every /api/user/* call for logged-in users.
 */
const { auth: authProxy } = NextAuth(authConfig);

// Routes that require authentication (redirect to sign-in page)
const protectedPagePrefixes = [
  "/watchlist",
  "/settings",
  "/admin",
  "/recommendations",
];

// API routes that require authentication (return 401)
const protectedApiPrefixes = [
  "/api/user/",
  "/api/sync",
  "/api/recommendations",
  "/api/admin",
];

export const proxy = authProxy((req) => {
  const { pathname } = req.nextUrl;

  // Allow public endpoints
  if (pathname === "/api/sync/init") {
    return NextResponse.next();
  }

  const isProtectedPage = protectedPagePrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isProtectedApi = protectedApiPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const isAuthenticated = !!req.auth;

  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (isProtectedPage && !isAuthenticated) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/watchlist/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/recommendations/:path*",
    "/api/user/:path*",
    "/api/sync/:path*",
    "/api/recommendations/:path*",
    "/api/admin/:path*",
  ],
};
