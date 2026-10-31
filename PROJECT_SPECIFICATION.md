# 🏦 LendTrack (లేండ్‌ట్రాక్)
## Complete PRD, System Architecture & Phased Execution Plan

---

## 1. Executive Summary & Product Vision

### 1.1 The Vision
**LendTrack** is an offline-first, mobile-first Progressive Web Application (PWA) designed specifically for informal and private money lenders (operating individually or in small teams of 2–5 members) managing between 10 and 100 active borrowers.

Informal money lenders handle time-critical collections under real-world constraints: irregular internet connectivity, fast-paced street collections, sensitive financial transactions, and multiple loan structures (daily, weekly, monthly interest, quarterly). Most rely on paper notebooks, physical diaries, or ad-hoc Excel sheets, which lead to:
1. **Silent Capital Leaks**: Unrecorded partial payments, unaccounted grace periods, forgotten interest cycles.
2. **Operational Friction**: Manual daily calculation of who owes what today.
3. **Data Vulnerability**: Torn or lost notebooks, phone theft, SIM-swap vulnerability.
4. **Zero Decision Intelligence**: No visibility into capital concentration risk, true monthly yield, or early default indicators.

LendTrack bridges this gap with an intuitive interface available in **English and Telugu (తెలుగు)**, pairing instant offline collection logging with cloud backup and deep decision intelligence.

---

## 2. Behavioral Psychology & UI/UX Design System

### 2.1 The Target User Profile
* **Demographic**: 35–55 years old, Tier 2 / Tier 3 cities (e.g., Warangal, Guntur, Kurnool).
* **Literacy & Tech Comfort**: Primary/basic education; reads Telugu fluently, understands basic conversational English numbers/words. Smartphone proficiency acquired via WhatsApp, YouTube, PhonePe, and GPay.
* **Working Context**: Street rounds on two-wheelers, handling cash/bags, one-handed phone operation, direct outdoor sunlight glare.

### 2.2 Visual Identity & Cognitive Palette
* **Primary Brand Tone — Deep Teal / Emerald (`#0F766E` / `#0D9488`)**:
  * Distinct from PhonePe (Purple), GPay (Multi/Blue), and Paytm (Blue) to prevent product confusion.
  * Sits between institutional banking blue (trust/stability) and green (wealth/growth).
  * High-contrast ratio (>7:1, WCAG AAA compliant) on clean white/off-white surfaces for outdoor readability.
* **Universal Status Trifold (Color + Icon + Text)**:
  * 🟢 **Paid (`#16A34A`)**: Green Checkmark (`✓`) + Telugu/English label ("చెల్లించారు / Paid").
  * 🔴 **Overdue / Missed (`#DC2626`)**: Red Cross (`✗`) + label ("బాకీ / Overdue").
  * 🟡 **Partial (`#D97706`)**: Amber Alert (`⚠️`) + label ("పాక్షికం / Partial").

### 2.3 Ergonomics & Interaction Rules
1. **The Digital Diary Mental Model**: The default home screen is "Today's Collection Page" — mirrors physical notebook pages.
2. **Typography Hierarchy**:
   * Currency figures: Bold 28–32px.
   * Borrower names: Semi-bold 20–22px.
   * Labels: Minimum 16px (zero small text).
3. **Fitts's Law Touch Targets**: Minimum button height 56px across all clickable elements; zero hamburger menus or hidden horizontal swipes.
4. **Forgiveness & Error Safety**:
   * Destructive actions require explicit 1-tap confirmation.
   * 5-second "Undo" snackbar for collection entries.
   * Automatic background saving (no manual "Save" button anxiety).

---

## 3. Strict Input Guard Rails & The "Swiss Cheese" Defense Model

To completely prevent accidental "fat-finger" errors, extra zero inputs, and corrupted records, the system enforces a 4-layer validation barrier:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE SWISS CHEESE GUARD RAIL MODEL                    │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Physical Input Filtering                                      │
│ • inputMode="numeric" restricts mobile keyboard to digits 0-9 only     │
│ • Auto-sanitizes pasted text (+91, spaces, hyphens stripped)           │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Strict Zod Runtime Schema Validation                          │
│ • Mobile: ^[6-9]\d{9}$ (Exact 10 Indian digits starting with 6-9)      │
│ • Email: Strict RFC 5322 regex                                         │
│ • Currency: Positive integers only (>0, no paise, <= ₹50,00,000)       │
│ • PIN: Exactly 4 numeric digits                                        │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Contextual Business Logic Sanity Checks                       │
│ • Ceiling Block: Cannot collect more than total outstanding balance    │
│ • Anomaly Warning: Flag prompt if entered amount > 3x scheduled amount │
│ • Debouncing: 1,000ms tap debounce to eliminate double-tap charges     │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Transaction Reversibility (The Safety Net)                    │
│ • 5-second toast snackbar with 1-tap "Undo" after every entry          │
│ • Full Dexie.js atomic rollback on undo                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Product Requirements Document (PRD)

