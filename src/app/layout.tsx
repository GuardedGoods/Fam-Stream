import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "Fam-Stream | Family Movie Night Made Easy",
  description:
    "A family-first streaming guide that filters movies based on your parental guidelines. Find age-appropriate movies across all your streaming services.",
  keywords: ["family movies", "content filter", "parental guide", "streaming"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
          <p>Fam-Stream &mdash; Family Movie Night Made Easy</p>
        </footer>
      </body>
    </html>
  );
}
