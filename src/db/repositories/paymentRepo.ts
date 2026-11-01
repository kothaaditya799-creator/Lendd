import { db } from '../dexie';
import { PaymentSchedule, PaymentScheduleSchema, LoanSchema, SyncQueueItem } from '../../types/domain';

export interface RecordPaymentInput {
  scheduleId: string;
  collectedAmount: number; // Actual cash collected
  notes?: string;
  paidAt?: string;
}

export class PaymentRepository {
  /**
   * Bulk insert generated schedules for a newly created loan.
   */
  async createSchedules(schedules: unknown[]): Promise<PaymentSchedule[]> {
    const validatedList = schedules.map((s) => PaymentScheduleSchema.parse(s));

    await db.transaction('rw', [db.schedules, db.syncQueue], async () => {
      await db.schedules.bulkAdd(validatedList);

      // Batched sync queue insertion for high performance
      const syncItems: SyncQueueItem[] = validatedList.map((item) => ({
        table: 'payment_schedule',
        recordId: item.id,
        action: 'INSERT',
        payload: item as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      }));

      await db.syncQueue.bulkAdd(syncItems);
    });

    return validatedList;
  }

  /**
   * Get all schedule milestones due on a specific date (YYYY-MM-DD).
   */
  async getSchedulesByDate(dueDate: string): Promise<PaymentSchedule[]> {
    return await db.schedules
      .where('dueDate')
      .equals(dueDate)
      .toArray();
  }

  /**
   * Get all schedule milestones for a specific loan sorted chronologically by due date.
   */
  async getSchedulesByLoan(loanId: string): Promise<PaymentSchedule[]> {
    return await db.schedules
      .where('loanId')
      .equals(loanId)
      .sortBy('dueDate');
  }

  /**
   * ATOMIC PAYMENT COLLECTION (Swiss Cheese Layer 3 & Hard Ceiling Block)
   * Records payment on a schedule milestone and adjusts the parent loan balance atomically.
   */
  async recordPayment(input: RecordPaymentInput): Promise<{
    updatedSchedule: PaymentSchedule;
    updatedOutstandingBalance: number;
  }> {
    const { scheduleId, collectedAmount, notes, paidAt = new Date().toISOString() } = input;

    // Guard Rail 1: Collected amount cannot be negative
    if (collectedAmount < 0) {
      throw new Error('Collected amount cannot be negative');
    }

    return await db.transaction('rw', [db.schedules, db.loans, db.syncQueue], async () => {
      // 1. Fetch Schedule Milestone
      const schedule = await db.schedules.get(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule milestone not found: ${scheduleId}`);
      }

      // 2. Fetch Parent Loan
      const loan = await db.loans.get(schedule.loanId);
      if (!loan) {
        throw new Error(`Parent loan not found for schedule: ${schedule.loanId}`);
      }

      // 3. Swiss Cheese Layer 3: Hard Ceiling Block
      // Calculate net difference if an amount was already recorded previously
      const previousAmountPaid = schedule.amountPaid || 0;
      const netPaymentDelta = collectedAmount - previousAmountPaid;

      if (netPaymentDelta > loan.outstandingBalance) {
        throw new Error(
          `Payment of ₹${collectedAmount.toLocaleString('en-IN')} exceeds total loan outstanding balance (₹${loan.outstandingBalance.toLocaleString('en-IN')})`
        );
      }

      // 4. Determine Payment Status
      let newStatus: 'paid' | 'partial' | 'missed' = 'paid';
      if (collectedAmount === 0) {
        newStatus = 'missed';
      } else if (collectedAmount < schedule.amountDue) {
        newStatus = 'partial';
      } else {
        newStatus = 'paid';
      }

      // 5. Update Schedule Milestone
      const updatedSchedule: PaymentSchedule = {
        ...schedule,
        amountPaid: collectedAmount,
        status: newStatus,
        paidAt: collectedAmount > 0 ? paidAt : undefined,
        notes: notes ?? schedule.notes,
        updatedAt: new Date().toISOString(),
      };

      PaymentScheduleSchema.parse(updatedSchedule);
      await db.schedules.put(updatedSchedule);

      // 6. Update Parent Loan Balance
      const newTotalCollected = loan.totalCollected + netPaymentDelta;
      const newOutstanding = loan.outstandingBalance - netPaymentDelta;
      const isLoanFullyPaid = newOutstanding === 0;

      const updatedLoan = {
        ...loan,
        totalCollected: newTotalCollected,
        outstandingBalance: newOutstanding,
        status: isLoanFullyPaid 
          ? ('completed' as const) 
          : (loan.status === 'completed' ? ('active' as const) : loan.status),
        lastCollectionDate: updatedSchedule.dueDate,
        updatedAt: new Date().toISOString(),
      };

      LoanSchema.parse(updatedLoan);
      await db.loans.put(updatedLoan);

      // 7. Atomic Sync Queue Records (Singular table name matching Supabase DDL)
      await db.syncQueue.add({
        table: 'payment_schedule',
        recordId: updatedSchedule.id,
        action: 'UPDATE',
        payload: updatedSchedule as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      await db.syncQueue.add({
        table: 'loans',
        recordId: updatedLoan.id,
        action: 'UPDATE',
        payload: updatedLoan as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      return {
        updatedSchedule,
        updatedOutstandingBalance: newOutstanding,
      };
    });
  }

  /**
   * ATOMIC RESET PAYMENT TO PENDING (UNDO / MISTAKE CORRECTION)
   * Resets a schedule milestone back to 'pending', clears amountPaid to 0,
   * and restores parent loan balance and totalCollected atomically.
   */
  async resetToPending(scheduleId: string): Promise<{
    updatedSchedule: PaymentSchedule;
    updatedOutstandingBalance: number;
  }> {
    return await db.transaction('rw', [db.schedules, db.loans, db.syncQueue], async () => {
      const schedule = await db.schedules.get(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule milestone not found: ${scheduleId}`);
      }

      const loan = await db.loans.get(schedule.loanId);
      if (!loan) {
        throw new Error(`Parent loan not found for schedule: ${schedule.loanId}`);
      }

      const previousAmountPaid = schedule.amountPaid || 0;

      // Revert parent loan balance and collected tally
      const newTotalCollected = Math.max(0, loan.totalCollected - previousAmountPaid);
      const newOutstanding = loan.outstandingBalance + previousAmountPaid;

      const updatedSchedule: PaymentSchedule = {
        ...schedule,
        amountPaid: 0,
        status: 'pending',
        paidAt: undefined,
        updatedAt: new Date().toISOString(),
      };

      PaymentScheduleSchema.parse(updatedSchedule);
      await db.schedules.put(updatedSchedule);

      const updatedLoan = {
        ...loan,
        totalCollected: newTotalCollected,
        outstandingBalance: newOutstanding,
        status: loan.status === 'completed' && newOutstanding > 0 ? ('active' as const) : loan.status,
        updatedAt: new Date().toISOString(),
      };

      LoanSchema.parse(updatedLoan);
      await db.loans.put(updatedLoan);

      await db.syncQueue.add({
        table: 'payment_schedule',
        recordId: updatedSchedule.id,
        action: 'UPDATE',
        payload: updatedSchedule as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      await db.syncQueue.add({
        table: 'loans',
        recordId: updatedLoan.id,
        action: 'UPDATE',
        payload: updatedLoan as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      return {
        updatedSchedule,
        updatedOutstandingBalance: newOutstanding,
      };
    });
  }
}

export const paymentRepo = new PaymentRepository();
