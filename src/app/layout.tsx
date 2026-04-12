import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { SessionProvider } from "@/components/session-provider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "MovieNight | Family Movie Night Made Easy",
  description:
    "A family-first streaming guide that filters movies based on your parental guidelines. Find age-appropriate movies across all your streaming services.",
  keywords: ["family movies", "content filter", "parental guide", "streaming"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session once on the server so the first paint has the correct auth
  // state and the client provider hydrates without an extra round-trip.
  const session = await auth();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider session={session}>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
            <p>MovieNight &mdash; Family Movie Night Made Easy</p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
