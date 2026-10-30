import { db } from '../dexie';
import { Borrower, BorrowerSchema, NewBorrowerInput } from '../../types/domain';

export class BorrowerRepository {
  /**
   * Add a new borrower with strict Zod validation and atomic sync queuing.
   */
  async addBorrower(input: NewBorrowerInput): Promise<Borrower> {
    // 1. Strict Zod Schema Validation (Swiss Cheese Layer 2)
    const validated = BorrowerSchema.parse(input);

    // 2. Duplicate Phone Guard Rail: check if phone already exists
    const existing = await db.borrowers.where('phone').equals(validated.phone).first();
    if (existing && existing.isActive) {
      throw new Error(`A borrower with phone ${validated.phone} already exists (${existing.name})`);
    }

    // 3. Atomic Database Transaction (All-or-Nothing)
    await db.transaction('rw', [db.borrowers, db.syncQueue], async () => {
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
   * Update an existing borrower's details.
   */
  async updateBorrower(id: string, updates: Partial<Borrower>): Promise<Borrower> {
    const existing = await db.borrowers.get(id);
    if (!existing) {
      throw new Error(`Borrower not found with ID: ${id}`);
    }

    const merged = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const validated = BorrowerSchema.parse(merged);

    await db.transaction('rw', [db.borrowers, db.syncQueue], async () => {
      await db.borrowers.put(validated);
      await db.syncQueue.add({
        table: 'borrowers',
        recordId: validated.id,
        action: 'UPDATE',
        payload: validated as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    });

    return validated;
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
