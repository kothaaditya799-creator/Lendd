import { formatINR } from './currency.ts';
import { formatShortDate } from './dateUtils.ts';

export interface ReceiptData {
  borrowerName: string;
  borrowerPhone: string;
  collectedAmount: number;
  amountDue: number;
  dueDate: string;
  remainingLoanBalance: number;
  loanType: 'DF' | 'SP';
  notes?: string;
}

/**
 * Generate a clean, polite WhatsApp receipt message in Telugu or English.
 */
export function generateReceiptMessage(data: ReceiptData, isTe: boolean): string {
  const formattedDate = formatShortDate(data.dueDate, isTe);
  const formattedCollected = formatINR(data.collectedAmount);
  const formattedBalance = formatINR(data.remainingLoanBalance);

  if (isTe) {
    return (
`*🏦 లేండ్‌ట్రాక్ చెల్లింపు రసీదు*
--------------------------------
👤 *రుణగ్రహీత:* ${data.borrowerName}
📅 *తేదీ:* ${formattedDate}
💰 *వసూలైన మొత్తం:* ${formattedCollected}
📝 *వివరాలు:* ${data.notes || (data.loanType === 'DF' ? 'డైలీ ఫైనాన్స్ వాయిదా' : 'వడ్డీ చెల్లింపు')}
📉 *మిగిలిన బకాయి:* ${formattedBalance}
--------------------------------
✓ మీ చెల్లింపు విజయవంతంగా నమోదైంది. ధన్యవాదాలు!`
    );
  }

  return (
`*🏦 LendTrack Payment Receipt*
--------------------------------
👤 *Borrower:* ${data.borrowerName}
📅 *Date:* ${formattedDate}
💰 *Amount Collected:* ${formattedCollected}
📝 *Details:* ${data.notes || (data.loanType === 'DF' ? 'Installment payment' : 'Interest payment')}
📉 *Remaining Balance:* ${formattedBalance}
--------------------------------
✓ Payment recorded successfully. Thank you!`
  );
}

/**
 * Opens WhatsApp with the pre-filled receipt message.
 */
export function openWhatsAppReceipt(data: ReceiptData, isTe: boolean): void {
  const message = generateReceiptMessage(data, isTe);
  const cleanPhone = data.borrowerPhone.replace(/\D/g, '');
  // Format Indian phone with 91 prefix if 10 digits
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
