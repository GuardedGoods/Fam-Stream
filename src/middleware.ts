import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication (redirect to sign-in page)
const protectedPagePrefixes = ["/watchlist", "/settings", "/admin"];

// API routes that require authentication (return 401)
const protectedApiPrefixes = ["/api/user/", "/api/sync"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if route needs protection
  const isProtectedPage = protectedPagePrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isProtectedApi = protectedApiPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // Check JWT token (works in Edge Runtime - no DB access needed)
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });
  const isAuthenticated = !!token;

  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (isProtectedPage && !isAuthenticated) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/watchlist/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/api/user/:path*",
    "/api/sync/:path*",
  ],
};
