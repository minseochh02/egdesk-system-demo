# EGDesk System Demo

A minimal Next.js app showing how EGDesk database integration works end-to-end.

## What this demonstrates

| File | What it shows |
|---|---|
| `app/page.tsx` | Client page that fetches & displays EGDesk table data |
| `app/api/data/route.ts` | Server route using `queryTable` from egdesk-helpers |
| `app/api/create-row/route.ts` | Server route using `insertRow` from egdesk-helpers |

## Auto-generated files (do not edit)

These files are created/updated automatically by EGDesk when you import data or change your schema:

| File | Purpose |
|---|---|
| `proxy.ts` | Intercepts every fetch and routes to the correct EGDesk database |
| `egdesk.config.ts` | Type-safe table definitions (`TABLES`, `TABLE_NAMES`) |
| `egdesk-helpers.ts` | Helper functions (`queryTable`, `insertRow`, `updateRow`, `deleteRow`) |
| `.env.development.local` | Dev EGDesk server URL + project ID |
| `.env.production.local` | Prod EGDesk server URL + project ID |

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
