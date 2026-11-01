import React, { useState } from 'react';
import { X, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { formatINR } from '../../utils/currency';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTe: boolean;
  borrowerName: string;
  amountDue: number;
  loanOutstanding: number;
  initialAmount?: number;
  currentStatus?: 'pending' | 'paid' | 'partial' | 'missed';
  onConfirm: (amount: number, notes?: string) => Promise<void>;
  onResetToPending?: () => Promise<void>;
}

export const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({
  isOpen,
  onClose,
  isTe,
  borrowerName,
  amountDue,
  loanOutstanding,
  initialAmount = 0,
  currentStatus,
  onConfirm,
  onResetToPending,
}) => {
  const [amountStr, setAmountStr] = useState<string>(
    initialAmount > 0 ? initialAmount.toString() : ''
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const collectedAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
  const remainingDueOnSchedule = Math.max(0, amountDue - collectedAmount);

  // Quick chips: 25%, 50%, 75%, 100% of amountDue
  const quickChips = [
    { label: '25%', value: Math.round(amountDue * 0.25) },
    { label: '50%', value: Math.round(amountDue * 0.5) },
    { label: '75%', value: Math.round(amountDue * 0.75) },
    { label: '100%', value: amountDue },
  ].filter((c) => c.value > 0);

  const getModalTitle = () => {
    if (currentStatus === 'paid') {
      return isTe ? 'వసూలు మొత్తం సవరణ' : 'Edit Collected Payment';
    }
    if (currentStatus === 'partial') {
      return isTe ? 'పాక్షిక వసూలు సవరణ' : 'Edit Partial Payment';
    }
    if (currentStatus === 'missed') {
      return isTe ? 'వసూలు నమోదు (వాయిదా తప్పినది)' : 'Record Collection (Was Missed)';
    }
    return isTe ? 'కొంత భాగం వసూలు నమోదు' : 'Record Partial Payment';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (collectedAmount <= 0) {
      setError(
        isTe
          ? 'దయచేసి ₹1 కంటే ఎక్కువ మొత్తం నమోదు చేయండి'
          : 'Please enter an amount greater than ₹0'
      );
      return;
    }

    const maxAllowedAmount = loanOutstanding + initialAmount;
    if (collectedAmount > maxAllowedAmount) {
      setError(
        isTe
          ? `మొత్తం మిగిలిన అప్పు (${formatINR(maxAllowedAmount)}) కంటే ఎక్కువ ఉండకూడదు`
          : `Amount cannot exceed total loan outstanding balance (${formatINR(maxAllowedAmount)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(collectedAmount, notes.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-teal-900 text-white p-4 px-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg leading-snug">
              {getModalTitle()}
            </h3>
            <p className="text-xs text-teal-200 mt-0.5">
              👤 {borrowerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-800/80 hover:bg-teal-700 text-teal-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Due Info Cards */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-semibold block">
                {isTe ? 'ఈ వాయిదా బాకీ' : 'Installment Due'}
              </span>
              <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                {formatINR(amountDue)}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-semibold block">
                {isTe ? 'మొత్తం లోన్ బాకీ' : 'Loan Outstanding'}
              </span>
              <span className="text-base font-extrabold text-teal-900 mt-0.5 block">
                {formatINR(loanOutstanding + initialAmount)}
              </span>
            </div>
          </div>

          {/* Cash Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {isTe ? 'వసూలైన నగదు మొత్తం (రూపాయల్లో) *' : 'Cash Collected Amount (Rupees) *'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                ₹
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="e.g. 50"
                className="w-full min-h-[56px] pl-10 pr-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-2xl font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-all"
              />
            </div>
          </div>

          {/* Quick Percentage Chips */}
          {quickChips.length > 0 && (
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                {isTe ? 'శీఘ్ర ఎంపికలు:' : 'Quick Select:'}
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {quickChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setAmountStr(chip.value.toString())}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all ${
                      collectedAmount === chip.value
                        ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {chip.label} ({formatINR(chip.value)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Remaining Balance Calculation */}
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs flex justify-between items-center text-amber-900 font-bold">
            <span>{isTe ? 'వాయిదాలో ఇంకా చెల్లించాల్సింది:' : 'Remaining installment deficit:'}</span>
            <span className="text-sm font-black text-amber-950">
              {formatINR(remainingDueOnSchedule)}
            </span>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {isTe ? 'గమనిక (ఐచ్ఛికం - ఉదా. రేపు మిగిలినది ఇస్తానన్నారు):' : 'Note (Optional - e.g. Promised balance tomorrow):'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isTe ? 'వివరణ రాయండి...' : 'Add a quick note...'}
              className="w-full min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {/* Submit Button (56px) */}
          <button
            type="submit"
            disabled={isSubmitting || collectedAmount <= 0}
            className="w-full min-h-[56px] rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-bold text-base shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <span>{isTe ? 'నమోదు చేస్తోంది...' : 'Recording...'}</span>
            ) : (
              <>
                <Check size={20} />
                <span>
                  {currentStatus && currentStatus !== 'pending'
                    ? (isTe
                        ? `✓ ₹${collectedAmount.toLocaleString('en-IN')} మార్పులను భద్రపరచండి`
                        : `✓ Update ₹${collectedAmount.toLocaleString('en-IN')} Collection`)
                    : (isTe
                        ? `✓ ₹${collectedAmount.toLocaleString('en-IN')} వసూలు నిర్ధారించండి`
                        : `✓ Confirm ₹${collectedAmount.toLocaleString('en-IN')} Collection`)}
                </span>
              </>
            )}
          </button>

          {/* Reset to Pending / Mistake Correction Button */}
          {onResetToPending && currentStatus && currentStatus !== 'pending' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await onResetToPending();
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to reset milestone');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full min-h-[52px] rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-sm transition-all flex items-center justify-center space-x-2 active:scale-95"
            >
              <RotateCcw size={16} />
              <span>
                {isTe
                  ? 'బాకీగా రీసెట్ చేయి (Reset to Pending Queue)'
                  : 'Undo & Reset to Pending Queue'}
              </span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

