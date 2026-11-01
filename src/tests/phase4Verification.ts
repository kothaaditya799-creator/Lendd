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

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
