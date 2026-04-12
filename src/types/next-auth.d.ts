import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Fields we hydrate onto the session beyond the NextAuth defaults.
   */
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
  }
}
