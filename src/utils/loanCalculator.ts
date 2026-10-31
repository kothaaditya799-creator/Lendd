import { PaymentSchedule } from '../types/domain';
import { generateUUID } from './uuid';

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

export interface GenerateSPScheduleParams {
  loanId: string;
  borrowerId: string;
  lenderId?: string;
  principal: number;
  monthlyInterestRate: number; // e.g. 2.0 = 2% per month
  frequency: 'monthly' | 'quarterly';
  cycles: number; // e.g. 12 months
  startDateStr: string; // YYYY-MM-DD
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DAILY FINANCE (DF) SCHEDULE GENERATOR
 * Generates exact installment milestones, rounding installment amounts to whole rupees,
 * adjusting any fractional rounding difference into the final milestone,
 * and skipping Sundays when requested.
 */
export function generateDFSchedule(params: GenerateDFScheduleParams): {
  schedules: PaymentSchedule[];
  installmentAmount: number;
  endDate: string;
} {
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

  // Base installment rounded to nearest whole rupee (no paise in cash lending)
  const baseInstallment = Math.round(totalRepayment / installments);
  const schedules: PaymentSchedule[] = [];

  let currentDate = new Date(startDateStr + 'T00:00:00');
  let allocatedTotal = 0;

  for (let i = 1; i <= installments; i++) {
    // If skipping Sundays in daily frequency, advance past Sunday
    if (skipSundays && frequency === 'daily' && currentDate.getDay() === 0) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const isLast = i === installments;
    // On the final installment, balance out any minor rounding difference
    const amountDue = isLast ? totalRepayment - allocatedTotal : baseInstallment;
    allocatedTotal += amountDue;

    const dueDate = formatDateToISO(currentDate);

    schedules.push({
      id: generateUUID(),
      loanId,
      borrowerId,
      lenderId,
      dueDate,
      amountDue,
      amountPaid: 0,
      paymentType: 'installment',
      status: 'pending',
      notes: `Installment ${i} of ${installments}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Advance to next period
    if (frequency === 'daily') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  const endDate = schedules[schedules.length - 1]?.dueDate || startDateStr;

  return {
    schedules,
    installmentAmount: baseInstallment,
    endDate,
  };
}

/**
 * SPECIAL (SP) INTEREST SCHEDULE GENERATOR
 * Generates regular simple interest milestones.
 */
export function generateSPSchedule(params: GenerateSPScheduleParams): {
  schedules: PaymentSchedule[];
  interestPerCycle: number;
  endDate: string;
} {
  const {
    loanId,
    borrowerId,
    lenderId = 'local-lender',
    principal,
    monthlyInterestRate,
    frequency,
    cycles,
    startDateStr,
  } = params;

  // Monthly interest amount = Principal * (rate / 100)
  const monthlyInterest = Math.round(principal * (monthlyInterestRate / 100));
  const interestPerCycle = frequency === 'quarterly' ? monthlyInterest * 3 : monthlyInterest;

  const schedules: PaymentSchedule[] = [];
  let currentDate = new Date(startDateStr + 'T00:00:00');

  for (let i = 1; i <= cycles; i++) {
    if (frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 3);
    }

    const dueDate = formatDateToISO(currentDate);

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
      notes: `${frequency === 'quarterly' ? 'Quarterly' : 'Monthly'} Interest Cycle ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const endDate = schedules[schedules.length - 1]?.dueDate || startDateStr;

  return {
    schedules,
    interestPerCycle,
    endDate,
  };
}
