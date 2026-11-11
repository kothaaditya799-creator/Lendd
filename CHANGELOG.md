# 📜 LendTrack — Changelog & Engineering Devlog

All notable changes, phase gates, and reviewer audit sign-offs are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Engineering Hygiene & CI Readiness] - 2026-11-11
### Added
- **Unified CLI Verification (`src/tests/runAllCli.mjs`) & Scripts (`package.json`)**:
  - Replaced broken unconfigured `lint` script with working `typecheck`, `test`, `build`, and `verify` scripts (`npm run verify` runs strict TypeScript checks, all Phase 3–7 CLI suites, and production Vite bundle).
  - Added Node `fs` verification in `src/tests/runPhase7Cli.mjs` validating `public/manifest.json` and `public/sw.js`.
- **CI/CD & Documentation**:
  - Added GitHub Actions CI pipeline (`.github/workflows/ci.yml`) on Node 22.
  - Added `.env.example` template for Supabase client keys and `README.md` engineering guide.
  - Synchronized `PHASE_TRACKER.md` and `CHANGELOG.md` with completed Phases 6–7.

### Changed
- Guarded `src/main.tsx` dev test suite import behind `import.meta.env.DEV` so verification modules never execute or bundle for production.
- Tightened origin comparison in `public/sw.js` (`url.origin !== self.location.origin`) and cleaned `src/utils/lenderId.ts`.

---

## [Phase 7: Cloud Sync Engine (Supabase), RLS & Offline PWA] - 2026-11-05
### Added
- **PostgreSQL Cloud Schema & RLS (`supabase/migrations/20261105000000_init_lendtrack.sql`)**:
  - Defined `borrowers`, `loans`, and `payment_schedule` tables with indexes, `updated_at` triggers, and multi-tenant RLS policies supporting authenticated `auth.uid()` and anonymous device tenant `lender_id` UUIDs.
- **Offline-Resilient Cloud Sync Engine (`src/db/supabaseClient.ts`, `src/db/syncEngine.ts`)**:
  - Zero-dependency PostgREST client with automatic `camelCase` ↔ `snake_case` mapping.
  - FIFO `syncQueue` worker with exponential backoff + jitter (`2s`–`60s`), LWW timestamp utilities, queue preservation when Supabase is unconfigured, and `pushAllLocalDataToCloud()` for initial migration.
  - Persistent RFC 4122 v4 UUID generation (`src/utils/lenderId.ts`) replacing placeholder `'local-lender'` strings.
- **PWA Service Worker & Sync UI (`public/sw.js`, `src/utils/pwaRegistration.ts`, `src/hooks/useSyncStatus.ts`)**:
  - Network-first navigation fallback + stale-while-revalidate static asset caching and native `beforeinstallprompt` install support.
  - Real-time sync indicator badge in `TopHeader.tsx` (≥44px touch targets) and cloud configuration/sync/install controls in `SettingsModal.tsx`.
- **Automated Verification (`src/tests/phase7Verification.ts`, `src/tests/runPhase7Cli.mjs`)**:
  - Added unit tests covering case conversion, config persistence, backoff math, LWW comparison, and queue preservation/draining.
  - Wired Phases 5–7 into `src/tests/runTests.ts`.

### Verified
- Independent Senior Code Reviewer Subagent (`phase-code-reviewer`) issued formal **APPROVED** sign-off (`056fefb`).

---

## [Ledger Hardening & UX Guard Rails] - 2026-11-05
### Added & Fixed
- **EOD Date Bounds & Navigation (`src/pages/InsightsPage.tsx`)**:
  - Capped Daily Cash Tally strictly to today and past dates (no speculative future EOD tallies), added 1-tap `Today` return button, replaced sun emoji `🌅` with clean receipt/clipboard icons, and introduced a single-row date navigator bar with midnight rollover focus sync.
