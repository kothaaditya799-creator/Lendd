import { z } from 'zod';

/* =========================================================================
   1. STRICT INPUT VALIDATION RULES (SWISS CHEESE LAYER 2)
   ========================================================================= */

// Indian Mobile Number: Exactly 10 digits starting with 6, 7, 8, or 9
export const IndianPhoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number starting with 6-9',
  });

// Optional Phone Number (either valid 10 digits or empty string/undefined)
export const OptionalIndianPhoneSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (val) => !val || /^[6-9]\d{9}$/.test(val),
    {
      message: 'Enter a valid 10-digit Indian mobile number or leave blank',
    }
  );

// Currency amounts: Strictly positive integer, no paise, max ₹50,00,000
export const CurrencyAmountSchema = z
  .number()
  .int('Amount cannot have decimals/paise')
  .positive('Amount must be greater than ₹0')
  .max(5000000, 'Amount cannot exceed ₹50,00,000');

// Date string in YYYY-MM-DD ISO format
export const ISODateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' });

// 4-Digit Numeric Security PIN
export const SecurityPinSchema = z
  .string()
  .regex(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' });

/* =========================================================================
   2. DOMAIN SCHEMAS & TYPES
   ========================================================================= */

// --- BORROWER ---
export const BorrowerSchema = z.object({
  id: z.string().uuid(),
  lenderId: z.string().default('local-lender'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  phone: IndianPhoneSchema,
  secondaryPhone: OptionalIndianPhoneSchema,
  guarantorName: z.string().trim().max(100).optional(),
  guarantorPhone: OptionalIndianPhoneSchema,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  trustScore: z.number().min(0).max(10).default(5.0),
  advanceBalance: z.number().int().min(0).default(0), // Pre-paid credit pool
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Borrower = z.infer<typeof BorrowerSchema>;
export type NewBorrowerInput = z.input<typeof BorrowerSchema>;

// --- LOAN ---
export const LoanTypeEnum = z.enum(['DF', 'SP']);
export type LoanType = z.infer<typeof LoanTypeEnum>;

export const CollectionFrequencyEnum = z.enum(['daily', 'weekly', 'monthly']);
export type CollectionFrequency = z.infer<typeof CollectionFrequencyEnum>;

export const LoanStatusEnum = z.enum(['active', 'completed', 'defaulted']);
export type LoanStatus = z.infer<typeof LoanStatusEnum>;

export const LoanSchema = z.object({
  id: z.string().uuid(),
  lenderId: z.string().default('local-lender'),
  borrowerId: z.string().uuid(),
  loanType: LoanTypeEnum,
  principalAmount: CurrencyAmountSchema,
  status: LoanStatusEnum.default('active'),
  startDate: ISODateStringSchema,
  endDate: ISODateStringSchema.optional(),
  skipSundays: z.boolean().default(false),

  // DF (Daily Finance) Specifics
  totalRepaymentAmount: CurrencyAmountSchema.optional(),
  collectionFrequency: CollectionFrequencyEnum.optional(),
  installmentAmount: z.number().int().positive().optional(),
  totalInstallments: z.number().int().positive().max(365).optional(),

  // SP (Special Interest) Specifics (Simple / Flat interest only)
  interestRateMonthly: z.number().min(0.1).max(100).optional(), // e.g. 2.0 = 2% per month
  interestFrequency: z.enum(['monthly', 'quarterly']).optional(),
  accumulatedUnpaidInterest: z.number().int().min(0).default(0),

  // Running Aggregates (Denormalized for instant UI rendering)
  totalCollected: z.number().int().min(0).default(0),
  outstandingBalance: z.number().int().min(0),
  lastCollectionDate: ISODateStringSchema.optional(),

  notes: z.string().trim().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Loan = z.infer<typeof LoanSchema>;

// --- PAYMENT SCHEDULE MILESTONE ---
export const PaymentStatusEnum = z.enum(['pending', 'paid', 'partial', 'missed']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const PaymentTypeEnum = z.enum(['installment', 'interest', 'principal']);
export type PaymentType = z.infer<typeof PaymentTypeEnum>;

export const PaymentScheduleSchema = z.object({
  id: z.string().uuid(),
  loanId: z.string().uuid(),
  lenderId: z.string().default('local-lender'),
  borrowerId: z.string().uuid(),
  dueDate: ISODateStringSchema,
  amountDue: z.number().int().positive(),
  amountPaid: z.number().int().min(0).default(0),
  paymentType: PaymentTypeEnum.default('installment'),
  status: PaymentStatusEnum.default('pending'),
  paidAt: z.string().optional(),
  notes: z.string().trim().max(300).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentSchedule = z.infer<typeof PaymentScheduleSchema>;

// --- OFFLINE SYNC QUEUE ITEM ---
export const SyncActionEnum = z.enum(['INSERT', 'UPDATE', 'DELETE']);
export type SyncAction = z.infer<typeof SyncActionEnum>;

export interface SyncQueueItem {
  id?: number; // Auto-incrementing primary key
  table: 'borrowers' | 'loans' | 'payment_schedule';
  recordId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  timestamp: number;
}
