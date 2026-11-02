import type { Loan, PaymentSchedule, Borrower } from '../types/domain.ts';
import { getDaysDifference } from '../utils/dateUtils.ts';
import {
  calculatePortfolioMetrics,
  calculateAgingBuckets,
  detectLeakingBorrowers,
  calculateConcentrationRisk,
  calculateEodSummary,
  generateWhatsAppEodText,
} from '../utils/portfolioAnalytics.ts';

export function runPhase5Tests(): { passed: number; failed: number; total: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${testName}`);
      failed++;
    }
  }

  console.log('====================================================');
  console.log('📊  PHASE 5: DECISION INTELLIGENCE TEST SUITE');
  console.log('====================================================');

  // --- 1. Days Difference Calendar Math ---
  const d0 = getDaysDifference('2026-11-02', '2026-11-02');
  assert(d0 === 0, 'Days Difference: Same date returns 0 days');

  const d5 = getDaysDifference('2026-10-28', '2026-11-02');
  assert(d5 === 5, 'Days Difference: Exactly 5 days apart');

  const dMonthCross = getDaysDifference('2026-10-25', '2026-11-02');
  assert(dMonthCross === 8, 'Days Difference: Crosses month boundary (25 Oct to 2 Nov is 8 days)');

  const dLeapYear = getDaysDifference('2024-02-28', '2024-03-01');
  assert(dLeapYear === 2, 'Days Difference: Leap year Feb 29 counted (2 days difference)');

  // Mock Borrowers
  const mockBorrowers: Borrower[] = [
    {
      id: 'b-1',
      lenderId: 'local-lender',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      trustScore: 5.0,
      advanceBalance: 0,
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'b-2',
      lenderId: 'local-lender',
      name: 'Suresh Reddy',
      phone: '9876543211',
      trustScore: 5.0,
      advanceBalance: 0,
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'b-3',
      lenderId: 'local-lender',
      name: 'Venkatesh Rao',
      phone: '9876543212',
      trustScore: 5.0,
      advanceBalance: 0,
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'b-4',
      lenderId: 'local-lender',
      name: 'Anil Kumar',
      phone: '9876543213',
      trustScore: 5.0,
      advanceBalance: 0,
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  // Mock Active Loans
  const mockLoans: Loan[] = [
    {
      id: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      loanType: 'DF',
      principalAmount: 10000,
      status: 'active',
      startDate: '2026-10-01',
      skipSundays: false,
      totalRepaymentAmount: 12000,
      installmentAmount: 120,
      totalInstallments: 100,
      totalCollected: 2400,
      outstandingBalance: 9600,
      accumulatedUnpaidInterest: 0,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'loan-2',
      lenderId: 'local-lender',
      borrowerId: 'b-2',
      loanType: 'DF',
      principalAmount: 20000,
      status: 'active',
      startDate: '2026-10-05',
      skipSundays: false,
      totalRepaymentAmount: 24000,
      installmentAmount: 240,
      totalInstallments: 100,
      totalCollected: 4800,
      outstandingBalance: 19200,
      accumulatedUnpaidInterest: 0,
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    {
      id: 'loan-3',
      lenderId: 'local-lender',
      borrowerId: 'b-3',
      loanType: 'SP',
      principalAmount: 50000,
      status: 'active',
      startDate: '2026-09-01',
      skipSundays: false,
      interestRateMonthly: 2.0,
      interestFrequency: 'monthly',
      totalCollected: 2000,
      outstandingBalance: 50000,
      accumulatedUnpaidInterest: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'loan-4',
      lenderId: 'local-lender',
      borrowerId: 'b-4',
      loanType: 'DF',
      principalAmount: 5000,
      status: 'completed',
      startDate: '2026-08-01',
      skipSundays: false,
      totalRepaymentAmount: 6000,
      totalCollected: 6000,
      outstandingBalance: 0,
      accumulatedUnpaidInterest: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];

  // --- 2. Portfolio Metrics ---
  const metrics = calculatePortfolioMetrics(mockLoans, mockBorrowers);
  assert(metrics.totalCapitalDeployed === 80000, 'Portfolio Metrics: Active capital deployed is ₹80,000 (10K+20K+50K)');
  assert(metrics.totalOutstandingBalance === 78800, 'Portfolio Metrics: Outstanding balance is ₹78,800 (9600+19200+50000)');
  assert(metrics.totalCollected === 15200, 'Portfolio Metrics: Total collected is ₹15,200 across all loans');
  assert(metrics.activeLoansCount === 3, 'Portfolio Metrics: Exactly 3 active loans');
  assert(metrics.completedLoansCount === 1, 'Portfolio Metrics: Exactly 1 completed loan');
  assert(metrics.activeBorrowersCount === 3, 'Portfolio Metrics: Exactly 3 active borrowers');

  // --- 3. Overdue Aging Analysis (Custom Buckets: 0-5d, 6-12d, 13-30d, >30d) ---
  const today = '2026-11-02';
  const mockSchedules: PaymentSchedule[] = [
    // 0-5 days overdue: Due 2026-10-30 (3 days overdue)
    {
      id: 's-1',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-10-30',
      amountDue: 120,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'pending',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    // 0-5 days overdue: Due 2026-10-28 (5 days overdue, partial: 50 paid, 70 overdue)
    {
      id: 's-2',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-10-28',
      amountDue: 120,
      amountPaid: 50,
      paymentType: 'installment',
      status: 'partial',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    // 6-12 days overdue: Due 2026-10-25 (8 days overdue)
    {
      id: 's-3',
      loanId: 'loan-2',
      lenderId: 'local-lender',
      borrowerId: 'b-2',
      dueDate: '2026-10-25',
      amountDue: 240,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'missed',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    // 13-30 days overdue: Due 2026-10-15 (18 days overdue)
    {
      id: 's-4',
      loanId: 'loan-2',
      lenderId: 'local-lender',
      borrowerId: 'b-2',
      dueDate: '2026-10-15',
      amountDue: 240,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'missed',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    // >30 days overdue: Due 2026-09-15 (48 days overdue)
    {
      id: 's-5',
      loanId: 'loan-3',
      lenderId: 'local-lender',
      borrowerId: 'b-3',
      dueDate: '2026-09-15',
      amountDue: 1000,
      amountPaid: 0,
      paymentType: 'interest',
      status: 'missed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    // Fully paid schedule: Should be excluded from overdue
    {
      id: 's-6',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-10-01',
      amountDue: 120,
      amountPaid: 120,
      paymentType: 'installment',
      status: 'paid',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    // Future schedule: Should be excluded from overdue
    {
      id: 's-7',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-11-05',
      amountDue: 120,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'pending',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const aging = calculateAgingBuckets(mockSchedules, mockLoans, mockBorrowers, today);

  assert(aging.healthy.count === 2, 'Aging Buckets: Healthy (0-5 days) has 2 items');
  assert(aging.healthy.amount === 190, 'Aging Buckets: Healthy amount is ₹190 (120 + 70)');
  assert(aging.healthy.range === '0–5 days', 'Aging Buckets: Range is 0–5 days');

  assert(aging.minorDelay.count === 1, 'Aging Buckets: Minor Delay (6-12 days) has 1 item');
  assert(aging.minorDelay.amount === 240, 'Aging Buckets: Minor Delay amount is ₹240');
  assert(aging.minorDelay.range === '6–12 days', 'Aging Buckets: Range is 6–12 days');

  assert(aging.warning.count === 1, 'Aging Buckets: Warning (13-30 days) has 1 item');
  assert(aging.warning.amount === 240, 'Aging Buckets: Warning amount is ₹240');
  assert(aging.warning.range === '13–30 days', 'Aging Buckets: Range is 13–30 days');

  assert(aging.critical.count === 1, 'Aging Buckets: Critical (>30 days) has 1 item');
  assert(aging.critical.amount === 1000, 'Aging Buckets: Critical amount is ₹1,000');
  assert(aging.critical.range === '>30 days', 'Aging Buckets: Range is >30 days');

  assert(aging.totalOverdueAmount === 1670, 'Aging Buckets: Total overdue amount is ₹1,670 (190+240+240+1000)');
  assert(aging.totalOverdueCount === 5, 'Aging Buckets: Total overdue items is 5');

  // --- 4. Leaking Buckets Detector ---
  // Create a leaking scenario: Borrower 2 has 2 missed installments
  const leaking = detectLeakingBorrowers(mockSchedules, mockLoans, mockBorrowers, today);
  assert(leaking.length === 1, 'Leaking Buckets: Flags exactly 1 borrower with chronic delays');
  assert(leaking[0].borrowerName === 'Suresh Reddy', 'Leaking Buckets: Correctly identifies Suresh Reddy');
  assert(leaking[0].missedCount === 2, 'Leaking Buckets: Records 2 missed installments');
  assert(leaking[0].totalDeficit === 480, 'Leaking Buckets: Records total deficit of ₹480 (240 + 240)');
  assert(leaking[0].reasonsTe[0].includes('2 వాయిదాలు తప్పాయి'), 'Leaking Buckets: Telugu reason string matches');

  // Add 3 partial payments to Ramesh (loan-1) to verify partials trigger flag
  const schedulesWithPartials: PaymentSchedule[] = [
    ...mockSchedules,
    {
      id: 's-p1',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-10-20',
      amountDue: 120,
      amountPaid: 40,
      paymentType: 'installment',
      status: 'partial',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 's-p2',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-10-21',
      amountDue: 120,
      amountPaid: 60,
      paymentType: 'installment',
      status: 'partial',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];
  const leakingWithPartials = detectLeakingBorrowers(schedulesWithPartials, mockLoans, mockBorrowers, today);
  assert(leakingWithPartials.length === 2, 'Leaking Buckets: Flags Ramesh Kumar now having 3 partials');
  const rameshLeak = leakingWithPartials.find((l) => l.borrowerName === 'Ramesh Kumar');
  assert(Boolean(rameshLeak), 'Leaking Buckets: Ramesh Kumar is in leaking list');
  assert(rameshLeak?.partialCount === 3, 'Leaking Buckets: Ramesh Kumar has 3 partial payments');

  // --- 5. Capital Concentration Risk ---
  const concentration = calculateConcentrationRisk(mockLoans, mockBorrowers);
  assert(concentration.totalActiveDebt === 78800, 'Concentration Risk: Total active debt is ₹78,800');
  // Top borrower is b-3 (₹50,000 / 78,800 = 63.4%)
  assert(concentration.topBorrowers[0].borrowerName === 'Venkatesh Rao', 'Concentration Risk: Top borrower is Venkatesh Rao');
  assert(concentration.topBorrowers[0].outstandingBalance === 50000, 'Concentration Risk: Venkatesh Rao owes ₹50,000');
  assert(concentration.topBorrowerPercent === 63, 'Concentration Risk: Top borrower holds 63%');
  assert(concentration.top3BorrowersPercent === 100, 'Concentration Risk: Top 3 borrowers hold 100% of capital');
  assert(concentration.riskLevel === 'high', 'Concentration Risk: High risk assigned (>50%)');

  // --- 6. End-of-Day (EOD) Summary ---
  const eodSchedules: PaymentSchedule[] = [
    {
      id: 'eod-1',
      loanId: 'loan-1',
      lenderId: 'local-lender',
      borrowerId: 'b-1',
      dueDate: '2026-11-02',
      amountDue: 120,
      amountPaid: 120,
      paymentType: 'installment',
      status: 'paid',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'eod-2',
      loanId: 'loan-2',
      lenderId: 'local-lender',
      borrowerId: 'b-2',
      dueDate: '2026-11-02',
      amountDue: 240,
      amountPaid: 100,
      paymentType: 'installment',
      status: 'partial',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
    {
      id: 'eod-3',
      loanId: 'loan-3',
      lenderId: 'local-lender',
      borrowerId: 'b-3',
      dueDate: '2026-11-02',
      amountDue: 1000,
      amountPaid: 0,
      paymentType: 'interest',
      status: 'missed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  // A new loan disbursed today (2026-11-02)
  const todayLoans: Loan[] = [
    ...mockLoans,
    {
      id: 'loan-new',
      lenderId: 'local-lender',
      borrowerId: 'b-4',
      loanType: 'DF',
      principalAmount: 10000,
      status: 'active',
      startDate: '2026-11-02',
      skipSundays: false,
      totalRepaymentAmount: 12000,
      installmentAmount: 120,
      totalInstallments: 100,
      totalCollected: 0,
      outstandingBalance: 12000,
      accumulatedUnpaidInterest: 0,
      createdAt: '2026-11-02T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    },
  ];

  const eod = calculateEodSummary('2026-11-02', eodSchedules, todayLoans, mockBorrowers);
  assert(eod.targetExpected === 1360, 'EOD Summary: Target expected is ₹1,360 (120+240+1000)');
  assert(eod.actualCollected === 220, 'EOD Summary: Actual collected is ₹220 (120 + 100)');
  assert(eod.shortfall === 1140, 'EOD Summary: Shortfall is ₹1,140 (1360 - 220)');
  assert(eod.efficiencyPercent === 16, 'EOD Summary: Efficiency is 16% (220/1360)');
  assert(eod.headcount.paid === 1, 'EOD Summary: 1 Paid');
  assert(eod.headcount.partial === 1, 'EOD Summary: 1 Partial');
  assert(eod.headcount.missed === 1, 'EOD Summary: 1 Missed');
  assert(eod.headcount.total === 3, 'EOD Summary: 3 Total Headcount');

  assert(eod.disbursements.count === 1, 'EOD Summary: 1 new loan disbursed today');
  assert(eod.disbursements.totalPrincipal === 10000, 'EOD Summary: ₹10,000 principal disbursed today');
  assert(eod.netCashFlow === -9780, 'EOD Summary: Net cash flow is -₹9,780 (220 collected - 10000 disbursed)');

  // --- 7. WhatsApp EOD Text Generator ---
  const teMsg = generateWhatsAppEodText(eod, true);
  assert(teMsg.includes('లేండ్‌ట్రాక్ • నేటి ముగింపు లెక్క'), 'WhatsApp EOD: Telugu header present');
  assert(teMsg.includes('₹220'), 'WhatsApp EOD: Telugu includes collected amount');
  assert(teMsg.includes('₹10,000'), 'WhatsApp EOD: Telugu includes disbursed amount');
  assert(teMsg.includes('-₹9,780'), 'WhatsApp EOD: Telugu includes net cash flow');

  const enMsg = generateWhatsAppEodText(eod, false);
  assert(enMsg.includes('LendTrack • End-of-Day Cash Tally'), 'WhatsApp EOD: English header present');
  assert(enMsg.includes('Net Cash in Hand'), 'WhatsApp EOD: English contains Net Cash in Hand');
  assert(enMsg.includes('-₹9,780'), 'WhatsApp EOD: English includes net cash flow');

  console.log('----------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  return { passed, failed, total: passed + failed };
}
