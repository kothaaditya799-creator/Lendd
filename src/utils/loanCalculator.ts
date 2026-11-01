import type { PaymentSchedule, Loan } from '../types/domain';
import { generateUUID } from './uuid.ts';
import {
  parseISODate,
  formatDateToISO,
  isSunday,
  addDays,
  addMonthsPreservingDay,
} from './dateUtils.ts';

export {
  parseISODate,
  formatDateToISO,
  isSunday,
  addDays,
  addMonthsPreservingDay,
};

export interface GenerateDFScheduleParams {
  loanId: string;
  borrowerId: string;
  lenderId?: string;
  totalRepayment: number;
  installments: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDateStr: string; // YYYY-MM-DD
  skipSundays?: boolean;
}

export interface GenerateDFScheduleResult {
  schedules: PaymentSchedule[];
  installmentAmount: number;
  finalInstallmentAmount: number;
  endDate: string;
  totalCalendarDays: number;
  sundaysSkippedCount: number;
}

export interface GenerateSPScheduleParams {
  loanId: string;
  borrowerId: string;
  lenderId?: string;
  principal: number;
  monthlyInterestRate: number; // e.g. 2.0 = 2% per month
  frequency: 'monthly' | 'quarterly';
  cycles: number; // e.g. 12 cycles
  startDateStr: string; // YYYY-MM-DD
  includePrincipalAtMaturity?: boolean;
}

export interface GenerateSPScheduleResult {
  schedules: PaymentSchedule[];
  interestPerCycle: number;
  totalInterestProjected: number;
  endDate: string;
}

/**
 * DAILY FINANCE (DF) SCHEDULE GENERATOR
 * Generates exact installment milestones, rounding installment amounts to whole rupees,
 * adjusting any fractional rounding difference into the final milestone,
 * and skipping Sundays when requested without dropping total required installments.
 */
