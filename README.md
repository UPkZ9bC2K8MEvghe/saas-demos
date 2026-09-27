# saas-demos

Three demo sites. A: "Zapier-buster" automation tool for small businesses; B: one-click invoice + auto-chase tool for freelancers; C: a "human-friendly" Calendly alternative booking tool.

## Products

Three buy-once SaaS demo sites. Pure static frontend (HTML + CSS + vanilla JS), no build step, no backend, data stored in browser localStorage.

| Product | Directory | Positioning | One-liner |
|---------|-----------|-------------|-----------|
| **Dunner** (Direction B) | root | Freelancer invoicing tool | One-click invoice + auto-dunning at day 0/7/14 + FX rate locked at send time. $99 buy-once |
| **Tenflow** (Direction A) | `tenflow/` | Small-business automation tool | Billed by "workflow count" instead of "task count" — a counter to Zapier's task-based billing. $149 buy-once |
| **Warmly** (Direction C) | `warmly/` | Calendly-alternative booking tool | A "human-feeling" booking page (photo + intro + message box) + client self-serve reschedule. $29 buy-once, 5 seats |

Summary entry point: `lab.html` (three-product comparison page).

## Online

Deployed on Cloudflare Pages (after git push, run `wrangler pages deploy` once to update — see below):

- Live URL: `https://saas-demos.pages.dev/`
  - `/` — Dunner landing page
  - `/app.html` — Dunner workspace
  - `/tenflow/` — Tenflow
  - `/warmly/` — Warmly
  - `/lab.html` — three-product summary page

## Run locally

No dependencies to install. Two ways to open it:

```bash
# Option 1: just double-click index.html (simplest)

# Option 2: spin up a static server with python (recommended, all relative paths work)
cd saas-demos-source
python -m http.server 8000
# open http://localhost:8000
```

## Directory structure

```
saas-demos/
├── index.html          # Dunner landing page ($99 buy-once pricing)
├── app.html            # Dunner workspace (invoice / chase / paid, 3 screens)
├── pay.html            # Dunner demo checkout (Stripe-style, no real charges)
├── lab.html            # Three-product summary entry
├── css/main.css        # shared styles
├── js/
│   ├── app.js          # Dunner workspace logic
│   ├── io.js           # import/export (JSON/CSV/XML/YAML/Markdown/Excel)
│   └── pay.js          # demo checkout logic
├── tenflow/            # Direction A: automation demo site
├── warmly/             # Direction C: booking demo site
├── sitemap.xml         # SEO: 7 pages
└── robots.txt          # SEO: allow crawling + point to sitemap
```

## External dependencies

Only two, both key-free:

- Google Fonts (Figtree / Fraunces / IBM Plex, etc., CDN fonts)
- `open.er-api.com` public FX rate API (used by Dunner's FX-lock demo, called directly from the browser)

All data lives in `localStorage`, nothing is uploaded to a server.

## Deployment (Cloudflare Pages)

The repo is a static site; Cloudflare Pages is updated manually via the wrangler CLI (run once after any code change):

```powershell
# Prereq: npm install -g wrangler, and create an "Edit Workers" API token in Cloudflare
$env:CLOUDFLARE_API_TOKEN = "your-token"

# Create the project (first time only)
wrangler pages project create saas-demos --production-branch main

# Deploy (run after every code change)
wrangler pages deploy . --project-name saas-demos
```

- Live in seconds after deploy; previous versions are rollback-able in the Cloudflare dashboard → project → Deployments
- Dashboard: https://dash.cloudflare.com → Workers & Pages → saas-demos

## Known limitations (demo-version behavior)

- The checkout is a demo and does not connect to real Stripe payments
- Invoice / workflow data is stored only in the browser; switching browsers does not carry data over
- No user login / no backend, so data does not sync across devices

## Related docs

- User-pain research report: `../user-pain-research-report.md`
- Three-direction selection: `../saas-tool-directions.md`
- Cold-start launch kit (PH/Reddit/X): `../cold-start-launch-kit.md`
