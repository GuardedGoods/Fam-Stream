# MovieNight

A family-first streaming guide that filters movies based on your parental guidelines. Find age-appropriate movies across all your streaming services.

## Features

- **Content Filtering** - Filter movies by language, violence, sexual content, and scary scenes (0-5 scale)
- **Blocked Words** - Block specific profanity words; movies containing them are automatically hidden
- **Streaming Aggregation** - See what's available across Netflix, Disney+, Amazon Prime, Apple TV, HBO, Peacock, Paramount+, and more
- **Content Scraping** - Aggregates content advisories from Kids-In-Mind, Common Sense Media, and IMDb Parental Guides
- **Watchlist** - Track movies to watch and movies you've already seen
- **Ratings** - IMDb, Rotten Tomatoes, and Metacritic scores at a glance
- **Google Sign-In** - Save your preferences and watchlist
- **Self-Hosted** - Run on your home server via Docker

## Quick Start (Docker)

1. Create a `docker-compose.yml`:

```yaml
services:
  movienight:
    image: ghcr.io/guardedgoods/movienight:latest
    ports:
      - "8040:3000"
    volumes:
      - movienight-data:/app/data
    env_file:
      - .env
    restart: unless-stopped

volumes:
  movienight-data:
```

2. Create a `.env` file:

```env
DATABASE_URL=file:/app/data/movienight.db
AUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://YOUR_SERVER_IP:8040
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
TMDB_API_KEY=your-tmdb-api-key
OMDB_API_KEY=your-omdb-api-key
ADMIN_EMAILS=your-email@gmail.com
OPENAI_API_KEY=optional
```

3. Start the container:

```bash
docker compose up -d
```

4. Open `http://YOUR_SERVER_IP:8040`

## API Keys (All Free)

| Service | Cost | Sign Up |
|---------|------|---------|
| TMDB API | Free | themoviedb.org/settings/api |
| OMDb API | Free (1K/day) | omdbapi.com/apikey.aspx |
| Google OAuth | Free | console.cloud.google.com |
| OpenAI (optional) | Pay-per-use | platform.openai.com |

### Google OAuth Setup

1. Go to Google Cloud Console > APIs & Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://YOUR_SERVER_IP:8040/api/auth/callback/google`
4. Copy Client ID and Secret to your `.env` file

## Development

```bash
# Install dependencies
npm install

# Create .env.local with your API keys
cp .env.example .env.local

# Generate database
npx drizzle-kit push

# Run development server
npm run dev

# Run the test suite
npm test
```

On a fresh install the sync scheduler runs a cold-start bootstrap: if there
are fewer than 10 movies in the DB, an immediate TMDB sync fires so the
catalog populates without waiting for the nightly 3 AM cron.

## Tech Stack

- **Next.js 16** - Full-stack React framework (App Router)
- **TypeScript** - Type-safe code
- **SQLite** - Local database (via better-sqlite3 + Drizzle ORM)
- **Auth.js** - Google OAuth authentication
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible UI components
- **Cheerio** - HTML scraping for content ratings
- **node-cron** - Background data sync scheduling

## Architecture

```
TMDB API ──────┐
OMDb API ──────┤
Kids-In-Mind ──┤──> SQLite DB ──> Next.js Server ──> Browser
Common Sense ──┤        ^
IMDb Parental ─┘        |
                   node-cron
                  (background sync)
```

All movie data is synced to a local SQLite database. Page loads never call external APIs - everything is served from the local database for maximum speed.
