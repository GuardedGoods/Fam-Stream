import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
      <head>
        {/*
         * Fonts — Fraunces (serif, editorial headlines) + Public Sans
         * (humanist sans, body/UI). Loaded via Google Fonts CSS at runtime
         * rather than next/font because the repo's Docker build host may
         * not have outbound internet; this approach degrades gracefully to
         * system fonts if the stylesheet fails to load. The preconnect
         * hints are the standard recommendation for minimizing FOUT.
         */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1c1917" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider session={session}>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border mt-16 py-8 text-center small-caps text-xs text-muted-foreground">
            MovieNight — Family Movie Night, Made Easy
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
