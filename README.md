# EGDesk System Demo

A minimal Next.js app showing how EGDesk database integration works end-to-end.

## What this demonstrates

| File | What it shows |
|---|---|
| `app/page.tsx` | Client page that fetches & displays EGDesk table data |
| `app/visitor-auth/page.tsx` | Brokered visitor Google login test (path-based OAuth bounce + opaque session) |
| `app/auth/callback/page.tsx` | Exchanges EGDesk one-time login code for visitor session id |
| `app/drive-mcp/page.tsx` | Drive poll/download and upload (local ↔ Workspace) |
| `app/sheets-mcp/page.tsx` | My DB ↔ Google Sheets HTTP sync (`toWorkspace` / `toLocal`) |
| `app/gmail-mcp/page.tsx` | Gmail fetch + send |
| `app/apps-script-mcp/page.tsx` | Apps Script push / pull |
| `app/api/data/route.ts` | Server route using `queryTable` from egdesk-helpers |
| `app/api/create-row/route.ts` | Server route using `insertRow` from egdesk-helpers |

## Auto-generated files (do not edit)

These files are created/updated automatically by EGDesk when you import data or change your schema:

| File | Purpose |
|---|---|
| `proxy.ts` | Intercepts every fetch and routes to the correct EGDesk database |
| `egdesk.config.ts` | Type-safe table definitions (`TABLES`, `TABLE_NAMES`) |
| `egdesk-helpers.ts` | Helper functions (`queryTable`, `insertRow`, `updateRow`, `deleteRow`) |
| `egdesk-visitor-google.ts` | Visitor Google helper (generated — do not edit) |
| `.env.development.local` | Dev EGDesk server URL + project ID |
| `.env.production.local` | Prod EGDesk server URL + project ID |

Site-owned (never overwritten): `egdesk.visitor-auth.ts` — default visitor Google scopes (`basic` or `workspace`). Login UI lives in your pages.

### Visitor Google login flow

1. Site calls `startVisitorGoogleLogin()` → EGDesk starts Google OAuth; bounce URL depends on site type (see table below)
2. Google redirects through EGDesk → site receives `/auth/callback?code=…`
3. `app/auth/callback/page.tsx` exchanges the code for an opaque session id (stored in `localStorage`)
4. Visitor Drive/Sheets calls use `Authorization: Bearer {sessionId}` via `__visitor_google_proxy`

#### OAuth bounce by site type

| Where you open the site | Google redirectTo |
|-------------------------|-------------------|
| `localhost` / `127.0.0.1` (:4000 dev, :3000 prod) | `http://localhost:54321/auth/callback` |
| LAN IP (`192.168.x.x`) + tunnel in `.env.local` | `{tunnel}/visitor-auth/callback/{pendingId}` |
| LAN IP, no tunnel (same PC only) | `http://localhost:54321/auth/callback` |
| Tunnel URL or custom domain | `{MCP root}/visitor-auth/callback/{pendingId}` |

Prod hosted coding (`:3000`) uses basePath — open e.g. `http://localhost:3000/t/{id}/p/egdesk-system-demo/visitor-auth`.

Add to Supabase Auth redirect allowlist (once per EGDesk/tunnel origin):

- `http://localhost:54321/auth/callback` (exact — loopback visitor and owner)
- `https://tunneling-service.onrender.com/**`

Set `NEXT_PUBLIC_EGDESK_API_URL` to the tunnel MCP root (`https://…/t/{id}`) for tunnel/LAN testing. EGDesk also injects this at prod build/start when a tunnel is active.

## Getting started with EGDesk

1. Open this project in EGDesk (Coding tab → Open Dev Project)
2. EGDesk will run `npm install` and auto-generate the files above
3. Import some data in the EGDesk Data tab
4. The app will automatically reflect your tables

## Running manually

```bash
npm install
npx egdesk-next-setup   # generates proxy.ts, egdesk.config.ts, egdesk-helpers.ts
npm run dev
```

## How the proxy works

`proxy.ts` is a Next.js proxy route that:
- Reads `NEXT_PUBLIC_EGDESK_PROJECT_ID` and `NEXT_PUBLIC_EGDESK_ENV` from env
- Attaches them as headers on every request to the EGDesk server
- This tells EGDesk which project's database to query (dev vs prod)

You never manage connection strings or credentials in your code.
