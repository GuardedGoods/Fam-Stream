import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js v5 configuration.
 *
 * This is the shared config consumed by both:
 *   - `src/lib/auth/index.ts` — the Node runtime instance used by API
 *     routes and server components. It extends this config with the
 *     DrizzleAdapter (which needs better-sqlite3 and therefore can't run
 *     in Edge).
 *   - `src/proxy.ts` — the Next.js 16 proxy (middleware) which runs in
 *     the Edge runtime. It initializes NextAuth with this config alone,
 *     no adapter, giving it access to a cookie-aware `auth()` helper that
 *     correctly decodes the v5 session JWT (`__Secure-authjs.session-token`
 *     on HTTPS, `authjs.session-token` on HTTP).
 *
 * The legacy v4 `getToken()` helper does NOT reliably find the v5 cookie
 * name under an HTTPS reverse proxy, which is why proxying must use the
 * v5 `auth()` wrapper instead. See the Auth.js v5 migration guide.
 */

function parseAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (token.email) {
        token.isAdmin = parseAdminEmails().has(token.email.toLowerCase());
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      if (session.user) {
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
} satisfies NextAuthConfig;
