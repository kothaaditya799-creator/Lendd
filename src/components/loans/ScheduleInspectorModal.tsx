import React, { useState } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingDown,
  Info,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import { PaymentSchedule, Loan } from '../../types/domain';
import { formatINR } from '../../utils/currency';
import { formatDisplayDate, isSunday } from '../../utils/dateUtils';
import { calculateEarlyPayoff } from '../../utils/loanCalculator';

interface ScheduleInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTe: boolean;
  title?: string;
  loanType: 'DF' | 'SP';
  frequency?: 'daily' | 'weekly' | 'monthly';
  schedules: PaymentSchedule[];
  principalAmount: number;
  totalAmount: number;
  startDate: string;
  endDate: string;
  skipSundays?: boolean;
  totalCalendarDays?: number;
  sundaysSkippedCount?: number;
  existingLoan?: Loan;
}

export const ScheduleInspectorModal: React.FC<ScheduleInspectorModalProps> = ({
  isOpen,
  onClose,
  isTe,
  title,
  loanType,
  frequency = 'daily',
  schedules,
  principalAmount,
  totalAmount,
  startDate,
  endDate,
  skipSundays = false,
  totalCalendarDays,
  sundaysSkippedCount = 0,
  existingLoan,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'settlement'>('schedule');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  if (!isOpen) return null;

  const displayTitle =
    title ||
    (isTe
      ? loanType === 'DF'
        ? frequency === 'weekly'
          ? 'వారపు ఫైనాన్స్ వాయిదాల షెడ్యూల్'
          : frequency === 'monthly'
          ? 'నెలవారీ ఫైనాన్స్ వాయిదాల షెడ్యూల్'
          : 'రోజువారీ ఫైనాన్స్ వాయిదాల షెడ్యూల్'
        : 'స్పెషల్ వడ్డీ చెల్లింపుల షెడ్యూల్'
      : loanType === 'DF'
      ? frequency === 'weekly'
        ? 'Weekly Finance Installment Schedule'
        : frequency === 'monthly'
        ? 'Monthly Finance Installment Schedule'
        : 'Daily Finance Installment Schedule'
      : 'Special Interest Milestone Schedule');

  // Early payoff figures if existing loan or simulated
  const simulatedLoan: Loan = existingLoan || {
    id: 'simulated-loan',
    lenderId: 'local-lender',
    borrowerId: 'borrower-preview',
    loanType,
    principalAmount,
    totalRepaymentAmount: totalAmount,
    status: 'active',
    startDate,
    endDate,
    skipSundays,
    accumulatedUnpaidInterest: 0,
    totalCollected: 0,
    outstandingBalance: totalAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const payoffResult = calculateEarlyPayoff(simulatedLoan, todayIso, discountPercent);

  // Status helper
  const getStatusBadge = (status: string, isTe: boolean) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={12} />
            {isTe ? 'పూర్తయింది' : 'Paid'}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={12} />
            {isTe ? 'కొంత భాగం' : 'Partial'}
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle size={12} />
            {isTe ? 'తప్పింది' : 'Missed'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Clock size={12} />
            {isTe ? 'బాకీ' : 'Pending'}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
        
        {/* Top Header */}
        <div className="bg-teal-900 text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="text-teal-300" size={24} />
            <div>
              <h3 className="font-bold text-lg leading-snug">{displayTitle}</h3>
              <p className="text-xs text-teal-200">
                {schedules.length}{' '}
                {isTe
                  ? frequency === 'weekly'
                    ? 'వారపు వాయిదాలు'
                    : frequency === 'monthly'
                    ? 'నెలవారీ వాయిదాలు'
                    : 'చెల్లింపు మైలురాళ్ళు'
                  : frequency === 'weekly'
                  ? 'Weekly Milestones'
                  : frequency === 'monthly'
                  ? 'Monthly Milestones'
                  : 'Milestones'}
                {frequency === 'daily' && skipSundays && ` • ${isTe ? 'ఆదివారాలు మినహాయించబడ్డాయి' : 'Sundays Skipped'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-teal-800/80 hover:bg-teal-700 text-teal-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Metric Summary Cards */}
        <div className="bg-teal-50/70 p-3.5 px-4 border-b border-teal-100 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white p-2 rounded-xl border border-teal-100 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              {isTe ? 'అసలు' : 'Principal'}
            </span>
            <span className="text-sm font-bold text-gray-900 block mt-0.5">
              {formatINR(principalAmount)}
            </span>
          </div>

          <div className="bg-white p-2 rounded-xl border border-teal-100 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              {isTe ? 'మొత్తం' : 'Total Return'}
            </span>
            <span className="text-sm font-bold text-teal-800 block mt-0.5">
              {formatINR(totalAmount)}
            </span>
          </div>

          <div className="bg-white p-2 rounded-xl border border-teal-100 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              {isTe ? 'వ్యవధి' : 'Duration'}
            </span>
            <span className="text-xs font-bold text-gray-900 block mt-0.5">
              {loanType === 'SP'
                ? `${schedules.length > 1 ? schedules.length - 1 : schedules.length} ${isTe ? 'నెలలు' : 'Months'}`
                : frequency === 'weekly'
                ? `${schedules.length} ${isTe ? 'వారాలు' : 'Weeks'}`
                : frequency === 'monthly'
                ? `${schedules.length} ${isTe ? 'నెలలు' : 'Months'}`
                : totalCalendarDays
                ? `${totalCalendarDays} ${isTe ? 'రోజులు' : 'Days'}`
                : `${schedules.length} ${isTe ? 'వాయిదాలు' : 'Installments'}`}
            </span>
          </div>
        </div>

        {/* Tabs: Schedule List vs Early Payoff Calculator */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-2.5 px-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'border-teal-700 text-teal-900 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Calendar size={16} />
            {isTe ? 'వాయిదాల వివరాలు' : 'Schedule List'}
          </button>
          <button
            onClick={() => setActiveTab('settlement')}
            className={`pb-2.5 px-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'settlement'
                ? 'border-teal-700 text-teal-900 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <TrendingDown size={16} />
            {isTe ? 'ముందస్తు క్లోజర్ లెక్క' : 'Early Payoff Calculator'}
          </button>
        </div>

        {/* Tab 1: Scrollable Schedule Milestone List */}
        {activeTab === 'schedule' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1 mb-1">
              <span>{isTe ? 'తేదీ / వాయిదా' : 'DATE / INSTALLMENT'}</span>
              <span>{isTe ? 'మొత్తం & స్థితి' : 'AMOUNT & STATUS'}</span>
            </div>

            {schedules.map((schedule, idx) => {
              const isSundayDate = isSunday(schedule.dueDate);
              const isPrincipalMaturity = schedule.paymentType === 'principal';
              // Only highlight Sunday warning if this is a DAILY frequency schedule
              const isDailySunday = frequency === 'daily' && isSundayDate;

              // Format milestone description in Telugu or English
              let milestoneDesc = schedule.notes || `${isTe ? 'వాయిదా' : 'Installment'} ${idx + 1}`;
              if (isTe) {
                if (schedule.notes?.startsWith('Week ')) {
                  milestoneDesc = `వారం ${idx + 1} వాయిదా (${idx + 1}/${schedules.length})`;
                } else if (schedule.notes?.startsWith('Month ')) {
                  milestoneDesc = `నెల ${idx + 1} వాయిదా (${idx + 1}/${schedules.length})`;
                } else if (schedule.notes?.startsWith('Installment ')) {
                  milestoneDesc = `వాయిదా ${idx + 1} (${idx + 1}/${schedules.length})`;
                }
              }

              return (
                <div
                  key={schedule.id || idx}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isPrincipalMaturity
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : isDailySunday
                      ? 'bg-red-50/60 border-red-200'
                      : idx % 2 === 0
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50/70 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isPrincipalMaturity
                          ? 'bg-amber-500 text-white'
                          : 'bg-teal-100 text-teal-900'
                      }`}
                    >
                      {isPrincipalMaturity ? '★' : idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gray-900">
                          {formatDisplayDate(schedule.dueDate, isTe)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 block">
                        {milestoneDesc}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-base font-extrabold text-teal-900">
                      {formatINR(schedule.amountDue)}
                    </span>
                    {getStatusBadge(schedule.status, isTe)}
                  </div>
                </div>
              );
            })}

            {frequency === 'daily' && sundaysSkippedCount > 0 && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Info size={16} className="text-amber-600 flex-shrink-0" />
                <span>
                  {isTe
                    ? `ఈ షెడ్యూల్‌లో మొత్తం ${sundaysSkippedCount} ఆదివారాలు స్వయంచాలకంగా మినహాయించబడ్డాయి.`
                    : `A total of ${sundaysSkippedCount} Sundays were automatically skipped in this schedule.`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Early Payoff Settlement Calculator */}
        {activeTab === 'settlement' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-teal-50 p-3.5 rounded-2xl border border-teal-200">
              <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2 mb-1">
                <ShieldCheck size={18} className="text-teal-700" />
                {isTe ? 'ముందస్తు రుణ పరిష్కార లెక్క' : 'Early Settlement / Pre-Closure Breakdown'}
              </h4>
              <p className="text-xs text-teal-800 leading-relaxed">
                {isTe
                  ? 'రుణగ్రహీత గడువు ముందే అప్పు పూర్తిగా చెల్లించాలనుకుంటే ఇవ్వాల్సిన లెక్క.'
                  : 'Instant payoff calculation if borrower requests to close this loan today.'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-gray-600">{isTe ? 'బకాయి అసలు మొత్తం' : 'Principal Due'}:</span>
                <span className="font-bold text-gray-900">{formatINR(payoffResult.principalDue)}</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-gray-600">{isTe ? 'వడ్డీ / చార్జీలు' : 'Interest / Charges'}:</span>
                <span className="font-bold text-gray-900">{formatINR(payoffResult.interestDue)}</span>
              </div>

              {/* Discount Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-gray-700 block">
                  {isTe ? 'లాయల్టీ / ముందస్తు రాయితీ (డిస్కౌంట్)' : 'Goodwill / Pre-closure Discount'}
                </label>
                <div className="flex items-center gap-2">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        discountPercent === pct
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span>{isTe ? 'రాయితీ మొత్తం' : 'Discount Savings'}:</span>
                  <span className="font-bold">- {formatINR(payoffResult.discountOffered)}</span>
                </div>
              )}

              <div className="pt-2 border-t flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">
                    {isTe ? 'చివరి పరిష్కార మొత్తం' : 'Final Settlement Amount'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {isTe ? 'ఈ రోజు చెల్లించవలసినది' : 'Payable Today'}
                  </span>
                </div>
                <span className="text-2xl font-black text-teal-800">
                  {formatINR(payoffResult.finalSettlementAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Footer */}
        <div className="p-4 bg-white border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[56px] py-3.5 px-4 rounded-2xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-bold text-base shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} />
            {isTe ? 'సరే / నిర్ధారించు' : 'Done / Close Preview'}
          </button>
        </div>

      </div>
    </div>
  );
};
