# AuremAI — marketing site

Static marketing site for **AuremAI**, an algorithmic gold (XAUUSD) trading system
whose position sizing is driven by a live macro/geopolitical news signal.

> The signal arrives before the price does.

Plain HTML/CSS/JS — no build step, no framework. All dynamic data is pulled
client-side from the live backend.

## Run locally

Any static file server works. For example:

```bash
python -m http.server 8090
# then open http://localhost:8090/
```

Opening `index.html` via `file://` will **not** work — the browser tooling and the
relative asset paths expect to be served over HTTP.

## Project structure

```
index.html            # all sections (single page)
css/styles.css        # design system + layout
js/config.js          # API base URL, Telegram link, poll intervals  ← edit me
js/api.js             # fetch wrapper (graceful failure) + poll helper
js/app.js             # live data binding, gauge, chart, news rendering
assets/
  bull-hero.png       # mascot, full body (hero)
  bull-point.png      # mascot, mirrored (How It Works)
  bull-mark.png       # mascot head crop (nav + footer + pricing)
  favicon.svg
```

## Configuration

Everything you'll likely change lives in `js/config.js`:

- `API_BASE` — backend origin. One-line change when the backend moves to HTTPS.
- `TELEGRAM_URL` — where every "Get Started" / contact CTA points (placeholder).
- `POLL` — refresh cadences (price/bias ~20s, performance/history/news slower).

## Live data sources

Polled from `API_BASE`:

| Endpoint | Used by |
| --- | --- |
| `GET /api/price` | Hero + nav ticker |
| `GET /api/bias` | The Signal gauge |
| `GET /api/performance` | Track Record stats + stale warning |
| `GET /api/performance/history` | Track Record chart |
| `GET /api/news` | What's moving gold |

Every call degrades gracefully: if a request fails, the affected widget shows an
"unavailable" state instead of breaking the page.

## ⚠️ Before going live

1. **HTTPS required.** The backend is currently plain HTTP (`http://84.55.8.245:8000`).
   Browsers block HTTP (mixed-content) requests from an HTTPS-hosted page, so the
   site's live data will silently fail once this is deployed to `https://`. Move the
   backend to HTTPS, then update `API_BASE`.
2. **Payments are not wired up.** Every pricing CTA opens Telegram. Each has a
   `// TODO: replace with Stripe Checkout` marker in `index.html` / `js/app.js`.
   No card collection exists anywhere.

## Compliance notes (do not remove without sign-off)

- No guaranteed/specific returns are stated anywhere; risk tiers are described
  qualitatively (low / medium / high), never by number.
- No claim of regulatory authorization.
- The footer risk disclaimer must stay intact and visible.
