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

/**
 * `viewportFit: "cover"` extends the page under iOS notch / home-indicator
 * areas. globals.css pads the body with `env(safe-area-inset-*)` so nothing
 * is actually obscured — this just means the background runs edge-to-edge.
 * `maximumScale: 1` stops iOS from zooming the page when a text input is
 * focused (a UX annoyance on forms like the search bar).
 */
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
