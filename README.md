# HireSignal

**Is this job real, and is the company actually hiring?**

HireSignal is a Chrome extension plus a web dashboard that scores job postings for hiring intent. When you open a job post, it researches the company (funding, layoffs, news, hiring trends, repost patterns) and shows a score with the signals behind it, so you can skip ghost jobs and focus on companies that are really hiring.

This project is no longer maintained by its author. It is released as open source under the MIT license: fork it, self-host it, change it, ship it. You run your own copy with your own API keys, your own database and your own dashboard. Nothing is shared with anyone else.

> ⚠️ **Read this before using it on LinkedIn.**
> The extension reads job pages in your own logged-in browser. LinkedIn's Terms of Service forbid automated scraping, and heavy use can get your account rate-limited ("throttled") or restricted. This happened to the original author. Use it sparingly, turn off auto-analyse, and **use it at your own risk**. The same applies to any other job board's terms.

---

## What's inside

```
hiresignal/
├── extension/   Chrome extension (Manifest V3, React, Vite)
├── api/         Scoring API (Node.js, Express) + company signal collectors
├── dashboard/   Web dashboard (Next.js 14, NextAuth)
└── docker-compose.yml   Local Postgres + Redis
```

```
Chrome extension ──▶ Scoring API ◀── Dashboard
                         │
                 PostgreSQL + Redis
```

- **Supported job sites:** LinkedIn, Indeed, Greenhouse, Lever, Workday, plus any page with standard job JSON-LD markup.
- **Signals:** Perplexity AI web research (main signal), Google Trends, Yahoo Finance, Wikidata, news RSS feeds, Eurostat/EURES, and optionally NewsAPI.
- **Dashboard:** saved jobs, scores, ghost-job alerts, weekly activity, settings and an admin page.

## What you need

| Thing | Required? | Where to get it |
|---|---|---|
| Node.js 18+ | Yes | https://nodejs.org |
| Docker (for local Postgres + Redis) | Recommended | https://www.docker.com, or install Postgres and Redis yourself |
| Google Chrome | Yes | |
| Perplexity API key | Strongly recommended. Without it, scores rely on weaker free signals | https://www.perplexity.ai/settings/api (paid, usage-based) |
| NewsAPI key | Optional | https://newsapi.org |
| Google OAuth client | Optional, only for "Sign in with Google" | https://console.cloud.google.com |

---

## Run it on your own computer

These steps take about 10 minutes. Run every command from the project folder.

### 1. Get the code and install packages

```bash
git clone https://github.com/HirenWaghela9706/HireSignal.git
cd HireSignal
npm install
```

### 2. Start Postgres and Redis

```bash
docker compose up -d
```

The API creates its database tables automatically the first time it starts.

### 3. Create your env files

```bash
cp api/.env.example api/.env
cp dashboard/.env.local.example dashboard/.env.local
cp extension/.env.example extension/.env
```

Generate random secrets. Run this command three times and paste one value into each slot:

```bash
openssl rand -hex 32
```

- `api/.env` → `JWT_SECRET`
- `dashboard/.env.local` → `NEXTAUTH_SECRET`
- `INTERNAL_API_SECRET` → put **the same value** in both `api/.env` and `dashboard/.env.local`

Then paste your Perplexity key into `PERPLEXITY_API_KEY` in `api/.env`.

### 4. Start the API and the dashboard

```bash
npm run dev:all
```

- API: http://localhost:3001
- Dashboard: http://localhost:3000

Open the dashboard and create an account with email and password.

### 5. Build and load the extension

```bash
npm run build --workspace=extension
```

In Chrome:

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Pin HireSignal, open its popup and click **Connect**. This opens your dashboard and links the extension to your account.

### 6. Use it

Open a job post on a supported site. The HireSignal badge appears on the page. Click it to see the score and the signals behind it. Every job you analyse also shows up in your dashboard.

---

## Optional setup

### Sign in with Google

1. In Google Cloud Console, create an **OAuth client ID** of type *Web application*.
2. Add this authorised redirect URI: `http://localhost:3000/api/auth/callback/google`. If you deploy, also add your deployed URL with the same path.
3. Put the client ID and secret in `dashboard/.env.local`.
4. While the app is in "Testing" mode, add your own Google account under **OAuth consent screen → Test users**.

### Make yourself an admin

The admin page is visible to users with the `admin` role. Set the role directly in the database:

```bash
docker compose exec postgres psql -U postgres hiresignal -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

### Change the scan limit

Each user can analyse 50 jobs per month by default. Change `MONTHLY_SCAN_LIMIT` in `api/src/middleware/scanLimit.js`.

---

## Deploy it online (optional)

You only need this if you want the dashboard reachable from other devices. Any Node host works. One tested setup:

1. **Database + Redis:** create a Postgres database and a Redis instance on a host such as Railway, Render, Neon or Upstash.
2. **API:** deploy the `api/` folder as a Node service with start command `npm start`. Set every variable from `api/.env.example`, using the hosted database and Redis URLs.
3. **Dashboard:** deploy the `dashboard/` folder to Vercel. Set every variable from `dashboard/.env.local.example`: `NEXTAUTH_URL` = your dashboard URL and `NEXT_PUBLIC_API_URL` = your API URL.
4. **Extension:**
   - In `extension/.env`, set `VITE_API_URL` and `VITE_DASHBOARD_URL` to your deployed URLs.
   - In `extension/manifest.json`, replace `https://hiresignal.com/*` under `externally_connectable.matches` with your dashboard URL, for example `https://my-hiresignal.vercel.app/*`. Without this, the Connect step cannot hand the login to the extension.
   - Rebuild with `npm run build --workspace=extension` and reload it in `chrome://extensions`.

---

## Keeping your copy safe

- Never commit `.env` or `.env.local` files. They are already in `.gitignore`.
- Keep `INTERNAL_API_SECRET` private. The dashboard uses it to prove to the API that a Google sign-in is genuine.
- If a key ever leaks, revoke it at the provider and replace it.

## Troubleshooting

| Problem | Fix |
|---|---|
| Badge never appears | Reload the job page. Check the extension is enabled and connected (popup shows your email). |
| Scores look thin or generic | `PERPLEXITY_API_KEY` is missing or out of credit. Check the API terminal for `[perplexity]` warnings. |
| Google sign-in fails | `INTERNAL_API_SECRET` differs between `api/.env` and `dashboard/.env.local`, or your account is not a test user. |
| Connect button opens the dashboard but the extension stays logged out | Your dashboard URL is missing from `externally_connectable` in `extension/manifest.json`. Rebuild after fixing it. |
| `ECONNREFUSED` on 5432 or 6379 | Postgres or Redis is not running. Run `docker compose up -d`. |
| LinkedIn shows "too many requests" or the page slows down | You are being rate-limited. Stop using the extension on LinkedIn for a while. |

## License

MIT. See [LICENSE](LICENSE). No warranty and no support: you run it at your own risk.
