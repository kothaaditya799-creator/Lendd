import { db } from '../dexie';
import { PaymentSchedule, PaymentScheduleSchema } from '../../types/domain';

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
      for (const item of validatedList) {
        await db.syncQueue.add({
          table: 'payment_schedules',
          recordId: item.id,
          action: 'INSERT',
          payload: item as unknown as Record<string, unknown>,
          timestamp: Date.now(),
        });
      }
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
   * ATOMIC PAYMENT COLLECTION (Swiss Cheese Layer 3 & Checkpoint)
   * Records payment on a schedule milestone and adjusts the parent loan balance atomically.
   */
  async recordPayment(input: RecordPaymentInput): Promise<{
    updatedSchedule: PaymentSchedule;
    updatedOutstandingBalance: number;
  }> {
    const { scheduleId, collectedAmount, notes, paidAt = new Date().toISOString() } = input;

    // Guard Rail: Collected amount cannot be negative
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

      // 3. Determine Payment Status
      let newStatus: 'paid' | 'partial' | 'missed' = 'paid';
      if (collectedAmount === 0) {
        newStatus = 'missed';
      } else if (collectedAmount < schedule.amountDue) {
        newStatus = 'partial';
      } else {
        newStatus = 'paid';
      }

      // 4. Update Schedule Milestone
      const updatedSchedule: PaymentSchedule = {
        ...schedule,
        amountPaid: collectedAmount,
        status: newStatus,
        paidAt: collectedAmount > 0 ? paidAt : undefined,
        notes: notes ?? schedule.notes,
        updatedAt: new Date().toISOString(),
      };

      // Validate updated schedule with Zod
      PaymentScheduleSchema.parse(updatedSchedule);
      await db.schedules.put(updatedSchedule);

      // 5. Update Parent Loan Balance
      // Calculate net difference if an amount was already recorded previously
      const previousAmountPaid = schedule.amountPaid || 0;
      const netPaymentDelta = collectedAmount - previousAmountPaid;

      const newTotalCollected = loan.totalCollected + netPaymentDelta;
      const newOutstanding = Math.max(0, loan.outstandingBalance - netPaymentDelta);
      const isLoanFullyPaid = newOutstanding === 0;

      const updatedLoan = {
        ...loan,
        totalCollected: newTotalCollected,
        outstandingBalance: newOutstanding,
        status: isLoanFullyPaid ? ('completed' as const) : loan.status,
        lastCollectionDate: updatedSchedule.dueDate,
        updatedAt: new Date().toISOString(),
      };

      await db.loans.put(updatedLoan);

      // 6. Record to Sync Queue
      await db.syncQueue.add({
        table: 'payment_schedules',
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
