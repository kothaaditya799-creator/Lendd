-- =========================================================================
-- LendTrack (లేండ్‌ట్రాక్) - Supabase Cloud DDL & Row-Level Security (RLS)
-- Offline-First Money Lending Ledger Schema
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Borrowers Table
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lender_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  secondary_phone VARCHAR(20),
  guarantor_name VARCHAR(100),
  guarantor_phone VARCHAR(20),
  address VARCHAR(300),
  notes VARCHAR(500),
  trust_score NUMERIC(3,1) DEFAULT 5.0 CHECK (trust_score >= 0.0 AND trust_score <= 10.0),
  advance_balance BIGINT DEFAULT 0 CHECK (advance_balance >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lender_id UUID NOT NULL,
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  loan_type VARCHAR(10) NOT NULL CHECK (loan_type IN ('DF', 'SP')),
  principal_amount BIGINT NOT NULL CHECK (principal_amount > 0 AND principal_amount <= 5000000),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted')),
  start_date DATE NOT NULL,
  end_date DATE,
  skip_sundays BOOLEAN DEFAULT FALSE,

  -- Daily Finance (DF) fields
  total_repayment_amount BIGINT,
  collection_frequency VARCHAR(20) CHECK (collection_frequency IN ('daily', 'weekly', 'monthly')),
  installment_amount BIGINT,
  total_installments INT CHECK (total_installments > 0 AND total_installments <= 999),

  -- Special Interest (SP) fields
  interest_rate_monthly NUMERIC(5,2) CHECK (interest_rate_monthly >= 0.1 AND interest_rate_monthly <= 100.0),
  interest_frequency VARCHAR(20) CHECK (interest_frequency IN ('monthly', 'quarterly')),
  accumulated_unpaid_interest BIGINT DEFAULT 0 CHECK (accumulated_unpaid_interest >= 0),

  -- Denormalized running aggregates
  total_collected BIGINT DEFAULT 0 CHECK (total_collected >= 0),
  outstanding_balance BIGINT NOT NULL CHECK (outstanding_balance >= 0),
  last_collection_date DATE,

  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Payment Schedules Table (Milestones)
CREATE TABLE IF NOT EXISTS payment_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL,
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_due BIGINT NOT NULL CHECK (amount_due > 0),
  amount_paid BIGINT DEFAULT 0 CHECK (amount_paid >= 0),
  payment_type VARCHAR(20) NOT NULL DEFAULT 'installment' CHECK (payment_type IN ('installment', 'interest', 'principal')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'missed')),
  paid_at TIMESTAMPTZ,
  notes VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- =========================================================================
-- Indexes for Sub-Millisecond Multi-Tenant Filtering
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_borrowers_lender ON borrowers(lender_id, is_active);
CREATE INDEX IF NOT EXISTS idx_borrowers_phone ON borrowers(phone);
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_schedule_lender_date ON payment_schedule(lender_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_schedule_loan ON payment_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_schedule_borrower ON payment_schedule(borrower_id);

-- =========================================================================
-- Automatic updated_at Trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_borrowers_updated_at ON borrowers;
CREATE TRIGGER set_borrowers_updated_at
BEFORE UPDATE ON borrowers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_loans_updated_at ON loans;
CREATE TRIGGER set_loans_updated_at
BEFORE UPDATE ON loans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_payment_schedule_updated_at ON payment_schedule;
CREATE TRIGGER set_payment_schedule_updated_at
BEFORE UPDATE ON payment_schedule
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- Row-Level Security (RLS) Multi-Tenant Privacy Isolation
-- =========================================================================
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;

-- Borrowers Policy: Lenders only see and modify their own borrowers
CREATE POLICY "Lender Borrowers Policy" ON borrowers
FOR ALL USING (auth.uid() = lender_id)
WITH CHECK (auth.uid() = lender_id);

-- Loans Policy: Lenders only see and modify their own loans
CREATE POLICY "Lender Loans Policy" ON loans
FOR ALL USING (auth.uid() = lender_id)
WITH CHECK (auth.uid() = lender_id);

-- Payment Schedule Policy: Lenders only see and modify their own schedules
CREATE POLICY "Lender Schedules Policy" ON payment_schedule
FOR ALL USING (auth.uid() = lender_id)
WITH CHECK (auth.uid() = lender_id);
