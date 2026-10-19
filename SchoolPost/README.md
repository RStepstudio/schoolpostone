# Schoolpost

A student community feed for sharing updates, finding school projects, and following classmates. The starter runs as a Cloudflare Pages app with Cloudflare D1; it also has a local sample feed so the interface can be previewed before the database is connected.

## Run locally

1. Install Node.js 20 or newer, run `npm install`, and sign in to Cloudflare:

   ```powershell
   npx wrangler login
   ```

2. Create the D1 database and copy its ID into `database_id` in `wrangler.toml`:

   ```powershell
   npx wrangler d1 create schoolpost
   ```

3. Apply the schema and sample data to the local D1 database:

   ```powershell
   npm run db:migrate:local
   ```

4. Start the Pages development server with `npm run dev`.

The app is served at `http://localhost:8788`.

## Deploy to Cloudflare Pages

1. Apply the schema and sample data to the remote database, then deploy:

   ```powershell
   npm run db:migrate
   npm run deploy
   ```

Wrangler creates or updates the Pages project named `schoolpost`. Its default address will be `https://schoolpost.pages.dev` if that project name is available; Pages project names are global, so choose a variation in `wrangler.toml` and the deploy command if it is already taken. Connect the Git repository in the Cloudflare dashboard to enable automatic deployments.

## MVP scope

This starter includes a seeded school feed, username onboarding, post creation, likes, follows, search, saved posts, project cards, and session-scoped soft delete. Replies and full user accounts are not implemented yet. Usernames and session IDs are stored in browser storage and readable cookies so the anonymous APIs can associate actions; they are **not authentication**. Anyone can claim an unused or existing username, and browser storage can be copied or edited. Add trusted authentication, abuse reporting, and moderation before opening the app to an actual school community.

Post text is screened for contact/identification details and a small set of unsafe-language patterns. To enable the optional AI check, uncomment the `[ai]` binding in `wrangler.toml`; the API calls `@cf/meta/llama-guard-3-8b` only after the keyword checks pass. If the binding is absent or the AI request fails, the keyword checks still apply. AI failures are logged and fail open.

The color-mode toggle follows the system preference on first visit and saves explicit choices in local storage. Database changes are versioned in `migrations/`; run `npm run db:migrate:local` for local D1 or `npm run db:migrate` for the configured remote database.
