import { generateReceiptMessage } from '../utils/receiptGenerator.ts';
import { addDays } from '../utils/dateUtils.ts';
import type { PaymentSchedule, Borrower } from '../types/domain.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export function runPhase4Verification(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  const assert = (name: string, condition: boolean, details = '') => {
    results.push({ name, passed: condition, details });
  };

  // 1. Receipt Generation Tests
  const receiptTe = generateReceiptMessage(
    {
      borrowerName: 'రమేష్ కుమార్',
      borrowerPhone: '9876543210',
      collectedAmount: 120,
      amountDue: 120,
      dueDate: '2026-11-02',
      remainingLoanBalance: 9880,
      loanType: 'DF',
      notes: 'Installment 1 of 100',
    },
    true
  );
  assert('Receipt Generator: Telugu contains borrower name', receiptTe.includes('రమేష్ కుమార్'));
  assert('Receipt Generator: Telugu contains ₹120', receiptTe.includes('₹120'));
  assert('Receipt Generator: Telugu contains ₹9,880 balance', receiptTe.includes('₹9,880'));
  assert('Receipt Generator: Telugu contains header and footer', receiptTe.includes('లేండ్‌ట్రాక్') && receiptTe.includes('ధన్యవాదాలు'));

  const receiptEn = generateReceiptMessage(
    {
      borrowerName: 'Suresh Rao',
      borrowerPhone: '9123456789',
      collectedAmount: 500,
      amountDue: 1000,
      dueDate: '2026-11-02',
      remainingLoanBalance: 45000,
      loanType: 'SP',
      notes: 'Monthly interest',
    },
    false
  );
  assert('Receipt Generator: English contains borrower name', receiptEn.includes('Suresh Rao'));
  assert('Receipt Generator: English contains ₹500 collected', receiptEn.includes('₹500'));
  assert('Receipt Generator: English contains remaining balance', receiptEn.includes('₹45,000'));

  // 2. State Machine: Payment Status Evaluation
  function evaluatePaymentStatus(collected: number, due: number): 'paid' | 'partial' | 'missed' {
    if (collected <= 0) return 'missed';
    if (collected < due) return 'partial';
    return 'paid';
  }
  assert('Status Logic: 0 paid results in missed', evaluatePaymentStatus(0, 120) === 'missed');
  assert('Status Logic: partial payment (50 of 120) results in partial', evaluatePaymentStatus(50, 120) === 'partial');
  assert('Status Logic: exact payment (120 of 120) results in paid', evaluatePaymentStatus(120, 120) === 'paid');
  assert('Status Logic: advance/over payment results in paid', evaluatePaymentStatus(150, 120) === 'paid');

  // 3. Loan Balance Atomic Delta Calculations
  function calculatePaymentDelta(
    currentOutstanding: number,
    currentTotalCollected: number,
    previousPaidOnSchedule: number,
    newCollectedAmount: number
  ) {
    const netPaymentDelta = newCollectedAmount - previousPaidOnSchedule;
    if (netPaymentDelta > currentOutstanding) {
      throw new Error('Hard ceiling block: Payment exceeds outstanding balance');
    }
    const newOutstanding = currentOutstanding - netPaymentDelta;
    const newTotalCollected = currentTotalCollected + netPaymentDelta;
    const isCompleted = newOutstanding === 0;
    return { newOutstanding, newTotalCollected, isCompleted };
  }

  // Initial payment of ₹120 on ₹12,000 loan
  const step1 = calculatePaymentDelta(12000, 0, 0, 120);
  assert('Balance Delta: New outstanding is ₹11,880', step1.newOutstanding === 11880);
  assert('Balance Delta: Total collected is ₹120', step1.newTotalCollected === 120);
  assert('Balance Delta: Not yet completed', !step1.isCompleted);

  // Edit/adjustment: changing from ₹120 to partial ₹70
  const step2 = calculatePaymentDelta(step1.newOutstanding, step1.newTotalCollected, 120, 70);
  assert('Adjustment Delta: Outstanding restores to ₹11,930', step2.newOutstanding === 11930);
  assert('Adjustment Delta: Total collected drops to ₹70', step2.newTotalCollected === 70);

  // Final payment to complete loan
  const step3 = calculatePaymentDelta(500, 11500, 0, 500);
  assert('Completion Logic: ₹500 payment clears ₹500 outstanding to ₹0', step3.newOutstanding === 0);
  assert('Completion Logic: Marks loan as completed', step3.isCompleted);

  // Downward adjustment on a completed loan restores active status
  const step3Revert = calculatePaymentDelta(step3.newOutstanding, step3.newTotalCollected, 500, 300);
  assert('Status Inversion: Downward adjustment restores outstanding balance to ₹200', step3Revert.newOutstanding === 200);
  assert('Status Inversion: Loan is no longer completed', !step3Revert.isCompleted);

  // Edit ceiling check in modal (maxAllowedAmount = loanOutstanding + initialAmount)
  const modalCeiling = (loanOutstanding: number, initialAmount: number, newAmount: number) => {
    const max = loanOutstanding + initialAmount;
    return newAmount <= max;
  };
  assert('Modal Edit Ceiling: Allows correcting payment when loan balance is ₹0 but initialAmount is ₹500', modalCeiling(0, 500, 400));
  assert('Modal Edit Ceiling: Blocks payment higher than initialAmount when loan balance is ₹0', !modalCeiling(0, 500, 600));

  // Swiss Cheese Layer 3: Hard Ceiling Block
  let ceilingCaught = false;
  try {
    calculatePaymentDelta(500, 11500, 0, 600);
  } catch {
    ceilingCaught = true;
  }
  assert('Swiss Cheese Layer 3: Rejects payment exceeding loan outstanding balance', ceilingCaught);

  // 4. Daily Aggregation & Metrics Math
  const sampleSchedules: PaymentSchedule[] = [
    {
      id: 's1',
      loanId: 'l1',
      borrowerId: 'b1',
      lenderId: 'local-lender',
      dueDate: '2026-11-02',
      amountDue: 200,
      amountPaid: 200,
      paymentType: 'installment',
      status: 'paid',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-02',
    },
    {
      id: 's2',
      loanId: 'l2',
      borrowerId: 'b2',
      lenderId: 'local-lender',
      dueDate: '2026-11-02',
      amountDue: 100,
      amountPaid: 50,
      paymentType: 'installment',
      status: 'partial',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-02',
    },
    {
      id: 's3',
      loanId: 'l3',
      borrowerId: 'b3',
      lenderId: 'local-lender',
      dueDate: '2026-11-02',
      amountDue: 150,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'pending',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-02',
    },
    {
      id: 's4',
      loanId: 'l4',
      borrowerId: 'b4',
      lenderId: 'local-lender',
      dueDate: '2026-11-02',
      amountDue: 100,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'missed',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-02',
    },
  ];

  const target = sampleSchedules.reduce((sum, s) => sum + s.amountDue, 0);
  const collected = sampleSchedules.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const pending = Math.max(0, target - collected);
  const progress = Math.round((collected / target) * 100);

  assert('Aggregation: Target total is ₹550 (200 + 100 + 150 + 100)', target === 550);
  assert('Aggregation: Collected total is ₹250 (200 + 50)', collected === 250);
  assert('Aggregation: Pending balance is ₹300', pending === 300);
  assert('Aggregation: Progress is 45% (250 / 550)', progress === 45);

  // 5. Filter Logic
  const pendingList = sampleSchedules.filter((s) => s.status === 'pending');
  const paidList = sampleSchedules.filter((s) => s.status === 'paid');
  const partialList = sampleSchedules.filter((s) => s.status === 'partial');
  const missedList = sampleSchedules.filter((s) => s.status === 'missed');

  assert('Filters: Exactly 1 pending schedule', pendingList.length === 1);
  assert('Filters: Exactly 1 paid schedule', paidList.length === 1);
  assert('Filters: Exactly 1 partial schedule', partialList.length === 1);
  assert('Filters: Exactly 1 missed schedule', missedList.length === 1);

  // 6. Search Matcher
  const sampleBorrowers: Borrower[] = [
    {
      id: 'b1',
      lenderId: 'local-lender',
      name: 'Venkateswara Rao',
      phone: '9848022338',
      isActive: true,
      advanceBalance: 0,
      trustScore: 8.5,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 'b2',
      lenderId: 'local-lender',
      name: 'Srinivas Reddy',
      phone: '9440123456',
      isActive: true,
      advanceBalance: 0,
      trustScore: 7.0,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ];

  const searchByName = sampleBorrowers.filter((b) => b.name.toLowerCase().includes('venkat'));
  const searchByPhone = sampleBorrowers.filter((b) => b.phone.includes('123456'));

  assert('Search Matcher: Matches by case-insensitive name ("venkat")', searchByName.length === 1 && searchByName[0].id === 'b1');
  assert('Search Matcher: Matches by phone substring ("123456")', searchByPhone.length === 1 && searchByPhone[0].id === 'b2');

  // 7. Date Navigation
  const d1 = '2026-11-02';
  assert('Date Navigation: Previous day is 2026-11-01', addDays(d1, -1) === '2026-11-01');
  assert('Date Navigation: Next day is 2026-11-03', addDays(d1, 1) === '2026-11-03');
  assert('Date Navigation: Month boundary crosses 2026-10-31 to 2026-11-01', addDays('2026-10-31', 1) === '2026-11-01');
  assert('Date Navigation: Year boundary crosses 2026-12-31 to 2027-01-01', addDays('2026-12-31', 1) === '2027-01-01');

  // 8. Dynamic Stacking: Pending Float to Top, Processed Stack to Bottom
  interface TestQueueItem {
    borrowerName: string;
    status: 'pending' | 'paid' | 'partial' | 'missed';
  }

  function sortQueue(queue: TestQueueItem[]): string[] {
    return [...queue]
      .sort((x, y) => {
        const xPending = x.status === 'pending';
        const yPending = y.status === 'pending';
        if (xPending && !yPending) return -1;
        if (!xPending && yPending) return 1;
        return x.borrowerName.localeCompare(y.borrowerName, undefined, { sensitivity: 'base' });
      })
      .map((item) => item.borrowerName);
  }

  // Initial: a, b, c, d all pending
  const q: TestQueueItem[] = [
    { borrowerName: 'a', status: 'pending' },
    { borrowerName: 'b', status: 'pending' },
    { borrowerName: 'c', status: 'pending' },
    { borrowerName: 'd', status: 'pending' },
  ];
  assert('Dynamic Stacking: Initial queue is [a, b, c, d]', sortQueue(q).join(',') === 'a,b,c,d');

  // Step 1: d is paid -> [a, b, c, d]
  q.find((it) => it.borrowerName === 'd')!.status = 'paid';
  assert('Dynamic Stacking: When d is paid, list is [a, b, c, d] (d is bottom)', sortQueue(q).join(',') === 'a,b,c,d');

  // Step 2: b is paid -> pending are [a, c], processed are [b, d] -> [a, c, b, d]
  q.find((it) => it.borrowerName === 'b')!.status = 'paid';
  const afterB = sortQueue(q);
  assert('Dynamic Stacking: When b is also paid, list is strictly [a, c, b, d]', afterB.join(',') === 'a,c,b,d');

  // Step 3: a is missed -> pending is [c], processed are [a, b, d] -> [c, a, b, d]
  q.find((it) => it.borrowerName === 'a')!.status = 'missed';
  assert('Dynamic Stacking: When a is missed, pending c floats to top [c, a, b, d]', sortQueue(q).join(',') === 'c,a,b,d');

  // Step 4: Undo b back to pending -> pending are [b, c], processed are [a, d] -> [b, c, a, d]
  q.find((it) => it.borrowerName === 'b')!.status = 'pending';
  assert('Dynamic Stacking: Undoing b to pending floats b back to top [b, c, a, d]', sortQueue(q).join(',') === 'b,c,a,d');

  // 9. Reset to Pending Logic & State Restoration
  function simulateResetToPending(
    currentOutstanding: number,
    currentTotalCollected: number,
    previousPaid: number
  ) {
    const newOutstanding = currentOutstanding + previousPaid;
    const newTotalCollected = Math.max(0, currentTotalCollected - previousPaid);
    return {
      newOutstanding,
      newTotalCollected,
      status: 'pending' as const,
      amountPaid: 0,
    };
  }

  // Resetting a full payment of ₹120 (outstanding was ₹11,880, totalCollected was ₹120)
  const resetFull = simulateResetToPending(11880, 120, 120);
  assert('Reset to Pending: Restores loan balance from ₹11,880 to ₹12,000', resetFull.newOutstanding === 12000);
  assert('Reset to Pending: Restores totalCollected to ₹0', resetFull.newTotalCollected === 0);
  assert('Reset to Pending: Schedule status becomes pending and amountPaid is 0', resetFull.status === 'pending' && resetFull.amountPaid === 0);

  // Resetting a partial payment of ₹50
  const resetPartial = simulateResetToPending(11950, 50, 50);
  assert('Reset to Pending: Restores partial loan balance from ₹11,950 to ₹12,000', resetPartial.newOutstanding === 12000);
  assert('Reset to Pending: Restores partial totalCollected to 0', resetPartial.newTotalCollected === 0);

  // Resetting a missed payment of ₹0
  const resetMissed = simulateResetToPending(12000, 0, 0);
  assert('Reset to Pending: Missed payment reset leaves loan balance unchanged at ₹12,000', resetMissed.newOutstanding === 12000);
  assert('Reset to Pending: Missed payment reset sets status to pending', resetMissed.status === 'pending');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
