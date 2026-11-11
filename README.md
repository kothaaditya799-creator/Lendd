# LendTrack (లేండ్‌ట్రాక్)

Offline-first, mobile-first Progressive Web App (PWA) in **English & Telugu (తెలుగు)** for daily finance (DF) and special interest (SP) lending ledgers.

---

## Tech Stack
- **Frontend**: React 18, TypeScript (strict mode), Vite 5, Tailwind CSS, Lucide Icons
- **Local Persistence**: Dexie.js (IndexedDB) + OS storage persistence (`navigator.storage.persist()`)
- **Validation**: Zod v4 runtime schemas + contextual guard rails
- **Cloud Sync (Optional)**: Zero-dependency Supabase PostgREST client (`src/db/supabaseClient.ts`) + SQL schema with Row-Level Security (`supabase/migrations/20261105000000_init_lendtrack.sql`)
- **PWA**: Offline Service Worker (`public/sw.js`) & Web App Manifest (`public/manifest.json`)

---

## Quick Start

### Prerequisites
- **Node.js 22+** (required for `node --experimental-strip-types` test execution)
- **npm 10+**

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional for Cloud Sync)
The app works 100% locally offline without cloud configuration. To enable Supabase cloud sync via environment variables:
```bash
cp .env.example .env.local
```
Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (never put a `service_role` key in client env files). Credentials can also be entered in-app under **Settings → Cloud Database Settings**.

### 3. Run Development Server
```bash
npm run dev
```

---

## Scripts

| Command | What It Does |
| :--- | :--- |
| `npm run dev` | Starts Vite development server (also runs DEV browser verification suites in console) |
| `npm run typecheck` | Runs strict TypeScript compiler checks (`tsc --noEmit`) |
| `npm test` | Runs all CLI verification suites across Phases 3–7 (`221/221` assertions via `src/tests/runAllCli.mjs`) |
| `npm run build` | Compiles TypeScript and builds production PWA bundle into `dist/` |
| `npm run verify` | Full CI gate: runs `typecheck`, `test`, and `build` sequentially |
| `npm run preview` | Serves production `dist/` bundle locally |

---

## Project Structure

```text
├── .github/workflows/ci.yml        # Automated CI check (typecheck, tests, build)
├── public/
│   ├── manifest.json               # Standalone PWA manifest
│   └── sw.js                       # Offline cache & navigation fallback worker
├── supabase/migrations/
│   └── 20261105000000_init_lendtrack.sql  # Postgres schema, triggers & RLS policies
└── src/
    ├── components/                 # Shell, collections modals, schedule inspector, PIN lock
    ├── db/                         # Dexie schema, atomic repos, Supabase REST & sync engine
    ├── hooks/                      # Auto-lock & sync status hooks
    ├── pages/                      # CollectionsPage, BorrowersPage, NewLoanPage, InsightsPage
    ├── tests/                      # Phase 2–7 verification suites & unified CLI runner
    ├── types/                      # Zod schemas & navigation contracts
    └── utils/                      # Loan math, analytics, receipts, security & PWA helpers
```

---

## Documentation
- [`PROJECT_SPECIFICATION.md`](./PROJECT_SPECIFICATION.md) — Product requirements, lending models, guard rails & database design
- [`PHASE_TRACKER.md`](./PHASE_TRACKER.md) — Current build status and remaining launch milestones
- [`CHANGELOG.md`](./CHANGELOG.md) — Chronological engineering log across all phases

