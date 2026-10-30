import Dexie, { Table } from 'dexie';
import {
  Borrower,
  Loan,
  PaymentSchedule,
  SyncQueueItem,
} from '../types/domain';

export class LendTrackDatabase extends Dexie {
  borrowers!: Table<Borrower, string>;
  loans!: Table<Loan, string>;
  schedules!: Table<PaymentSchedule, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('LendTrackLocalDB');

    // Define schema version 1
    // Keys listed are indexed for blazing-fast local queries (<2ms)
    this.version(1).stores({
      borrowers: 'id, lenderId, name, phone, isActive, trustScore, updatedAt',
      loans: 'id, lenderId, borrowerId, loanType, status, startDate, updatedAt',
      schedules: 'id, loanId, lenderId, borrowerId, dueDate, status, updatedAt',
      syncQueue: '++id, table, recordId, action, timestamp',
    });
  }

  /**
   * Helper: Clear all tables (used for testing or clean resets)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', [this.borrowers, this.loans, this.schedules, this.syncQueue], async () => {
      await this.borrowers.clear();
      await this.loans.clear();
      await this.schedules.clear();
      await this.syncQueue.clear();
    });
  }
}

// Global singleton instance for the app
export const db = new LendTrackDatabase();