### 4.1 Lending Models

#### Model 1: Daily Finance (DF) — Fixed Repayment
* **Mechanism**: Lender disburses principal (e.g., ₹10,000) and agrees on a total return amount upfront (e.g., ₹12,000).
* **Presets**: Fast-entry chips (₹10,000, ₹20,000, ₹50,000, ₹1,00,000) + custom amount entry.
* **Holiday/Sunday Exclusion**: Configurable toggle per loan/lender to automatically skip Sundays and/or festival dates from installment due-date generation.

#### Model 2: Special (SP) — Interest-Based
* **Mechanism**: Principal disbursed; borrower pays interest per cycle; principal returned at maturity or upon demand.
* **Interest Policy**: **Simple/Flat Only**. Unpaid interest cycles accumulate as overdue interest balance without compounding into the principal.

---

### 4.2 Real-World Edge Cases & Workflows

#### Case A: Multiple Active Loans to a Single Borrower
* **UI Representation**: Grouped single borrower card in Daily Collections (e.g., "Ravi Kumar — 2 active loans, Total Due: ₹360").
* **Single-Tap Full Collection**: "Collect All (₹360)" marks both loan installments paid.
* **Partial Payment Allocation**: When borrower pays less than total combined due (e.g., pays ₹200 out of ₹360), the app displays a **Manual Split Sheet**:
  * Lender explicitly enters how much goes to Loan 1 and how much to Loan 2 (full lender autonomy; no automatic guessing).