- **Collections Safety Guard Rails (`src/pages/CollectionsPage.tsx`, `src/db/repositories/paymentRepo.ts`)**:
  - Future dates forced to view-only schedule mode (action buttons disabled).
  - Past dates require a 2-step confirmation modal before altering historical records.
  - Fixed Undo behavior via `paymentRepo.resetToPending()` so reversing a mistaken payment restores the borrower's prior `pending` status rather than marking `missed`.
  - Fixed mobile calendar picker opening via explicit `datePickerRef.current?.showPicker()` and added anti-double-tap button freeze state.

---

## [Phase 6: Security Gate, 4-Digit PIN Lock & Biometrics] - 2026-11-03
### Added
- **Client Vault Security (`src/utils/security.ts`, `src/utils/biometrics.ts`)**:
  - Salted SHA-256 hashing (`crypto.subtle.digest`) for 4-digit PINs, rate-limiting (5 failed attempts trigger 30s lockout cooldown persisting on mount), recovery phone/email checks, emergency data wipe, and WebAuthn platform biometric support.
- **Lock Screen & Auto-Lock (`src/components/security/PinLockScreen.tsx`, `src/hooks/useAutoLock.ts`)**:
  - Fullscreen high-contrast numeric PIN pad, configurable inactivity auto-lock timer, quick lock button in `TopHeader.tsx`, and security settings controls in `SettingsModal.tsx`.
- **Automated Verification (`src/tests/phase6Verification.ts`, `src/tests/runPhase6Cli.mjs`)**:
  - 38/38 automated security, salt, rate-limit, cooldown, and pin-rotation tests passing.

---

## [Phase 5: Decision Intelligence & Portfolio Insights Dashboard] - 2026-11-02
### Added
- **Analytics & Intelligence Engine (`src/utils/portfolioAnalytics.ts`)**:
  - `calculatePortfolioMetrics`: Aggregates active capital deployed, outstanding balance, total collections across loans, and projected interest/yield.
  - `calculateAgingBuckets`: Categorizes overdue schedules into custom aging buckets:
    - 🟢 Healthy / Current (0–5 days)
    - 🟡 Minor Delay (6–12 days)
    - 🟠 Warning (13–30 days)
    - 🔴 Critical / Hard Default (>30 days)
    - Calculates amount at risk, item count, and full borrower-level detail.
  - `detectLeakingBorrowers`: Early warning system flagging borrowers with $\ge 3$ partial payments or $\ge 2$ missed installments on active loans, sorting by total deficit.
  - `calculateConcentrationRisk`: Computes top 1, top 3, and top 5 borrower exposure against total active debt with risk level classification (`healthy`, `moderate`, `high`).
  - `calculateEodSummary`: Daily reconciliation computing expected target, actual collected, shortfall, efficiency %, headcount audit (paid, partial, missed, pending), new loans disbursed today, and net cash in hand flow (`Collections - Disbursements`).
  - `generateWhatsAppEodText` & `openWhatsAppEodSummary`: 1-click WhatsApp evening audit sharing in formatted Telugu and English.
- **Decision Intelligence Dashboard UI (`src/pages/InsightsPage.tsx`)**:
  - **Portfolio Capital Hero Card**: Deep Teal card with capital deployed, active outstanding, total collected, projected yield, and visual recovery progress bar.
  - **End-of-Day (EOD) Cash Tally Card**: Live date switcher (Previous/Next/Today/Native Picker), net cash in hand (+/-) banner with directional arrow icons, collections in vs disbursements out, performance gap, headcount grid, and 1-tap WhatsApp share button.
  - **Overdue Aging Analysis Section**: 4 interactive bucket cards with expandable drawers displaying affected borrowers, days overdue, overdue amounts, and 1-tap phone dialer buttons.
  - **Leaking Buckets Detector Section**: Warning cards highlighting chronic under-payers with accumulated deficit tags and call shortcuts, or an all-clear green reassurance card when healthy.
  - **Capital Concentration Radar Section**: Visual concentration progress bar, risk badge, and ranked list of top exposure borrowers.
