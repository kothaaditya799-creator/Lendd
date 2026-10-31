import { db } from '../dexie';
import { Loan, LoanSchema } from '../../types/domain';

export class LoanRepository {
  /**
   * Create a new loan with strict validation and atomic sync queuing.
   */
  async createLoan(loanInput: unknown): Promise<Loan> {
    const validated = LoanSchema.parse(loanInput);

    // Verify the referenced borrower actually exists locally
    const borrower = await db.borrowers.get(validated.borrowerId);
    if (!borrower) {
      throw new Error(`Referenced Borrower does not exist: ${validated.borrowerId}`);
    }

    await db.transaction('rw', [db.loans, db.syncQueue], async () => {
      await db.loans.add(validated);
      await db.syncQueue.add({
        table: 'loans',
        recordId: validated.id,
        action: 'INSERT',
        payload: validated as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    });

    return validated;
  }

  /**
   * Get all active loans across all borrowers.
   */
  async getActiveLoans(): Promise<Loan[]> {
    return await db.loans
      .filter((loan) => loan.status === 'active')
      .sortBy('startDate');
  }

  /**
   * Get all loans (active or completed) for a specific borrower.
   */
  async getLoansByBorrower(borrowerId: string): Promise<Loan[]> {
    return await db.loans
      .where('borrowerId')
      .equals(borrowerId)
      .toArray();
  }

  /**
   * Get all loans across all borrowers, sorted descending by start date (most recent first).
   */
  async getAllLoansSortedByRecent(): Promise<Loan[]> {
    const list = await db.loans.toArray();
    return list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }

  /**
   * Get loan by primary key ID.
   */
  async getLoanById(id: string): Promise<Loan | undefined> {
    return await db.loans.get(id);
  }
}

export const loanRepo = new LoanRepository();