#### Case B: Overpayment (>100% of Daily Installment)
* When a borrower pays more than the scheduled amount (e.g., ₹240 paid against ₹120 due):
  1. **Advance Installments (Default)**: Credits subsequent installments (e.g., marks tomorrow's installment as pre-paid).
  2. **Advance Wallet Credit**: Holds the excess amount in a borrower credit pool to deduct against future deficits.
  3. **Lump-Sum Early Closure**: Option to calculate exact principal/interest balance required to close the loan immediately.

#### Case C: End-of-Day Summary Sheet
* Evening tally view accessible from the Collections tab:
  * Total Expected vs. Total Collected vs. Shortfall.
  * New disbursements given out today.
  * Net Cash Position: $\text{Net Cash} = \text{Collections} - \text{Disbursements}$.
  * Headcount: Total visited, fully paid, partial, missed.

#### Case D: Archived / Deleted Borrowers & 1-Tap Restoration (Soft-Delete Ledger)
* **Pre-condition**: Borrowers can only be deleted if they have zero active debt (`outstandingBalance === 0`).
* **Storage Model**: Soft delete (`isActive: false`). No loan or schedule history is ever purged.
* **UI Directory**: `[ Active (N) ]` | `[ Archived / Deleted (N) ]` segmented toggle on Borrowers directory.
* **1-Tap Restore**: Tapping "Restore" (పునరుద్ధరించు) immediately reactivates `isActive: true` with 100% past loan records and KYC details intact. Zero re-entry friction for returning borrowers.

---

## 5. Security & Authentication Architecture

### 5.1 Memory-Free Security Model
The user only reliably remembers their **Phone Number** and **Email Address**. Zero security questions, recovery passphrases, or arbitrary keys.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SECURITY MATRIX                                 │
├──────────────────────┬─────────────────────────────────────────────────┤
│ User Action          │ Required Authentication Proof                   │
├──────────────────────┼─────────────────────────────────────────────────┤
│ First-time Signup    │ Phone OTP  +  Email OTP  +  Set 4-digit PIN     │
│ Daily App Launch     │ 4-digit PIN (or Biometric Touch)               │
│ Inactivity (>2 min)  │ Auto-lock → Re-enter PIN                        │
│ 5 Invalid PINs       │ Local session wiped → Re-authenticate via Cloud │
│ New Device Login     │ Phone OTP  +  Email OTP  +  Set new device PIN  │
│ Forgot Local PIN     │ Phone OTP  +  Email OTP  →  Reset Local PIN     │
│ Changed SIM / Phone  │ Email OTP  →  Verify Identity → Bind New Phone   │
│ Changed Email        │ Phone OTP  →  Verify Identity → Bind New Email   │
└──────────────────────┴─────────────────────────────────────────────────┘
```

---

## 6. Technical Architecture & Database Design

### 6.1 Cloud Schema (Supabase PostgreSQL)

```sql
-- 1. Lenders
CREATE TABLE lenders (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  business_name VARCHAR(255),
  owner_name VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  skip_sundays_default BOOLEAN DEFAULT FALSE,
  preferred_language VARCHAR(5) DEFAULT 'en', -- 'en' | 'te'
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Borrowers
CREATE TABLE borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES lenders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  secondary_phone VARCHAR(20),
  guarantor_name VARCHAR(255),       -- Optional reference
  guarantor_phone VARCHAR(20),       -- Optional reference
  address TEXT,
  photo_url TEXT,
  id_proof_type VARCHAR(50),
  id_proof_number VARCHAR(100),
  trust_score NUMERIC(3,1) DEFAULT 5.0,
  advance_balance NUMERIC(12,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Loans
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES lenders(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_type VARCHAR(10) NOT NULL, -- 'DF' or 'SP'
  principal_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'defaulted'
  start_date DATE NOT NULL,
  end_date DATE,
  skip_sundays BOOLEAN DEFAULT FALSE,
  
  -- DF Specifics
  total_repayment_amount NUMERIC(12,2),
  collection_frequency VARCHAR(15), -- 'daily', 'weekly', 'monthly'
  installment_amount NUMERIC(12,2),
  total_installments INT,
  
  -- SP Specifics (Simple Interest, Flat)
  interest_rate_monthly NUMERIC(5,2),
  interest_frequency VARCHAR(15), -- 'monthly', 'quarterly'
  accumulated_unpaid_interest NUMERIC(12,2) DEFAULT 0.00,
  
  -- Running Aggregates
  total_collected NUMERIC(12,2) DEFAULT 0.00,
  outstanding_balance NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Payment Schedule
CREATE TABLE payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES lenders(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_due NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) DEFAULT 0.00,
  payment_type VARCHAR(20) NOT NULL, -- 'installment', 'interest', 'principal'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'partial', 'missed'
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Row Level Security Policies
ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lender self access" ON lenders FOR ALL USING (id = auth.uid());
CREATE POLICY "Borrowers isolation" ON borrowers FOR ALL USING (lender_id = auth.uid());
CREATE POLICY "Loans isolation" ON loans FOR ALL USING (lender_id = auth.uid());
CREATE POLICY "Schedule isolation" ON payment_schedule FOR ALL USING (lender_id = auth.uid());
```

### 6.2 Local Dexie.js Schema

```typescript
import Dexie, { Table } from 'dexie';

export interface LocalBorrower {
  id: string;
  lender_id: string;
  name: string;
  phone: string;
  guarantor_name?: string;
  guarantor_phone?: string;
  advance_balance: number;
  trust_score: number;
  is_active: boolean;
  updated_at: string;
}

export interface LocalLoan {
  id: string;
  lender_id: string;
  borrower_id: string;
  loan_type: 'DF' | 'SP';
  principal_amount: number;
  status: 'active' | 'completed' | 'defaulted';
  start_date: string;
  installment_amount?: number;
  total_installments?: number;
  outstanding_balance: number;
  accumulated_unpaid_interest: number;
  updated_at: string;
}

export interface LocalPaymentSchedule {
  id: string;
  loan_id: string;
  lender_id: string;
  borrower_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: 'pending' | 'paid' | 'partial' | 'missed';
  paid_at?: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id?: number;
  table: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
}

export class LendTrackDatabase extends Dexie {
  borrowers!: Table<LocalBorrower, string>;
  loans!: Table<LocalLoan, string>;
  schedules!: Table<LocalPaymentSchedule, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('LendTrackLocalDB');
    this.version(2).stores({
      borrowers: 'id, lender_id, name, phone, is_active, updated_at',
      loans: 'id, lender_id, borrower_id, loan_type, status, start_date, updated_at',
      schedules: 'id, loan_id, lender_id, borrower_id, due_date, status, updated_at',
      syncQueue: '++id, table, record_id, action, timestamp'
    });
  }
}

export const localDb = new LendTrackDatabase();
```

---

## 7. Phased Execution Roadmap

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASED IMPLEMENTATION TIMELINE                     │
├─────────┬──────────────────────────────────┬────────────────────────────┤
│ Phase   │ Scope                            │ Deliverables               │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 1 │ Scaffolding & Deep Teal UI       │ Vite, React 18, TS,        │
│         │                                  │ Tailwind, PWA shell, Nav   │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 2 │ Local Database & Guard Rails     │ Dexie DB, Zod schemas,     │
│         │                                  │ Indian phone & currency val│
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 3 │ Loan Engine & Multi-Loan Logic   │ DF/SP math, Sunday toggle, │
│         │                                  │ New Loan wizard, presets   │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 4 │ Dual-Channel Auth & PIN Gate     │ Phone+Email OTP state,     │
│         │                                  │ 4-digit keypad, auto-lock  │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 5 │ Collections & Overpayment Flows  │ Daily sheet, manual split, │
│         │                                  │ advance/overpayment logic  │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 6 │ Decision Intelligence Engine     │ Aging buckets, leaks list, │
│         │                                  │ concentration donut, EOD   │
├─────────┼──────────────────────────────────┼────────────────────────────┤
│ Phase 7 │ Cloud Sync & Production Deploy   │ Supabase RLS, Telugu i18n, │
│         │                                  │ PWA service worker cache   │
└─────────┴──────────────────────────────────┴────────────────────────────┘
```