export function generateDFSchedule(params: GenerateDFScheduleParams): GenerateDFScheduleResult {
  const {
    loanId,
    borrowerId,
    lenderId = 'local-lender',
    totalRepayment,
    installments,
    frequency,
    startDateStr,
    skipSundays = false,
  } = params;

  if (installments <= 0) {
    throw new Error('Installments must be greater than zero');
  }

  if (totalRepayment <= 0) {
    throw new Error('Total repayment must be a positive amount');
  }

  if (totalRepayment < installments) {
    throw new Error('Total repayment must be at least equal to the number of installments (minimum ₹1 per installment)');
  }

  // Base installment rounded to nearest whole rupee (cash lending uses whole rupees)
  const baseInstallment = Math.round(totalRepayment / installments);
  const schedules: PaymentSchedule[] = [];

  let sundaysSkippedCount = 0;
  const shouldSkipSundays = skipSundays && frequency === 'daily';

  // In informal and street lending, collections begin on the NEXT cycle:
  // - Daily loans start on the next day (startDateStr + 1 day)
  // - Weekly loans start next week (startDateStr + 7 days)
  // - Monthly loans start next month (startDateStr + 1 month)
  let currentDateStr: string;
  if (frequency === 'daily') {
    currentDateStr = addDays(startDateStr, 1);
    if (shouldSkipSundays && isSunday(currentDateStr)) {
      currentDateStr = addDays(currentDateStr, 1);
      sundaysSkippedCount++;
    }
  } else if (frequency === 'weekly') {
    currentDateStr = addDays(startDateStr, 7);
  } else {
    // monthly
    currentDateStr = addMonthsPreservingDay(startDateStr, 1);
  }

  let allocatedTotal = 0;

  for (let i = 1; i <= installments; i++) {
    // If daily frequency with skipSundays, verify current day is not Sunday
    if (shouldSkipSundays && isSunday(currentDateStr)) {
      currentDateStr = addDays(currentDateStr, 1);
      sundaysSkippedCount++;
    }

    const isLast = i === installments;
    // On the final installment, balance out any minor rounding difference to guarantee exact match
    const amountDue = isLast ? totalRepayment - allocatedTotal : baseInstallment;
    allocatedTotal += amountDue;

    const milestoneNote =
      frequency === 'weekly'
        ? `Week ${i} of ${installments}`
        : frequency === 'monthly'
        ? `Month ${i} of ${installments}`
        : `Installment ${i} of ${installments}`;

    schedules.push({
      id: generateUUID(),
      loanId,
      borrowerId,
      lenderId,
      dueDate: currentDateStr,
      amountDue,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'pending',
      notes: milestoneNote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Advance date for the next iteration
    if (i < installments) {
      if (frequency === 'daily') {
        currentDateStr = addDays(currentDateStr, 1);
        if (shouldSkipSundays && isSunday(currentDateStr)) {
          currentDateStr = addDays(currentDateStr, 1);
          sundaysSkippedCount++;
        }
      } else if (frequency === 'weekly') {
        currentDateStr = addDays(currentDateStr, 7);
      } else if (frequency === 'monthly') {
        currentDateStr = addMonthsPreservingDay(startDateStr, i + 1);
      }
    }
  }

  const finalSchedule = schedules[schedules.length - 1];
  const endDate = finalSchedule?.dueDate || startDateStr;

  // Calculate calendar days duration from loan disbursement date to maturity
  const startMs = parseISODate(startDateStr).getTime();
  const endMs = parseISODate(endDate).getTime();
  const totalCalendarDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  return {
    schedules,
    installmentAmount: baseInstallment,
    finalInstallmentAmount: finalSchedule ? finalSchedule.amountDue : baseInstallment,
    endDate,
    totalCalendarDays,
    sundaysSkippedCount,
  };
}

/**
 * SPECIAL (SP) INTEREST SCHEDULE GENERATOR
 * Generates regular simple interest milestones and optional principal maturity milestone.
 */
export function generateSPSchedule(params: GenerateSPScheduleParams): GenerateSPScheduleResult {
  const {
    loanId,
    borrowerId,
    lenderId = 'local-lender',
    principal,
    monthlyInterestRate,
    frequency,
    cycles,
    startDateStr,
    includePrincipalAtMaturity = true,
  } = params;

  if (cycles <= 0) {
    throw new Error('Cycles must be greater than zero');
  }

  if (principal <= 0) {
    throw new Error('Principal must be a positive amount');
  }

  if (monthlyInterestRate <= 0) {
    throw new Error('Monthly interest rate must be positive');
  }

  // Monthly interest amount = Principal * (rate / 100), minimum ₹1
  const monthlyInterest = Math.max(1, Math.round(principal * (monthlyInterestRate / 100)));
  const interestPerCycle = frequency === 'quarterly' ? monthlyInterest * 3 : monthlyInterest;

  const schedules: PaymentSchedule[] = [];
  const monthStep = frequency === 'quarterly' ? 3 : 1;

  for (let i = 1; i <= cycles; i++) {
    const dueDate = addMonthsPreservingDay(startDateStr, i * monthStep);

    schedules.push({
      id: generateUUID(),
      loanId,
      borrowerId,
      lenderId,
      dueDate,
      amountDue: interestPerCycle,
      amountPaid: 0,
      paymentType: 'interest',
      status: 'pending',
      notes: `${frequency === 'quarterly' ? 'Quarterly' : 'Monthly'} Interest Cycle ${i} of ${cycles}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Final maturity date
  const lastInterestSchedule = schedules[schedules.length - 1];
  const endDate = lastInterestSchedule?.dueDate || startDateStr;

  // Include final principal return milestone at maturity
  if (includePrincipalAtMaturity) {
    schedules.push({
      id: generateUUID(),
      loanId,
      borrowerId,
      lenderId,
      dueDate: endDate,
      amountDue: principal,
      amountPaid: 0,
      paymentType: 'principal',
      status: 'pending',
      notes: `Principal Return at Maturity (${cycles} ${frequency === 'quarterly' ? 'quarters' : 'months'})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    schedules,
    interestPerCycle,
    totalInterestProjected: interestPerCycle * cycles,
    endDate,
  };
}

/**
 * EARLY PAYOFF & SETTLEMENT CALCULATOR
 * Calculates exact settlement payoff figures when a borrower wants to close early.
 */
export interface EarlyPayoffResult {
  loanId: string;
  asOfDate: string;
  outstandingBalance: number;
  principalDue: number;
  interestDue: number;
  discountOffered: number;
  finalSettlementAmount: number;
  notes: string;
}

export function calculateEarlyPayoff(
  loan: Loan,
  asOfDateStr: string,
  discountPercent = 0
): EarlyPayoffResult {
  if (loan.loanType === 'DF') {
    const outstanding = Math.max(0, loan.outstandingBalance);
    const discountOffered = Math.round((outstanding * Math.min(100, Math.max(0, discountPercent))) / 100);
    const finalSettlementAmount = outstanding - discountOffered;

    return {
      loanId: loan.id,
      asOfDate: asOfDateStr,
      outstandingBalance: outstanding,
      principalDue: Math.min(outstanding, loan.principalAmount),
      interestDue: Math.max(0, outstanding - loan.principalAmount),
      discountOffered,
      finalSettlementAmount,
      notes:
        discountOffered > 0
          ? `Settled early with ₹${discountOffered} discount (${discountPercent}%)`
          : 'Full outstanding payoff',
    };
  } else {
    // SP Loan: Principal + accumulated unpaid interest + pro-rated cycle interest
    const principalDue = loan.principalAmount;
    const unpaidInterest = loan.accumulatedUnpaidInterest || 0;

    // Calculate days elapsed in current cycle
    const lastDateStr = loan.lastCollectionDate || loan.startDate;
    const lastMs = parseISODate(lastDateStr).getTime();
    const asOfMs = parseISODate(asOfDateStr).getTime();
    const daysElapsed = Math.max(0, Math.round((asOfMs - lastMs) / (1000 * 60 * 60 * 24)));

    const rate = loan.interestRateMonthly || 2.0;
    const monthlyInterest = (principalDue * rate) / 100;
    const proRatedInterest = Math.round((monthlyInterest / 30) * daysElapsed);

    const totalInterest = unpaidInterest + proRatedInterest;
    const subtotal = principalDue + totalInterest;
    const discountOffered = Math.round((subtotal * Math.min(100, Math.max(0, discountPercent))) / 100);
    const finalSettlementAmount = subtotal - discountOffered;

    return {
      loanId: loan.id,
      asOfDate: asOfDateStr,
      outstandingBalance: loan.outstandingBalance,
      principalDue,
      interestDue: totalInterest,
      discountOffered,
      finalSettlementAmount,
      notes: `Principal (₹${principalDue}) + Accrued Interest (₹${totalInterest} for ${daysElapsed} days)`,
    };
  }
}