- **Calendar Math Expansion (`src/utils/dateUtils.ts`)**:
  - `getDaysDifference`: Timezone-safe calendar day difference calculator.
- **Automated Verification**:
  - 56/56 unit tests passing in `src/tests/phase5Verification.ts` and `src/tests/runPhase5Cli.mjs`.
  - Comprehensive coverage of days difference, aging buckets, leaking borrower flags, concentration ratios, EOD cash reconciliation, and WhatsApp text formatting.

### Verified
- `tsc && vite build` built with 0 errors.

---

## [Phase 4: Daily Collection System & Fast Field Logging] - 2026-11-02
### Added
- **Daily Collections Queue View (`src/pages/CollectionsPage.tsx`)**:
  - Date navigator with Previous/Next day buttons, jump-to-today shortcut, and native date picker.
  - Formatted bilingual dates displaying day of week in Telugu and English (*సోమవారం, 2 నవంబర్ 2026* / *Monday, 2 Nov 2026*).
  - High-contrast summary cards: **Target (రావలసినది)**, **Collected (వసూలు)**, and **Pending (బాకీ)**.
  - Live progress bar with completion percentage tracking.
  - Search bar supporting case-insensitive borrower name and 10-digit mobile number lookup.
  - Status filter tabs (*All, Pending, Paid, Partial, Missed*) with live item count badges.
- **Fast 1-Tap Field Collection Actions**:
  - **1-Tap Full Payment**: One-click action recording full installment amount, automatically updating schedule status to `paid` and deducting from parent loan balance.
  - **Partial Payment Modal (`src/components/collections/PartialPaymentModal.tsx`)**: Bottom-sheet modal with custom numeric input, quick percentage chips (25%, 50%, 75%), live deficit calculation, and optional note capture.
  - **Mark Missed**: Fast toggle flagging installment as missed (`collectedAmount: 0`).
  - **Edit / Adjust**: Ability to adjust already recorded payments with net payment delta tracking.
- **WhatsApp Payment Receipt Generator (`src/utils/receiptGenerator.ts`)**:
  - One-click receipt sharing formatted in Telugu or English with borrower name, amount collected, installment details, and remaining loan balance.
  - Direct 1-tap phone dialer link (`tel:...`).
- **Automated Verification**:
  - 33/33 tests passing in `src/tests/phase4Verification.ts` and `src/tests/runPhase4Cli.mjs`.
  - Comprehensive coverage of receipt generation, status state machine, loan balance deltas, Swiss Cheese Layer 3 hard ceiling block, aggregation math, and date navigation.

### Verified
- `tsc && vite build` built with 0 errors.

---

## [Phase 3: Loan Engine & Schedule Generation Math (DF / SP Math)] - 2026-10-31
### Added
- **Financial Calendar Mathematics (`src/utils/dateUtils.ts`)**:
  - Pure timezone-safe date parsing, formatting, and day-of-week detection.
  - Leap year detection (`isLeapYear`) and days-in-month table (`getDaysInMonth`).
  - Safe month addition (`addMonthsPreservingDay`) preventing rollover bugs (e.g. Jan 31 + 1 month in 2024 leap year clamps to Feb 29, in 2025 clamps to Feb 28, in 2 months restores to Mar 31).
- **Daily Finance (DF) Schedule Engine (`src/utils/loanCalculator.ts`)**:
  - Whole-rupee rounding reconciliation distributing fractional remainders into the final installment with zero lost rupees.
  - Sunday exclusion toggle: Automatically advances start dates if Sunday, skips Sundays from daily installment dates, while preserving total required installment milestones.
  - Duration calculation computing calendar elapsed days and total Sundays skipped.
- **Special Interest (SP) Schedule Engine**:
  - Simple / flat interest calculation (monthly and quarterly cycles).
  - Milestone generation for interest cycles plus final principal return milestone at maturity.
