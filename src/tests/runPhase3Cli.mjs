import {
  isLeapYear,
  getDaysInMonth,
  isSunday,
  addMonthsPreservingDay,
} from '../utils/dateUtils.ts';
import {
  generateDFSchedule,
  generateSPSchedule,
  calculateEarlyPayoff,
} from '../utils/loanCalculator.ts';

async function run() {
  console.log('====================================================');
  console.log('📐  PHASE 3: LOAN ENGINE & SCHEDULE MATH TEST SUITE');
  console.log('====================================================');

  const results = [];
  const assert = (name, condition, details = '') => {
    if (condition) {
      results.push({ name, passed: true, details });
      console.log(`✅ ${name}`);
    } else {
      results.push({ name, passed: false, details });
      console.error(`❌ ${name} -> ${details}`);
    }
  };

  // Test 1: Standard DF 100-Day Loan (₹10,000 -> ₹12,000)
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
  assert('DF 100-Day: Exactly 100 milestones', df100.schedules.length === 100);
  assert('DF 100-Day: Daily installment is exactly ₹120', df100.installmentAmount === 120 && df100.finalInstallmentAmount === 120);
  assert('DF 100-Day: Sum matches ₹12,000 exactly', sum100 === 12000, `Got ${sum100}`);

  // Test 2: Rounding Reconciliation (₹10,000 / 30)
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
  assert('DF Rounding: Sum of 30 milestones strictly equals ₹10,000', sum30 === 10000, `Got ${sum30}`);
  assert('DF Rounding: Final installment absorbs difference (333 & 343)', df30.installmentAmount === 333 && df30.finalInstallmentAmount === 343);

  // Test 3: Odd Division & Prime Amounts (₹13,333 / 7)
  const dfOdd = generateDFSchedule({
    loanId: 'df-odd',
    borrowerId: 'b-1',
    totalRepayment: 13333,
    installments: 7,
    frequency: 'daily',
    startDateStr: '2026-11-01',
  });
  const sumOdd = dfOdd.schedules.reduce((acc, s) => acc + s.amountDue, 0);
  assert('DF Odd Division: ₹13,333 / 7 days has zero lost rupees', sumOdd === 13333, `Got ${sumOdd}`);

  // Test 4: Skip Sundays Mode
  const dfSkip = generateDFSchedule({
    loanId: 'df-skip',
    borrowerId: 'b-1',
    totalRepayment: 1400,
    installments: 14,
    frequency: 'daily',
    startDateStr: '2026-10-30', // Friday
    skipSundays: true,
  });
  const anySunday = dfSkip.schedules.some((s) => isSunday(s.dueDate));
  const sumSkip = dfSkip.schedules.reduce((acc, s) => acc + s.amountDue, 0);
  assert('DF Skip Sundays: Exactly 14 installments created', dfSkip.schedules.length === 14);
  assert('DF Skip Sundays: Zero installments fall on a Sunday', !anySunday);
  assert('DF Skip Sundays: Recorded skipped count >= 2', dfSkip.sundaysSkippedCount >= 2);
  assert('DF Skip Sundays: Sum matches total repayment exactly', sumSkip === 1400);

  // Test 5: Skip Sundays Starting on Sunday
  const dfStartSun = generateDFSchedule({
    loanId: 'df-start-sun',
    borrowerId: 'b-1',
    totalRepayment: 1000,
    installments: 10,
    frequency: 'daily',
    startDateStr: '2026-11-01', // Sunday
    skipSundays: true,
  });
  assert('DF Start on Sunday: Advances start to Monday (2026-11-02)', dfStartSun.schedules[0].dueDate === '2026-11-02');
  assert('DF Start on Sunday: Zero installments on Sunday', !dfStartSun.schedules.some((s) => isSunday(s.dueDate)));

  // Test 6: Leap Year Math
  assert('Leap Year: 2024 is leap year', isLeapYear(2024));
  assert('Leap Year: 2025 is not leap year', !isLeapYear(2025));
  assert('Days in Month: Feb 2024 has 29 days', getDaysInMonth(2024, 1) === 29);
  assert('Days in Month: Feb 2025 has 28 days', getDaysInMonth(2025, 1) === 28);
  assert('Month Math: Jan 31 + 1 mo (2024) -> Feb 29', addMonthsPreservingDay('2024-01-31', 1) === '2024-02-29');
  assert('Month Math: Jan 31 + 1 mo (2025) -> Feb 28', addMonthsPreservingDay('2025-01-31', 1) === '2025-02-28');
  assert('Month Math: Jan 31 + 2 mo -> Mar 31', addMonthsPreservingDay('2024-01-31', 2) === '2024-03-31');
  assert('Month Math: Jan 31 + 3 mo -> Apr 30', addMonthsPreservingDay('2024-01-31', 3) === '2024-04-30');

  // Test 7: SP Monthly Schedule
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
  assert('SP Monthly: 12 interest cycles + 1 principal maturity (13 total)', spMonthly.schedules.length === 13);
  assert('SP Monthly: Monthly interest is ₹1,000', spMonthly.interestPerCycle === 1000);
  assert('SP Monthly: Projected interest is ₹12,000', spMonthly.totalInterestProjected === 12000);
  const maturityMilestone = spMonthly.schedules[spMonthly.schedules.length - 1];
  assert('SP Monthly: Final milestone is principal return of ₹50,000', maturityMilestone.paymentType === 'principal' && maturityMilestone.amountDue === 50000);

  // Test 8: SP Quarterly Schedule
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
  assert('SP Quarterly: Interest per quarter is ₹9,000', spQuarterly.interestPerCycle === 9000);
  assert('SP Quarterly: 4 interest milestones + 1 maturity milestone', spQuarterly.schedules.length === 5);

  // Test 9: Early Payoff - DF Loan
  const dummyDfLoan = {
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
  assert('Early Payoff (DF): 0% discount equals full remaining balance (₹6,000)', payoffNoDiscount.finalSettlementAmount === 6000);
  const payoff10Discount = calculateEarlyPayoff(dummyDfLoan, '2026-10-31', 10);
  assert('Early Payoff (DF): 10% discount reduces settlement to ₹5,400', payoff10Discount.discountOffered === 600 && payoff10Discount.finalSettlementAmount === 5400);

  // Test 10: Early Payoff - SP Loan
  const dummySpLoan = {
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
  const spPayoff = calculateEarlyPayoff(dummySpLoan, '2026-10-16', 0);
  assert('Early Payoff (SP): Pro-rated interest for 15 days is ₹500', spPayoff.interestDue === 500);
  assert('Early Payoff (SP): Final settlement amount is ₹50,500', spPayoff.finalSettlementAmount === 50500);

  // Test 11: Boundaries
  let caughtZero = false;
  try {
    generateDFSchedule({ loanId: '1', borrowerId: '1', totalRepayment: 1000, installments: 0, frequency: 'daily', startDateStr: '2026-11-01' });
  } catch { caughtZero = true; }
  assert('Boundary Check: Throws error on 0 installments', caughtZero);

  let caughtNeg = false;
  try {
    generateDFSchedule({ loanId: '1', borrowerId: '1', totalRepayment: -500, installments: 10, frequency: 'daily', startDateStr: '2026-11-01' });
  } catch { caughtNeg = true; }
  assert('Boundary Check: Throws error on negative total repayment', caughtNeg);

  let caughtZeroCycles = false;
  try {
    generateSPSchedule({ loanId: '1', borrowerId: '1', principal: 1000, monthlyInterestRate: 2, frequency: 'monthly', cycles: 0, startDateStr: '2026-11-01' });
  } catch { caughtZeroCycles = true; }
  assert('Boundary Check: Throws error on 0 cycles', caughtZeroCycles);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('----------------------------------------------------');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();

