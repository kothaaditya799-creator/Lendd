import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Search,
  Check,
  TrendingUp,
} from 'lucide-react';
import { paymentRepo } from '../db/repositories/paymentRepo';
import { loanRepo } from '../db/repositories/loanRepo';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { Borrower, Loan, PaymentSchedule } from '../types/domain';
import { formatDateToISO, addDays, formatDisplayDate, getWeekdayName } from '../utils/dateUtils';
import { formatINR } from '../utils/currency';
import { PartialPaymentModal } from '../components/collections/PartialPaymentModal';
import { openWhatsAppReceipt } from '../utils/receiptGenerator';
import { Toast } from '../components/common/Toast';

interface CollectionsPageProps {
  language: 'en' | 'te';
}

interface CollectionItem {
  schedule: PaymentSchedule;
  loan: Loan;
  borrower: Borrower;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({ language }) => {
  const isTe = language === 'te';

  // Active Date Filter (defaults to today)
  const todayIso = useMemo(() => formatDateToISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // Data State
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'partial' | 'missed'>('all');

  // Partial Payment Modal State
  const [modalItem, setModalItem] = useState<CollectionItem | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch Collections for the selected date
  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const schedules = await paymentRepo.getSchedulesByDate(selectedDate);
      
      // Batch fetch related loans and borrowers
      const loadedItems: CollectionItem[] = [];
      const loanCache = new Map<string, Loan>();
      const borrowerCache = new Map<string, Borrower>();

      for (const schedule of schedules) {
        let loan = loanCache.get(schedule.loanId);
        if (!loan) {
          const l = await loanRepo.getLoanById(schedule.loanId);
          if (l) {
            loan = l;
            loanCache.set(schedule.loanId, l);
          }
        }

        let borrower = borrowerCache.get(schedule.borrowerId);
        if (!borrower) {
          const b = await borrowerRepo.getBorrowerById(schedule.borrowerId);
          if (b) {
            borrower = b;
            borrowerCache.set(schedule.borrowerId, b);
          }
        }

        if (loan && borrower) {
          loadedItems.push({
            schedule,
            loan,
            borrower,
          });
        }
      }

      setItems(loadedItems);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Date Navigation Handlers
  const handlePrevDay = () => setSelectedDate((prev) => addDays(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const handleToday = () => setSelectedDate(todayIso);

  // 1-Tap Full Payment
  const handleMarkFullPaid = async (item: CollectionItem) => {
    try {
      await paymentRepo.recordPayment({
        scheduleId: item.schedule.id,
        collectedAmount: item.schedule.amountDue,
        notes: item.schedule.notes,
      });

      setToastMessage(
        isTe
          ? `✓ ${item.borrower.name}: ₹${item.schedule.amountDue.toLocaleString('en-IN')} పూర్తి వసూలు విజయవంతంగా నమోదైంది!`
          : `✓ ${item.borrower.name}: Full payment of ₹${item.schedule.amountDue.toLocaleString('en-IN')} recorded!`
      );

      await loadCollections();
    } catch (err) {
      setToastMessage(err instanceof Error ? `⚠️ ${err.message}` : 'Failed to record payment');
    }
  };

  // Mark Missed Payment
  const handleMarkMissed = async (item: CollectionItem) => {
    try {
      await paymentRepo.recordPayment({
        scheduleId: item.schedule.id,
        collectedAmount: 0,
        notes: isTe ? 'వాయిదా తప్పింది' : 'Installment missed',
      });

      setToastMessage(
        isTe
          ? `⚠️ ${item.borrower.name}: వాయిదా తప్పినట్లు నమోదైంది`
          : `⚠️ ${item.borrower.name}: Marked as missed`
      );

      await loadCollections();
    } catch (err) {
      setToastMessage(err instanceof Error ? `⚠️ ${err.message}` : 'Failed to update milestone');
    }
  };

  // Submit Partial Payment from Modal
  const handleConfirmPartialPayment = async (amount: number, notes?: string) => {
    if (!modalItem) return;

    await paymentRepo.recordPayment({
      scheduleId: modalItem.schedule.id,
      collectedAmount: amount,
      notes: notes || modalItem.schedule.notes,
    });

    setToastMessage(
      isTe
        ? `✓ ${modalItem.borrower.name}: ₹${amount.toLocaleString('en-IN')} వసూలు నమోదైంది!`
        : `✓ ${modalItem.borrower.name}: ₹${amount.toLocaleString('en-IN')} partial payment recorded!`
    );

    await loadCollections();
  };

  // Metrics Calculations
  const metrics = useMemo(() => {
    const target = items.reduce((acc, it) => acc + it.schedule.amountDue, 0);
    const collected = items.reduce((acc, it) => acc + (it.schedule.amountPaid || 0), 0);
    const pending = Math.max(0, target - collected);
    const progress = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;

    const counts = {
      all: items.length,
      pending: items.filter((it) => it.schedule.status === 'pending').length,
      paid: items.filter((it) => it.schedule.status === 'paid').length,
      partial: items.filter((it) => it.schedule.status === 'partial').length,
      missed: items.filter((it) => it.schedule.status === 'missed').length,
    };

    return { target, collected, pending, progress, counts };
  }, [items]);

  // Filtered Items by Status and Search Query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && item.schedule.status !== statusFilter) {
        return false;
      }

      // 2. Search Query (name or phone)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = item.borrower.name.toLowerCase().includes(query);
        const matchesPhone = item.borrower.phone.includes(query);
        return matchesName || matchesPhone;
      }

      return true;
    });
  }, [items, statusFilter, searchQuery]);

  const isSelectedDateToday = selectedDate === todayIso;

  return (
    <div className="p-4 space-y-4">
      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Date Navigator Header Card */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handlePrevDay}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="Previous Day"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextDay}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="Next Day"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Formatted Date & Day */}
          <div className="text-center flex-1 px-2">
            <p className="text-sm font-extrabold text-slate-900 leading-tight">
              {formatDisplayDate(selectedDate, isTe)}
            </p>
            <p className="text-xs font-semibold text-teal-700">
              {getWeekdayName(selectedDate, isTe)}
              {isSelectedDateToday && (
                <span className="ml-1.5 bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                  {isTe ? 'ఈరోజు' : 'Today'}
                </span>
              )}
            </p>
          </div>

          {/* Jump to Today Button or Calendar Picker */}
          <div>
            {!isSelectedDateToday ? (
              <button
                onClick={handleToday}
                className="min-h-[40px] px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <Calendar size={14} />
                <span>{isTe ? 'ఈరోజు' : 'Today'}</span>
              </button>
            ) : (
              <label className="min-h-[40px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                <Calendar size={14} />
                <span>{isTe ? 'తేదీ' : 'Date'}</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* 3 Metric Cards: Target, Collected, Pending */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 text-center">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isTe ? 'లక్ష్యం (రావలసినది)' : 'Target'}
          </p>
          <p className="text-lg font-black text-slate-900 mt-1">
            {formatINR(metrics.target)}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {metrics.counts.all} {isTe ? 'ఖాతాలు' : 'due'}
          </p>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-3 shadow-sm border border-emerald-200 text-center">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            {isTe ? 'వసూలైనది' : 'Collected'}
          </p>
          <p className="text-lg font-black text-emerald-950 mt-1">
            {formatINR(metrics.collected)}
          </p>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {metrics.counts.paid + metrics.counts.partial} {isTe ? 'వసూలయ్యాయి' : 'collected'}
          </p>
        </div>

        <div className="bg-amber-50 rounded-2xl p-3 shadow-sm border border-amber-200 text-center">
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
            {isTe ? 'బాకీ (మిగిలినది)' : 'Pending'}
          </p>
          <p className="text-lg font-black text-amber-950 mt-1">
            {formatINR(metrics.pending)}
          </p>
          <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
            {metrics.counts.pending + metrics.counts.missed} {isTe ? 'బాకీలు' : 'pending'}
          </p>
        </div>
      </div>

      {/* Progress Bar Header */}
      {metrics.target > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5 text-teal-900">
              <TrendingUp size={14} className="text-teal-600" />
              {isTe ? 'సేకరణ పురోగతి:' : "Today's Collection Progress:"}
            </span>
            <span className="font-extrabold text-teal-800">
              {metrics.progress}% {isTe ? 'పూర్తయింది' : 'Completed'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-teal-700 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${metrics.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isTe ? 'రుణగ్రహీత పేరు లేదా ఫోన్ నంబర్‌తో వెతకండి...' : 'Search by borrower name or phone...'}
          className="w-full min-h-[44px] pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      {/* Status Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        {[
          { id: 'all', labelTe: 'అన్నీ', labelEn: 'All', count: metrics.counts.all },
          { id: 'pending', labelTe: 'బాకీ', labelEn: 'Pending', count: metrics.counts.pending },
          { id: 'paid', labelTe: 'పూర్తయింది', labelEn: 'Paid', count: metrics.counts.paid },
          { id: 'partial', labelTe: 'కొంత భాగం', labelEn: 'Partial', count: metrics.counts.partial },
          { id: 'missed', labelTe: 'తప్పింది', labelEn: 'Missed', count: metrics.counts.missed },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`min-h-[40px] px-3.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-teal-800 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{isTe ? tab.labelTe : tab.labelEn}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? 'bg-teal-900 text-teal-200' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-bold text-slate-600">
            {isTe ? 'వసూళ్ల వివరాలు లోడ్ అవుతున్నాయి...' : 'Loading collection ledger...'}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CheckCircle2 className="h-8 w-8 text-teal-700" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {items.length === 0
              ? isTe
                ? 'ఈ తేదీన ఎలాంటి వసూళ్లు షెడ్యూల్ చేయబడలేదు'
                : 'No collections scheduled for this date'
              : isTe
              ? 'ఫిల్టర్‌కు సరిపోయే వసూళ్లు ఏవీ లేవు'
              : 'No collections match the selected filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {items.length === 0
              ? isTe
                ? 'ఈరోజు రుణగ్రహీతల నుండి ఎలాంటి వాయిదాలు రావలసినవి లేవు. లేదా కొత్త రుణాన్ని జోడించండి.'
                : 'No installments are due on this date. You can check previous dates or create a new loan.'
              : isTe
              ? 'మరొక ఫిల్టర్ లేదా వెతుకులాటను ఎంచుకోండి.'
              : 'Try clearing the search term or switching to another filter.'}
          </p>
        </div>
      ) : (
        /* Collection Items Queue */
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const { schedule, loan, borrower } = item;
            const isPaid = schedule.status === 'paid';
            const isPartial = schedule.status === 'partial';
            const isMissed = schedule.status === 'missed';
            const isPending = schedule.status === 'pending';

            return (
              <div
                key={schedule.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all space-y-3 ${
                  isPaid
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isPartial
                    ? 'border-amber-300 bg-amber-50/20'
                    : isMissed
                    ? 'border-rose-300 bg-rose-50/20'
                    : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                {/* Borrower Header & Quick Contact Buttons */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                      {borrower.name}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      📞 {borrower.phone}
                    </p>
                    {borrower.address && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        📍 {borrower.address}
                      </p>
                    )}
                  </div>

                  {/* 1-Click Call & WhatsApp Receipt Trigger Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={`tel:${borrower.phone}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                      title={isTe ? 'ఫోన్ చేయండి' : 'Call Borrower'}
                      aria-label="Call Borrower"
                    >
                      <Phone size={18} />
                    </a>
                    <button
                      onClick={() =>
                        openWhatsAppReceipt(
                          {
                            borrowerName: borrower.name,
                            borrowerPhone: borrower.phone,
                            collectedAmount: schedule.amountPaid || schedule.amountDue,
                            amountDue: schedule.amountDue,
                            dueDate: schedule.dueDate,
                            remainingLoanBalance: loan.outstandingBalance,
                            loanType: loan.loanType,
                            notes: schedule.notes,
                          },
                          isTe
                        )
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                      title={isTe ? 'రసీదు పంపండి (WhatsApp)' : 'Share WhatsApp Receipt'}
                      aria-label="Share WhatsApp Receipt"
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>
                </div>

                {/* Milestone Details & Amount Due */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-100 text-teal-900 border border-teal-200 mb-1">
                      {loan.loanType === 'DF' ? 'DF' : 'SP'} • {schedule.notes || `${isTe ? 'వాయిదా' : 'Installment'}`}
                    </span>
                    <p className="text-xs font-semibold text-slate-600">
                      {isTe ? 'మొత్తం లోన్ బాకీ:' : 'Loan Balance:'}{' '}
                      <span className="font-bold text-slate-900">{formatINR(loan.outstandingBalance)}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {isTe ? 'రావలసిన మొత్తం' : 'Amount Due'}
                    </span>
                    <span className="text-xl font-black text-teal-900 block mt-0.5">
                      {formatINR(schedule.amountDue)}
                    </span>
                  </div>
                </div>

                {/* Current Status Display */}
                <div className="flex items-center justify-between text-xs">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 size={14} className="text-emerald-700" />
                      {isTe ? 'పూర్తిగా చెల్లించారు' : 'Fully Paid'} ({formatINR(schedule.amountPaid || schedule.amountDue)})
                    </span>
                  ) : isPartial ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <Clock size={14} className="text-amber-700" />
                      {isTe ? 'కొంత భాగం చెల్లించారు' : 'Partially Paid'} ({formatINR(schedule.amountPaid || 0)} / {formatINR(schedule.amountDue)})
                    </span>
                  ) : isMissed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-rose-100 text-rose-900 border border-rose-300">
                      <AlertTriangle size={14} className="text-rose-700" />
                      {isTe ? 'వాయిదా తప్పింది' : 'Installment Missed'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-300">
                      <Clock size={14} className="text-slate-500" />
                      {isTe ? 'ఇంకా వసూలు కాలేదు' : 'Pending Collection'}
                    </span>
                  )}

                  {/* Reset / Undo Option for already processed payments */}
                  {!isPending && (
                    <button
                      onClick={() => setModalItem(item)}
                      className="text-xs font-bold text-slate-500 hover:text-teal-800 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>{isTe ? 'సవరించు' : 'Edit / Adjust'}</span>
                    </button>
                  )}
                </div>

                {/* Action Buttons Row */}
                {isPending && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {/* 1-Tap Full Paid Button (56px) */}
                    <button
                      type="button"
                      onClick={() => handleMarkFullPaid(item)}
                      className="col-span-1 min-h-[52px] rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex flex-col items-center justify-center p-1"
                    >
                      <Check size={18} />
                      <span className="mt-0.5">{isTe ? 'పూర్తి వసూలు' : 'Full Paid'}</span>
                    </button>

                    {/* Partial Payment Button */}
                    <button
                      type="button"
                      onClick={() => setModalItem(item)}
                      className="col-span-1 min-h-[52px] rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex flex-col items-center justify-center p-1"
                    >
                      <Clock size={18} />
                      <span className="mt-0.5">{isTe ? 'కొంత భాగం' : 'Partial'}</span>
                    </button>

                    {/* Missed Button */}
                    <button
                      type="button"
                      onClick={() => handleMarkMissed(item)}
                      className="col-span-1 min-h-[52px] rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 active:scale-95 text-slate-700 font-extrabold text-xs transition-all flex flex-col items-center justify-center p-1"
                    >
                      <AlertTriangle size={18} />
                      <span className="mt-0.5">{isTe ? 'తప్పింది' : 'Missed'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Partial Payment Bottom Sheet Modal */}
      {modalItem && (
        <PartialPaymentModal
          isOpen={Boolean(modalItem)}
          onClose={() => setModalItem(null)}
          isTe={isTe}
          borrowerName={modalItem.borrower.name}
          amountDue={modalItem.schedule.amountDue}
          loanOutstanding={modalItem.loan.outstandingBalance}
          initialAmount={modalItem.schedule.amountPaid || 0}
          onConfirm={handleConfirmPartialPayment}
        />
      )}
    </div>
  );
};
