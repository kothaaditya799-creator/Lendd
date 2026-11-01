# 📜 LendTrack — Changelog & Engineering Devlog

All notable changes, phase gates, and reviewer audit sign-offs are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
