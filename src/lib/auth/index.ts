import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { authConfig } from "./config";

/**
 * Full (Node runtime) Auth.js configuration: the Edge-safe base config
 * from `./config` plus the Drizzle adapter, which handles OAuth account
 * linking against our SQLite users/accounts/sessions tables. The adapter
 * can't run in Edge because better-sqlite3 is native, so this instance
 * is only safe to import from server components, API routes, and
 * server actions — never from `src/proxy.ts`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // The @auth/drizzle-adapter types model emailVerified as a JS Date, but
  // SQLite stores it as an integer epoch — Drizzle's column type therefore
  // doesn't satisfy the adapter's strict type. The runtime behaviour is
  // correct; we cast at the boundary rather than fight the types.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any),
});
