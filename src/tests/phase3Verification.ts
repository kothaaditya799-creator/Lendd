/**
 * Phase 3 Verification Test Suite
 * Validates Loan Engine & Schedule Generation Math:
 * - DF 100-day schedules and whole-rupee rounding reconciliation
 * - Sunday skipping without dropping installment counts
 * - Safe month arithmetic across leap years (Feb 29 vs Feb 28) and 30/31 day months
 * - SP simple interest cycles (monthly & quarterly) and principal return maturity
 * - Early closure / payoff settlement calculations
 * - Boundary conditions and invalid inputs
 */

import {
  generateDFSchedule,
  generateSPSchedule,
  calculateEarlyPayoff,
} from '../utils/loanCalculator';
import {
  isSunday,
  addMonthsPreservingDay,
  isLeapYear,
  getDaysInMonth,
} from '../utils/dateUtils';
import { Loan } from '../types/domain';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export async function runPhase3Verification(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    if (condition) {
      results.push({ name, passed: true, details });
    } else {
      results.push({ name, passed: false, error: details || 'Assertion failed' });
    }
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Standard DF 100-Day Loan (₹10,000 -> ₹12,000)
    // -------------------------------------------------------------
    const df100 = generateDFSchedule({
      loanId: 'df-100',
      borrowerId: 'b-1',
      totalRepayment: 12000,
      installments: 100,
      frequency: 'daily',
      startDateStr: '2026-11-01',
      skipSundays: false,
    });
    const sum100 = df100.schedules.reduce((acc, s) => acc + s.amountDue, 0);
    assert(
      'DF 100-Day Standard: Generates exactly 100 milestones',
      df100.schedules.length === 100
    );
    assert(
      'DF 100-Day Standard: Daily installment is exactly ₹120',
      df100.installmentAmount === 120 && df100.finalInstallmentAmount === 120
    );
    assert(
      'DF 100-Day Standard: Sum of milestones matches ₹12,000 exactly',
      sum100 === 12000,
      `Expected 12000, got ${sum100}`
    );

    // -------------------------------------------------------------
    // Test 2: Rounding Reconciliation (₹10,000 / 30 installments)
    // 10,000 / 30 = 333.333... -> 29 @ 333 (9657) + 1 @ 343 = 10,000
    // -------------------------------------------------------------
    const df30 = generateDFSchedule({
      loanId: 'df-30',
      borrowerId: 'b-1',
      totalRepayment: 10000,
      installments: 30,
      frequency: 'daily',
      startDateStr: '2026-11-01',
      skipSundays: false,
    });
    const sum30 = df30.schedules.reduce((acc, s) => acc + s.amountDue, 0);
    assert(
      'DF Rounding Reconciliation: Sum of 30 installments strictly equals ₹10,000',
      sum30 === 10000,
      `Expected 10000, got ${sum30}`
    );
    assert(
      'DF Rounding Reconciliation: Final installment balances remainder exactly',
      df30.installmentAmount === 333 && df30.finalInstallmentAmount === 343,
      `Expected base 333 and final 343, got ${df30.installmentAmount} and ${df30.finalInstallmentAmount}`
    );

    // -------------------------------------------------------------
    // Test 3: Odd Division & Prime Amounts (₹13,333 / 7 installments)
    // -------------------------------------------------------------
    const dfOdd = generateDFSchedule({
      loanId: 'df-odd',
      borrowerId: 'b-1',
      totalRepayment: 13333,
      installments: 7,
      frequency: 'daily',
      startDateStr: '2026-11-01',
    });
    const sumOdd = dfOdd.schedules.reduce((acc, s) => acc + s.amountDue, 0);
    assert(
      'DF Odd Division: Sum of ₹13,333 across 7 days strictly matches with zero lost rupees',
      sumOdd === 13333,
      `Expected 13333, got ${sumOdd}`
    );

    // -------------------------------------------------------------
    // Test 4: Skip Sundays Mode - Zero Milestones on Sunday
    // -------------------------------------------------------------
    const dfSkip = generateDFSchedule({
      loanId: 'df-skip',
      borrowerId: 'b-1',
      totalRepayment: 1400,
      installments: 14,
      frequency: 'daily',
      startDateStr: '2026-10-30', // Friday
      skipSundays: true,
    });
    const anySundayFound = dfSkip.schedules.some((s) => isSunday(s.dueDate));
    const sumSkip = dfSkip.schedules.reduce((acc, s) => acc + s.amountDue, 0);
    assert(
      'DF Skip Sundays: Exactly 14 installments created',
      dfSkip.schedules.length === 14
    );
    assert(
      'DF Skip Sundays: Zero installments fall on a Sunday',
      !anySundayFound,
      'Found an installment scheduled on a Sunday!'
    );
    assert(
      'DF Skip Sundays: Sundays skipped count recorded correctly (> 0)',
      dfSkip.sundaysSkippedCount >= 2,
      `Got ${dfSkip.sundaysSkippedCount} sundays skipped`
    );
    assert(
      'DF Skip Sundays: Sum matches total repayment exactly',
      sumSkip === 1400
    );

    // -------------------------------------------------------------
    // Test 5: Skip Sundays Starting on a Sunday
    // -------------------------------------------------------------
    const dfStartSun = generateDFSchedule({
      loanId: 'df-start-sun',
      borrowerId: 'b-1',
      totalRepayment: 1000,
      installments: 10,
      frequency: 'daily',
      startDateStr: '2026-11-01', // This is a Sunday
      skipSundays: true,
    });
    assert(
      'DF Start on Sunday: First installment automatically advances to Monday (2026-11-02)',
      dfStartSun.schedules[0].dueDate === '2026-11-02',
      `Expected 2026-11-02, got ${dfStartSun.schedules[0].dueDate}`
    );
    assert(
      'DF Start on Sunday: Zero installments fall on Sunday',
      !dfStartSun.schedules.some((s) => isSunday(s.dueDate))
    );

    // -------------------------------------------------------------
    // Test 6: Leap Year Calendar Math
    // -------------------------------------------------------------
    assert('Leap Year Detection: 2024 is a leap year', isLeapYear(2024));
    assert('Leap Year Detection: 2025 is not a leap year', !isLeapYear(2025));
    assert('Days in Month: Feb 2024 has 29 days', getDaysInMonth(2024, 1) === 29);
    assert('Days in Month: Feb 2025 has 28 days', getDaysInMonth(2025, 1) === 28);

    const leapFeb = addMonthsPreservingDay('2024-01-31', 1);
    const nonLeapFeb = addMonthsPreservingDay('2025-01-31', 1);
    const marAfterLeap = addMonthsPreservingDay('2024-01-31', 2);
    const aprAfterLeap = addMonthsPreservingDay('2024-01-31', 3);

    assert(
      'Month Math (Leap Year): Jan 31 + 1 month in 2024 clamps to Feb 29',
      leapFeb === '2024-02-29',
      `Expected 2024-02-29, got ${leapFeb}`
    );
    assert(
      'Month Math (Non-Leap Year): Jan 31 + 1 month in 2025 clamps to Feb 28',
      nonLeapFeb === '2025-02-28',
      `Expected 2025-02-28, got ${nonLeapFeb}`
    );
    assert(
      'Month Math: Jan 31 + 2 months restores to Mar 31',
      marAfterLeap === '2024-03-31',
      `Expected 2024-03-31, got ${marAfterLeap}`
    );
    assert(
      'Month Math: Jan 31 + 3 months clamps to Apr 30 (April has 30 days)',
      aprAfterLeap === '2024-04-30',
      `Expected 2024-04-30, got ${aprAfterLeap}`
    );

    // -------------------------------------------------------------
    // Test 7: Special Interest (SP) Monthly Schedule & Principal Maturity
    // ₹50,000 @ 2%/month for 12 months
    // -------------------------------------------------------------
    const spMonthly = generateSPSchedule({
      loanId: 'sp-monthly',
      borrowerId: 'b-1',
      principal: 50000,
      monthlyInterestRate: 2.0,
      frequency: 'monthly',
      cycles: 12,
      startDateStr: '2026-11-01',
      includePrincipalAtMaturity: true,
    });

    assert(
      'SP Monthly: Generates 12 interest cycles + 1 principal maturity milestone (13 total)',
      spMonthly.schedules.length === 13,
      `Expected 13, got ${spMonthly.schedules.length}`
    );
    assert(
      'SP Monthly: Monthly interest is ₹1,000 (2% of ₹50,000)',
      spMonthly.interestPerCycle === 1000
    );
    assert(
      'SP Monthly: Total projected interest across 12 cycles is ₹12,000',
      spMonthly.totalInterestProjected === 12000
    );
    const maturityMilestone = spMonthly.schedules[spMonthly.schedules.length - 1];
    assert(
      'SP Monthly: Final milestone is principal return of ₹50,000',
      maturityMilestone.paymentType === 'principal' && maturityMilestone.amountDue === 50000
    );

    // -------------------------------------------------------------
    // Test 8: Special Interest (SP) Quarterly Schedule
    // ₹1,00,000 @ 3%/month quarterly (9% per quarter = ₹9,000/quarter)
    // -------------------------------------------------------------
    const spQuarterly = generateSPSchedule({
      loanId: 'sp-quarterly',
      borrowerId: 'b-1',
      principal: 100000,
      monthlyInterestRate: 3.0,
      frequency: 'quarterly',
      cycles: 4,
      startDateStr: '2026-11-01',
      includePrincipalAtMaturity: true,
    });
    assert(
      'SP Quarterly: Interest per quarter is ₹9,000 (3 months × ₹3,000)',
      spQuarterly.interestPerCycle === 9000
    );
    assert(
      'SP Quarterly: 4 interest milestones + 1 maturity milestone',
      spQuarterly.schedules.length === 5
    );

    // -------------------------------------------------------------
    // Test 9: Early Payoff Calculation - DF Loan
    // -------------------------------------------------------------
    const dummyDfLoan: Loan = {
      id: 'loan-df-early',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      loanType: 'DF',
      principalAmount: 10000,
      totalRepaymentAmount: 12000,
      status: 'active',
      startDate: '2026-10-01',
      outstandingBalance: 6000,
      totalCollected: 6000,
      accumulatedUnpaidInterest: 0,
      skipSundays: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const payoffNoDiscount = calculateEarlyPayoff(dummyDfLoan, '2026-10-31', 0);
    assert(
      'Early Payoff (DF): 0% discount equals full remaining balance (₹6,000)',
      payoffNoDiscount.finalSettlementAmount === 6000 && payoffNoDiscount.discountOffered === 0
    );

    const payoff10Discount = calculateEarlyPayoff(dummyDfLoan, '2026-10-31', 10);
    assert(
      'Early Payoff (DF): 10% discount reduces settlement to ₹5,400',
      payoff10Discount.discountOffered === 600 && payoff10Discount.finalSettlementAmount === 5400
    );

    // -------------------------------------------------------------
    // Test 10: Early Payoff Calculation - SP Loan (Pro-rata Interest)
    // ₹50,000 principal @ 2%/mo (₹1,000/mo = ~₹33.33/day), 15 days elapsed = ₹500
    // -------------------------------------------------------------
    const dummySpLoan: Loan = {
      id: 'loan-sp-early',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      loanType: 'SP',
      principalAmount: 50000,
      interestRateMonthly: 2.0,
      interestFrequency: 'monthly',
      status: 'active',
      startDate: '2026-10-01',
      lastCollectionDate: '2026-10-01',
      outstandingBalance: 50000,
      totalCollected: 0,
      accumulatedUnpaidInterest: 0,
      skipSundays: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const spPayoff = calculateEarlyPayoff(dummySpLoan, '2026-10-16', 0); // 15 days elapsed
    assert(
      'Early Payoff (SP): Pro-rated interest for 15 days is ₹500',
      spPayoff.interestDue === 500,
      `Expected 500, got ${spPayoff.interestDue}`
    );
    assert(
      'Early Payoff (SP): Final settlement amount is ₹50,500',
      spPayoff.finalSettlementAmount === 50500,
      `Expected 50500, got ${spPayoff.finalSettlementAmount}`
    );

    // -------------------------------------------------------------
    // Test 11: Boundary Checks & Invalid Inputs
    // -------------------------------------------------------------
    let caughtZeroInstallments = false;
    try {
      generateDFSchedule({
        loanId: 'err-1',
        borrowerId: 'b-1',
        totalRepayment: 10000,
        installments: 0,
        frequency: 'daily',
        startDateStr: '2026-11-01',
      });
    } catch {
      caughtZeroInstallments = true;
    }
    assert('Boundary Check: Throws error on zero installments', caughtZeroInstallments);

    let caughtNegativeRepayment = false;
    try {
      generateDFSchedule({
        loanId: 'err-2',
        borrowerId: 'b-1',
        totalRepayment: -5000,
        installments: 10,
        frequency: 'daily',
        startDateStr: '2026-11-01',
      });
    } catch {
      caughtNegativeRepayment = true;
    }
    assert('Boundary Check: Throws error on negative total repayment', caughtNegativeRepayment);

    let caughtZeroCycles = false;
    try {
      generateSPSchedule({
        loanId: 'err-3',
        borrowerId: 'b-1',
        principal: 10000,
        monthlyInterestRate: 2.0,
        frequency: 'monthly',
        cycles: 0,
        startDateStr: '2026-11-01',
      });
    } catch {
      caughtZeroCycles = true;
    }
    assert('Boundary Check: Throws error on zero SP cycles', caughtZeroCycles);

  } catch (err: unknown) {
    results.push({
      name: 'Fatal Exception in Test Suite',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
