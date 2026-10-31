import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { loanRepo } from '../db/repositories/loanRepo';
import { paymentRepo } from '../db/repositories/paymentRepo';
import { Borrower, PaymentSchedule } from '../types/domain';
import { generateDFSchedule, generateSPSchedule, formatDateToISO } from '../utils/loanCalculator';
import { generateUUID } from '../utils/uuid';
import { ScheduleInspectorModal } from '../components/loans/ScheduleInspectorModal';

interface NewLoanPageProps {
  language: 'en' | 'te';
  preSelectedBorrowerId?: string;
  onSuccess?: () => void;
}

export const NewLoanPage: React.FC<NewLoanPageProps> = ({
  language,
  preSelectedBorrowerId,
  onSuccess,
}) => {
  const isTe = language === 'te';

  // Borrowers list for selection
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>(preSelectedBorrowerId || '');

  // Loan Configuration
  const [loanType, setLoanType] = useState<'DF' | 'SP'>('DF');
  const [principal, setPrincipal] = useState<number>(10000);
  const [customPrincipal, setCustomPrincipal] = useState<string>('');
  
  // DF Specifics
  const [totalRepayment, setTotalRepayment] = useState<number>(12000);
  const [installments, setInstallments] = useState<number>(100);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [skipSundays, setSkipSundays] = useState<boolean>(true);

  // SP Specifics
  const [monthlyInterestRate, setMonthlyInterestRate] = useState<number>(2.0); // 2% per month
  const [interestCycles, setInterestCycles] = useState<number>(12); // 12 months

  const [startDate] = useState<string>(formatDateToISO(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Schedule Inspector / Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSchedules, setPreviewSchedules] = useState<PaymentSchedule[]>([]);
  const [previewEndDate, setPreviewEndDate] = useState<string>('');
  const [previewDaysCount, setPreviewDaysCount] = useState<number>(0);
  const [previewSundaysSkipped, setPreviewSundaysSkipped] = useState<number>(0);

  const handleOpenPreview = () => {
    if (loanType === 'DF') {
      const res = generateDFSchedule({
        loanId: 'preview-loan',
        borrowerId: selectedBorrowerId || 'preview-borrower',
        totalRepayment,
        installments,
        frequency,
        startDateStr: startDate,
        skipSundays,
      });
      setPreviewSchedules(res.schedules);
      setPreviewEndDate(res.endDate);
      setPreviewDaysCount(res.totalCalendarDays);
      setPreviewSundaysSkipped(res.sundaysSkippedCount);
    } else {
      const res = generateSPSchedule({
        loanId: 'preview-loan',
        borrowerId: selectedBorrowerId || 'preview-borrower',
        principal,
        monthlyInterestRate,
        frequency: 'monthly',
        cycles: interestCycles,
        startDateStr: startDate,
      });
      setPreviewSchedules(res.schedules);
      setPreviewEndDate(res.endDate);
      setPreviewDaysCount(interestCycles * 30);
      setPreviewSundaysSkipped(0);
    }
    setIsPreviewOpen(true);
  };

  // Load borrowers on mount
  useEffect(() => {
    borrowerRepo.getActiveBorrowers().then((list) => {
      setBorrowers(list);
      if (!selectedBorrowerId && list.length > 0) {
        setSelectedBorrowerId(list[0].id);
      }
    });
  }, []);

  // Sync custom principal input
  const handleSelectChip = (amount: number) => {
    setPrincipal(amount);
    setCustomPrincipal('');
    if (loanType === 'DF') {
      // 20% standard markup default: e.g. 10k -> 12k, 20k -> 24k
      setTotalRepayment(Math.round(amount * 1.2));
    }
  };

  const handleCustomPrincipalChange = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setCustomPrincipal(val);
    if (num > 0) {
      setPrincipal(num);
      if (loanType === 'DF') {
        setTotalRepayment(Math.round(num * 1.2));
      }
    }
  };

  // Calculate live breakdown
  const dailyInstallment =
    loanType === 'DF' && installments > 0 ? Math.round(totalRepayment / installments) : 0;

  const monthlyInterestAmount =
    loanType === 'SP' ? Math.round(principal * (monthlyInterestRate / 100)) : 0;

  // Submit and Create Loan
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedBorrowerId) {
      setErrorMessage(isTe ? 'దయచేసి రుణగ్రహీతను ఎంచుకోండి.' : 'Please select a borrower.');
      return;
    }

    if (principal <= 0) {
      setErrorMessage(isTe ? 'అసలు మొత్తం ₹1 కంటే ఎక్కువ ఉండాలి.' : 'Principal amount must be greater than ₹0.');
      return;
    }

    if (loanType === 'DF' && totalRepayment < principal) {
      setErrorMessage(
        isTe
          ? 'మొత్తం తిరిగి చెల్లించే మొత్తం అసలు కంటే తక్కువ ఉండకూడదు.'
          : 'Total repayment amount cannot be less than principal.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const loanId = generateUUID();

      if (loanType === 'DF') {
        // 1. Generate DF Schedules
        const { schedules, installmentAmount, endDate } = generateDFSchedule({
          loanId,
          borrowerId: selectedBorrowerId,
          totalRepayment,
          installments,
          frequency,
          startDateStr: startDate,
          skipSundays,
        });

        // 2. Save Loan Record to Dexie
        await loanRepo.createLoan({
          id: loanId,
          lenderId: 'local-lender',
          borrowerId: selectedBorrowerId,
          loanType: 'DF',
          principalAmount: principal,
          totalRepaymentAmount: totalRepayment,
          collectionFrequency: frequency,
          installmentAmount,
          totalInstallments: installments,
          status: 'active',
          startDate,
          endDate,
          skipSundays,
          totalCollected: 0,
          outstandingBalance: totalRepayment,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // 3. Save All Generated Installments to Dexie
        await paymentRepo.createSchedules(schedules);
      } else {
        // 1. Generate SP Schedules
        const { schedules, endDate } = generateSPSchedule({
          loanId,
          borrowerId: selectedBorrowerId,
          principal,
          monthlyInterestRate,
          frequency: 'monthly',
          cycles: interestCycles,
          startDateStr: startDate,
        });

        // 2. Save Loan Record to Dexie
        await loanRepo.createLoan({
          id: loanId,
          lenderId: 'local-lender',
          borrowerId: selectedBorrowerId,
          loanType: 'SP',
          principalAmount: principal,
          interestRateMonthly: monthlyInterestRate,
          interestFrequency: 'monthly',
          status: 'active',
          startDate,
          endDate,
          totalCollected: 0,
          outstandingBalance: principal,
          accumulatedUnpaidInterest: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // 3. Save Schedules
        await paymentRepo.createSchedules(schedules);
      }

      setSuccessMessage(
        isTe ? '✓ రుణం విజయవంతంగా సృష్టించబడింది!' : '✓ Loan created successfully with payment schedule!'
      );

      // Trigger success callback after 1.5s
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId);

  return (
    <div className="p-4 space-y-4">
      {/* Page Title */}
      <div className="flex items-center space-x-2">
        <PlusCircle className="h-6 w-6 text-brand-700" />
        <h2 className="text-xl font-bold text-slate-800">
          {isTe ? 'కొత్త రుణం ఇవ్వండి' : 'Create New Loan'}
        </h2>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-200 flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 border border-red-200">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleCreateLoan} className="space-y-4">
        {/* Step 1: Select Borrower */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2">
          <label className="block text-sm font-bold uppercase tracking-wider text-slate-700">
            {isTe ? '1. రుణగ్రహీతను ఎంచుకోండి *' : '1. Select Borrower *'}
          </label>

          {borrowers.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              {isTe
                ? 'రుణగ్రహీతలు ఎవరూ లేరు. ముందుగా "రుణగ్రహీతలు" ట్యాబ్‌లో ఒకరిని జోడించండి.'
                : 'No borrowers found. Please add a borrower first in the Borrowers tab.'}
            </p>
          ) : (
            <select
              value={selectedBorrowerId}
              onChange={(e) => setSelectedBorrowerId(e.target.value)}
              className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (+91 {b.phone})
                </option>
              ))}
            </select>
          )}

          {selectedBorrower && (
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {isTe ? 'ఎంచుకున్న వ్యక్తి: ' : 'Selected: '}
              <span className="text-brand-800 font-bold">{selectedBorrower.name}</span> (★ {selectedBorrower.trustScore.toFixed(1)})
            </p>
          )}
        </div>

        {/* Step 2: Choose Model (DF vs SP) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2">
          <label className="block text-sm font-bold uppercase tracking-wider text-slate-700">
            {isTe ? '2. రుణ మోడల్ ఎంచుకోండి *' : '2. Loan Type *'}
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setLoanType('DF');
                setTotalRepayment(Math.round(principal * 1.2));
              }}
              className={`min-h-[56px] rounded-2xl font-bold text-sm flex flex-col items-center justify-center border-2 transition-all active:scale-95 ${
                loanType === 'DF'
                  ? 'border-brand-700 bg-brand-50 text-brand-900 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span>{isTe ? 'డైలీ ఫైనాన్స్ (DF)' : 'Daily Finance (DF)'}</span>
              <span className="text-[11px] font-normal text-slate-500">
                {isTe ? 'రోజువారీ వసూలు' : 'Fixed Installment'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLoanType('SP')}
              className={`min-h-[56px] rounded-2xl font-bold text-sm flex flex-col items-center justify-center border-2 transition-all active:scale-95 ${
                loanType === 'SP'
                  ? 'border-brand-700 bg-brand-50 text-brand-900 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span>{isTe ? 'స్పెషల్ వడ్డీ (SP)' : 'Special Interest (SP)'}</span>
              <span className="text-[11px] font-normal text-slate-500">
                {isTe ? 'నెలకు వడ్డీ' : 'Monthly Interest'}
              </span>
            </button>
          </div>
        </div>

        {/* Step 3: Amount Selection with 56px Chips */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-700">
              {isTe ? '3. అసలు మొత్తం ఎంచుకోండి *' : '3. Principal Amount *'}
            </label>
            <span className="text-xl font-extrabold text-brand-800">
              ₹{principal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Quick-Select Chips (56px) */}
          <div className="grid grid-cols-2 gap-2.5">
            {[10000, 20000, 50000, 100000].map((amount) => {
              const isSelected = principal === amount && !customPrincipal;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleSelectChip(amount)}
                  className={`min-h-[56px] rounded-2xl text-lg font-bold border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-brand-700 bg-brand-700 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-brand-300'
                  }`}
                >
                  ₹{amount.toLocaleString('en-IN')}
                </button>
              );
            })}
          </div>

          {/* Custom Amount Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {isTe ? 'లేదా ఇతర మొత్తం నమోదు చేయండి' : 'Or enter custom amount:'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                ₹
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={customPrincipal}
                onChange={(e) => handleCustomPrincipalChange(e.target.value)}
                placeholder="e.g. 35000"
                className="w-full min-h-[56px] pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Step 4: Terms Breakdown (DF vs SP) */}
        {loanType === 'DF' ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {isTe ? '4. తిరిగి చెల్లింపు నిబంధనలు' : '4. Repayment Terms'}
            </h4>

            {/* Total Repayment */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {isTe ? 'మొత్తం తిరిగి చెల్లించే మొత్తం (రావలసింది)' : 'Total Repayment Amount:'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={totalRepayment}
                  onChange={(e) => setTotalRepayment(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                  className="w-full min-h-[56px] pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Collection Frequency (Daily / Weekly / Monthly) */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {isTe ? 'వసూలు వ్యవధి' : 'Collection Frequency:'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className={`min-h-[44px] rounded-xl text-xs font-bold capitalize transition-all ${
                      frequency === freq
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isTe
                      ? freq === 'daily'
                        ? 'రోజువారీ'
                        : freq === 'weekly'
                        ? 'వారపు'
                        : 'నెలవారీ'
                      : freq}
                  </button>
                ))}
              </div>
            </div>

            {/* Installments count & Skip Sundays Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isTe ? 'రోజుల సంఖ్య (వాయిదాలు)' : 'Installments (Days):'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={installments}
                  onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Sunday Toggle */}
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setSkipSundays(!skipSundays)}
                  className={`min-h-[56px] px-3 rounded-2xl border-2 text-xs font-bold flex items-center justify-center space-x-1 transition-all ${
                    skipSundays
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{isTe ? (skipSundays ? 'ఆదివారం సెలవు ✓' : 'ప్రతిరోజూ') : (skipSundays ? 'Skip Sundays ✓' : 'Every Day')}</span>
                </button>
              </div>
            </div>

            {/* Calculated Breakdown Box */}
            <div className="rounded-2xl bg-brand-50 p-4 border border-brand-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-800">
                  {isTe ? 'రోజువారీ వసూలు' : 'Daily Collection'}
                </p>
                <p className="text-2xl font-black text-brand-950 mt-0.5">
                  ₹{dailyInstallment.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-brand-700">/ రోజుకి</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-brand-800">
                  {installments} {isTe ? 'రోజులు' : 'days'}
                </p>
                <p className="text-xs font-bold text-brand-900 mt-1">
                  {isTe ? 'లాభం: ' : 'Profit: '}₹{(totalRepayment - principal).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* SP (Special Interest) Terms */
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {isTe ? '4. వడ్డీ నిబంధనలు (సాధారణ వడ్డీ)' : '4. Interest Terms (Simple)'}
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isTe ? 'నెలవారీ వడ్డీ రేటు (%)' : 'Monthly Rate (%):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={monthlyInterestRate}
                    onChange={(e) => setMonthlyInterestRate(parseFloat(e.target.value) || 0)}
                    className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isTe ? 'నెలల వ్యవధి' : 'Duration (Months):'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={interestCycles}
                  onChange={(e) => setInterestCycles(parseInt(e.target.value, 10) || 1)}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Calculated SP Box */}
            <div className="rounded-2xl bg-brand-50 p-4 border border-brand-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-800">
                  {isTe ? 'నెలవారీ వడ్డీ' : 'Monthly Interest'}
                </p>
                <p className="text-2xl font-black text-brand-950 mt-0.5">
                  ₹{monthlyInterestAmount.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-brand-700">/ నెలకు</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-brand-800">
                  {monthlyInterestRate}% {isTe ? 'నెలకు' : '/ month'}
                </p>
                <p className="text-xs font-bold text-brand-900 mt-1">
                  {isTe ? 'అసలు ముగింపులో' : 'Principal at end'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Milestone Schedule Inspector Trigger Button (56px) */}
        <button
          type="button"
          onClick={handleOpenPreview}
          className="w-full min-h-[56px] rounded-2xl bg-teal-50 hover:bg-teal-100 active:bg-teal-200 border-2 border-teal-600 text-teal-900 font-bold text-base shadow-sm transition-all flex items-center justify-center space-x-2"
        >
          <Eye className="h-5 w-5 text-teal-700" />
          <span>
            {isTe
              ? `వాయిదాల షెడ్యూల్ పరిశీలించండి (${loanType === 'DF' ? `${installments} రోజులు` : `${interestCycles} నెలలు`})`
              : `Inspect Schedule (${loanType === 'DF' ? `${installments} Days` : `${interestCycles} Months`})`}
          </span>
        </button>

        {/* Submit Button (56px) */}
        <button
          type="submit"
          disabled={isSubmitting || borrowers.length === 0}
          className="w-full min-h-[56px] rounded-2xl bg-brand-700 hover:bg-brand-800 disabled:bg-slate-300 text-white font-bold text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <span>{isTe ? 'రుణం సృష్టిస్తోంది...' : 'Creating Loan...'}</span>
          ) : (
            <>
              <span>{isTe ? '✓ రుణం మంజూరు చేయండి (Confirm Loan)' : '✓ Confirm & Create Loan'}</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>

      {/* Schedule Inspector Modal */}
      <ScheduleInspectorModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        isTe={isTe}
        loanType={loanType}
        schedules={previewSchedules}
        principalAmount={principal}
        totalAmount={loanType === 'DF' ? totalRepayment : principal}
        startDate={startDate}
        endDate={previewEndDate}
        skipSundays={loanType === 'DF' && skipSundays}
        totalCalendarDays={previewDaysCount}
        sundaysSkippedCount={previewSundaysSkipped}
      />
    </div>
  );
};
