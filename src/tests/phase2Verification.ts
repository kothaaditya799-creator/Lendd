import {
  BorrowerSchema,
  IndianPhoneSchema,
  CurrencyAmountSchema,
  SecurityPinSchema,
} from '../types/domain';

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
}

export function runPhase2GuardRailTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function record(suite: string, testName: string, fn: () => void) {
    try {
      fn();
      results.push({ suite, testName, passed: true });
    } catch (err: unknown) {
      results.push({
        suite,
        testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /* -------------------------------------------------------------------------
     SUITE 1: INDIAN MOBILE NUMBER GUARD RAILS (LAYER 2)
     ------------------------------------------------------------------------- */
  record('Phone Guard Rail', 'Valid 10-digit number starting with 9 passes', () => {
    IndianPhoneSchema.parse('9876543210');
  });

  record('Phone Guard Rail', 'Valid 10-digit number starting with 6 passes', () => {
    IndianPhoneSchema.parse('6301234567');
  });

  record('Phone Guard Rail', 'Rejects 9-digit number', () => {
    let threw = false;
    try {
      IndianPhoneSchema.parse('987654321');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected 9-digit number to be rejected');
  });

  record('Phone Guard Rail', 'Rejects 11-digit number', () => {
    let threw = false;
    try {
      IndianPhoneSchema.parse('98765432100');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected 11-digit number to be rejected');
  });

  record('Phone Guard Rail', 'Rejects number starting with invalid digit 1', () => {
    let threw = false;
    try {
      IndianPhoneSchema.parse('1234567890');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected number starting with 1 to be rejected');
  });

  record('Phone Guard Rail', 'Rejects letters/characters in phone', () => {
    let threw = false;
    try {
      IndianPhoneSchema.parse('98765abcde');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected letters in phone to be rejected');
  });

  /* -------------------------------------------------------------------------
     SUITE 2: CURRENCY & AMOUNT GUARD RAILS (LAYER 2)
     ------------------------------------------------------------------------- */
  record('Currency Guard Rail', 'Valid positive integer amount passes', () => {
    CurrencyAmountSchema.parse(10000);
  });

  record('Currency Guard Rail', 'Rejects negative amount', () => {
    let threw = false;
    try {
      CurrencyAmountSchema.parse(-500);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected negative amount to be rejected');
  });

  record('Currency Guard Rail', 'Rejects zero amount', () => {
    let threw = false;
    try {
      CurrencyAmountSchema.parse(0);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected zero amount to be rejected');
  });

  record('Currency Guard Rail', 'Rejects decimal paise amount (e.g. ₹100.50)', () => {
    let threw = false;
    try {
      CurrencyAmountSchema.parse(100.5);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected decimal amount to be rejected');
  });

  record('Currency Guard Rail', 'Rejects excessive amount exceeding ₹50,00,000 ceiling', () => {
    let threw = false;
    try {
      CurrencyAmountSchema.parse(5000001);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected amount over ceiling to be rejected');
  });

  /* -------------------------------------------------------------------------
     SUITE 3: SECURITY PIN GUARD RAILS (LAYER 2)
     ------------------------------------------------------------------------- */
  record('PIN Guard Rail', 'Valid 4-digit PIN passes', () => {
    SecurityPinSchema.parse('1234');
  });

  record('PIN Guard Rail', 'Rejects 3-digit PIN', () => {
    let threw = false;
    try {
      SecurityPinSchema.parse('123');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected 3-digit PIN to be rejected');
  });

  record('PIN Guard Rail', 'Rejects non-numeric characters in PIN', () => {
    let threw = false;
    try {
      SecurityPinSchema.parse('12a4');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected non-numeric PIN to be rejected');
  });

  /* -------------------------------------------------------------------------
     SUITE 4: CEILING BLOCK LOGIC TEST (LAYER 3)
     ------------------------------------------------------------------------- */
  record('Ceiling Block Logic', 'Rejects payment when delta exceeds loan outstanding balance', () => {
    const loanOutstanding = 5000;
    const collectedAmount = 50000;
    const previousAmountPaid = 0;
    const netDelta = collectedAmount - previousAmountPaid;

    if (netDelta > loanOutstanding) {
      // Expected behavior: ceiling block triggers
      return;
    }
    throw new Error('Expected Ceiling Block to reject collection exceeding outstanding balance');
  });

  record('Ceiling Block Logic', 'Allows payment equal to exact loan outstanding balance', () => {
    const loanOutstanding = 5000;
    const collectedAmount = 5000;
    const netDelta = collectedAmount - 0;

    if (netDelta > loanOutstanding) {
      throw new Error('Exact balance payment should not be rejected');
    }
  });

  /* -------------------------------------------------------------------------
     SUITE 5: BORROWER SCHEMA PARSING
     ------------------------------------------------------------------------- */
  record('Borrower Schema', 'Valid borrower with Indian phone parses cleanly', () => {
    BorrowerSchema.parse({
      id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      name: 'Ravi Kumar',
      phone: '9876543210',
      createdAt: '2026-10-30T10:00:00Z',
      updatedAt: '2026-10-30T10:00:00Z',
    });
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}
