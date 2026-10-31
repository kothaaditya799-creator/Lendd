import { db } from '../dexie';
import { Borrower, BorrowerSchema, NewBorrowerInput } from '../../types/domain';

export class BorrowerRepository {
  /**
   * Add a new borrower with strict Zod validation, atomic duplicate prevention,
   * and atomic sync queuing.
   */
  async addBorrower(input: NewBorrowerInput): Promise<Borrower> {
    // 1. Strict Zod Schema Validation (Swiss Cheese Layer 2)
    const validated = BorrowerSchema.parse(input);

    // 2. Atomic Database Transaction with Race-Condition Protection
    await db.transaction('rw', [db.borrowers, db.syncQueue], async () => {
      // Check duplicate phone INSIDE the transaction block
      const existing = await db.borrowers
        .where('phone')
        .equals(validated.phone)
        .first();

      if (existing && existing.isActive) {
        throw new Error(
          `A borrower with phone ${validated.phone} already exists (${existing.name})`
        );
      }

      await db.borrowers.add(validated);
      await db.syncQueue.add({
        table: 'borrowers',
        recordId: validated.id,
        action: 'INSERT',
        payload: validated as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    });

    return validated;
  }

  /**
   * Update an existing borrower's details with atomic clash checking.
   */
  async updateBorrower(id: string, updates: Partial<Borrower>): Promise<Borrower> {
    return await db.transaction('rw', [db.borrowers, db.syncQueue], async () => {
      const existing = await db.borrowers.get(id);
      if (!existing) {
        throw new Error(`Borrower not found with ID: ${id}`);
      }

      // If phone is being changed, verify it doesn't clash with another active borrower
      if (updates.phone && updates.phone !== existing.phone) {
        const clash = await db.borrowers
          .where('phone')
          .equals(updates.phone)
          .first();

        if (clash && clash.id !== id && clash.isActive) {
          throw new Error(
            `Phone number ${updates.phone} is already registered to ${clash.name}`
          );
        }
      }

      const merged = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const validated = BorrowerSchema.parse(merged);

      await db.borrowers.put(validated);
      await db.syncQueue.add({
        table: 'borrowers',
        recordId: validated.id,
        action: 'UPDATE',
        payload: validated as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      return validated;
    });
  }

  /**
   * ATOMIC DELETE BORROWER (WITH ACTIVE DEBT SHIELD)
   * Strictly blocks deletion if the borrower has active loans with money outstanding.
   */
  async deleteBorrower(id: string): Promise<void> {
    // 1. Check for active loans with unpaid balance
    const activeLoans = await db.loans
      .where('borrowerId')
      .equals(id)
      .filter((l) => l.status === 'active' && l.outstandingBalance > 0)
      .toArray();

    if (activeLoans.length > 0) {
      const totalOwing = activeLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
      throw new Error(
        `Cannot delete borrower with active debt. This borrower owes ₹${totalOwing.toLocaleString('en-IN')}. Please close the active loans first.`
      );
    }

    // 2. Atomic soft-delete or cleanup
    await db.transaction('rw', [db.borrowers, db.loans, db.schedules, db.syncQueue], async () => {
      // Soft-delete by setting isActive to false (preserves ledger integrity)
      const existing = await db.borrowers.get(id);
      if (!existing) return;

      const deactivated: Borrower = {
        ...existing,
        isActive: false,
        updatedAt: new Date().toISOString(),
      };

      await db.borrowers.put(deactivated);
      await db.syncQueue.add({
        table: 'borrowers',
        recordId: id,
        action: 'UPDATE',
        payload: deactivated as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Get all borrowers (active and archived).
   */
  async getAllBorrowers(): Promise<Borrower[]> {
    return await db.borrowers.toArray();
  }

  /**
   * Get all active borrowers.
   */
  async getActiveBorrowers(): Promise<Borrower[]> {
    return await db.borrowers
      .filter((b) => b.isActive)
      .sortBy('name');
  }

  /**
   * Get borrower by primary key ID.
   */
  async getBorrowerById(id: string): Promise<Borrower | undefined> {
    return await db.borrowers.get(id);
  }

  /**
   * Search borrowers by name or 10-digit mobile number.
   */
  async searchBorrowers(query: string): Promise<Borrower[]> {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      return this.getActiveBorrowers();
    }

    return await db.borrowers
      .filter(
        (b) =>
          b.isActive &&
          (b.name.toLowerCase().includes(clean) || b.phone.includes(clean))
      )
      .toArray();
  }
}

export const borrowerRepo = new BorrowerRepository();
