import Link from "next/link";
import { Film, Search, Shield, Tv, Star, ListChecks } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Film className="h-4 w-4" />
              Family Movie Night Made Easy
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Find the <span className="text-primary">Perfect Movie</span>
              <br />
              for Your Family
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Filter movies across all your streaming services by language,
              violence, and content ratings. No more guessing if a movie is
              appropriate for your kids.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/movies"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Search className="h-5 w-5" />
                Browse Movies
              </Link>
              <Link
                href="/movies?preset=family-night"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary px-8 py-3 text-lg font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <Star className="h-5 w-5" />
                Family Night Picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Tv className="h-8 w-8" />}
              title="Your Streaming Services"
              description="Select the streaming services you subscribe to. We'll show you what's available across Netflix, Disney+, Amazon Prime, Apple TV, HBO, Peacock, Paramount+, and more."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Content Filtering"
              description="Set your family's comfort level for language, violence, sexual content, and scary scenes. We'll rate every movie on a 0-5 scale so you can filter out anything inappropriate."
            />
            <FeatureCard
              icon={<ListChecks className="h-8 w-8" />}
              title="Track & Watch"
              description="Build a watchlist of approved movies, mark movies as watched, and never waste Friday night searching again. Direct links take you straight to the movie on your streaming service."
            />
          </div>
        </div>
      </section>

      {/* Content Rating Preview */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Detailed Content Ratings
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            We aggregate content data from Kids-In-Mind, Common Sense Media,
            and IMDb Parental Guides to give you the most comprehensive
            picture of what&apos;s in each movie.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <RatingPreview label="Language" score={1} color="bg-score-green" />
            <RatingPreview label="Violence" score={2} color="bg-score-yellow" />
            <RatingPreview label="Sexual" score={0} color="bg-score-green" />
            <RatingPreview label="Scary" score={1} color="bg-score-green" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Example: A typical G-rated animated movie
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-6xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready for Movie Night?
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign in with Google to save your watchlist and preferences.
          </p>
          <Link
            href="/movies"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
      <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function RatingPreview({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card border border-border">
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-bold`}>
        {score}
      </div>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">out of 5</span>
    </div>
  );
}
