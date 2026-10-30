# 📜 LendTrack — Changelog & Engineering Devlog

All notable changes, phase gates, and reviewer audit sign-offs are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