- **Early Settlement / Payoff Engine (`calculateEarlyPayoff`)**:
  - DF early payoff: Unearned interest calculation and customizable goodwill/pre-closure discount (0%, 5%, 10%, 15%).
  - SP early payoff: Principal balance + accumulated unpaid interest + pro-rated daily cycle interest calculation.
- **UI Components & Integrations**:
  - Indian Rupee currency formatting (`src/utils/currency.ts`).
  - Interactive Milestone Schedule Inspector Modal (`ScheduleInspectorModal.tsx`) with dual tabs: full scrollable schedule breakdown and interactive Early Payoff Calculator.
  - Added "Inspect Schedule" button before loan creation on `NewLoanPage.tsx`.
  - Added "View Milestones & Early Payoff" action on individual loan cards in `BorrowersPage.tsx`.
  - Added `paymentRepo.getSchedulesByLoan()` IndexedDB query.
- **Automated Verification**:
  - 33/33 unit tests passing in `src/tests/phase3Verification.ts` and `src/tests/runPhase3Cli.mjs`.

### Verified
- `tsc && vite build` built with 0 errors.
- Independent Senior Code Reviewer Subagent (`phase-code-reviewer`) audited the phase and issued formal **APPROVED** sign-off.

---

## [Phase 2: Local Database Engine, Types & Guard Rails] - 2026-10-30
### Added
- Dexie.js (IndexedDB) database configuration with versioned tables: `borrowers`, `loans`, `schedules`, and `syncQueue`.
- Strict Zod runtime validation schemas for Indian 10-digit mobile phones (`^[6-9]\d{9}$`), positive integer currency (₹1 to ₹50,00,000 ceiling, no paise), and 4-digit numeric PIN.
- Storage persistence layer invoking `navigator.storage.persist()` on application boot to prevent OS storage eviction.
- Repository layer with multi-table atomic transactions (`borrowerRepo`, `loanRepo`, `paymentRepo`).
- Duplicate phone number guard rail in `borrowerRepo.addBorrower()`.
- Interactive Add Borrower modal on `BorrowersPage` with real-time Zod validation errors, numeric dialpad constraints (`inputMode="numeric"`), and live Dexie persistence.
- Automated unit test suite (`src/tests/phase2Verification.ts`) verifying 15 guard rail test cases with 100% pass rate.

### Verified
- `tsc --noEmit && vite build` passed with 0 errors.
- Independent Senior Code Reviewer Subagent (`phase-code-reviewer`) audited the phase and issued formal **APPROVED** sign-off.

---

## [Phase 1: Scaffolding, Deep Teal Design Tokens & Mobile Shell] - 2026-10-30
### Added
- Git repository initialized with strict `.gitignore`.
- React 18 + TypeScript + Vite project configuration (`vite.config.ts`, `tsconfig.json`).
- Tailwind CSS setup with Deep Teal `#0F766E` brand palette, WCAG AAA sunlight-contrast colors, and $\ge 56\text{px}$ touch target utilities.
- PWA manifest (`public/manifest.json`) and mobile viewport optimization in `index.html`.
- Mobile App Shell (`AppShell.tsx`, `TopHeader.tsx`, `BottomNav.tsx`) with 4-tab thumb navigation (Collections, Borrowers, New Loan, Insights).
- Bilingual toggle shell (English & తెలుగు) with instant state switching.
- Baseline placeholder views (`CollectionsPage.tsx`, `BorrowersPage.tsx`, `NewLoanPage.tsx`, `InsightsPage.tsx`).
- SVG brand favicon (`public/favicon.svg`).

### Verified
- `tsc --noEmit && vite build` passed with 0 errors and 0 warnings.
- Independent Senior Code Reviewer Subagent (`phase-code-reviewer`) audited the phase and issued formal **APPROVED** sign-off.
