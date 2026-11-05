import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Pencil,
  Info,
  Loader2,
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

  // Active Date Filter (defaults to real current day with midnight rollover)
  const [todayIso, setTodayIso] = useState<string>(() => formatDateToISO(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateToISO(new Date()));
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Data State
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'missed'>('all');

  // Partial Payment Modal State
  const [modalItem, setModalItem] = useState<CollectionItem | null>(null);

  // Past Date Safety Confirmation Modal State
  const [pastDateConfirm, setPastDateConfirm] = useState<{
    type: 'full' | 'missed';
    item: CollectionItem;
  } | null>(null);

  // Tap Debounce & Processing Lock (Swiss Cheese Layer 3)
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Undo State & Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{
    scheduleId: string;
    previousAmount: number;
    previousStatus: 'pending' | 'paid' | 'partial' | 'missed';
    notes?: string;
  } | null>(null);

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

  // Midnight rollover & window focus sync (auto-advancing today if date changes)
  useEffect(() => {
    const handleSyncToday = () => {
      const realToday = formatDateToISO(new Date());
      if (realToday !== todayIso) {
        setTodayIso(realToday);
        setSelectedDate((prev) => (prev === todayIso ? realToday : prev));
      }
    };

    window.addEventListener('focus', handleSyncToday);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleSyncToday();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleSyncToday);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [todayIso]);

  // Date Navigation Handlers
  const handlePrevDay = () => setSelectedDate((prev) => addDays(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const handleToday = () => setSelectedDate(todayIso);

  // 1-Tap Undo Action Handler (Full-Fidelity State Restoration)
  const handleUndo = async () => {
    if (!lastAction) return;
    try {
      if (lastAction.previousStatus === 'pending') {
        // Restores pristine uncollected pending state
        await paymentRepo.resetToPending(lastAction.scheduleId);
      } else {
        // Restores exact previous amount/status (partial or missed)
        await paymentRepo.recordPayment({
          scheduleId: lastAction.scheduleId,
          collectedAmount: lastAction.previousAmount,
          notes: lastAction.notes,
        });
      }
      setToastMessage(isTe ? '✓ చర్య రద్దు చేయబడింది (Action Undone)' : '✓ Action Undone');
      setLastAction(null);
      await loadCollections();
    } catch (err) {
      console.error('Undo failed:', err);
    }
  };

  // 1-Tap Full Payment (Debounced, Guarded & Haptic)
  const handleMarkFullPaid = async (item: CollectionItem) => {
    if (processingId) return;
    setProcessingId(item.schedule.id);

    try {
      // Haptic confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }

      // Save state for undo
      setLastAction({
        scheduleId: item.schedule.id,
        previousAmount: item.schedule.amountPaid || 0,
        previousStatus: item.schedule.status,
        notes: item.schedule.notes,
      });

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
    } finally {
      setProcessingId(null);
    }
  };

  // Mark Missed Payment (Debounced, Guarded)
  const handleMarkMissed = async (item: CollectionItem) => {
    if (processingId) return;
    setProcessingId(item.schedule.id);

    try {
      // Save state for undo
      setLastAction({
        scheduleId: item.schedule.id,
        previousAmount: item.schedule.amountPaid || 0,
        previousStatus: item.schedule.status,
        notes: item.schedule.notes,
      });

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
    } finally {
      setProcessingId(null);
    }
  };

  // Past Date Safety Interceptors
  const onMarkFullPaidClicked = (item: CollectionItem) => {
    if (selectedDate < todayIso) {
      setPastDateConfirm({ type: 'full', item });
    } else {
      handleMarkFullPaid(item);
    }
  };

  const onMarkMissedClicked = (item: CollectionItem) => {
    if (selectedDate < todayIso) {
      setPastDateConfirm({ type: 'missed', item });
    } else {
      handleMarkMissed(item);
    }
  };

  // Submit Partial Payment from Modal (Debounced & Guarded)
  const handleConfirmPartialPayment = async (amount: number, notes?: string) => {
    if (!modalItem || processingId) return;
    setProcessingId(modalItem.schedule.id);

    try {
      // Haptic confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }

      // Save state for undo
      setLastAction({
        scheduleId: modalItem.schedule.id,
        previousAmount: modalItem.schedule.amountPaid || 0,
        previousStatus: modalItem.schedule.status,
        notes: modalItem.schedule.notes,
      });

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
    } finally {
      setProcessingId(null);
    }
  };

  // Reset Milestone to Pending (Mistake Correction / Complete Undo)
  const handleResetToPending = async (item: CollectionItem) => {
    if (processingId) return;
    setProcessingId(item.schedule.id);

    try {
      await paymentRepo.resetToPending(item.schedule.id);

      setToastMessage(
        isTe
          ? `✓ ${item.borrower.name}: రికార్డు రద్దు చేయబడింది, మళ్లీ బాకీ జాబితాలోకి చేర్చబడింది!`
          : `✓ ${item.borrower.name}: Payment reset to pending queue!`
      );

      await loadCollections();
    } catch (err) {
      setToastMessage(err instanceof Error ? `⚠️ ${err.message}` : 'Failed to reset milestone');
    } finally {
      setProcessingId(null);
    }
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

  // Filtered and Prioritized Items:
  // - Pending items (not yet visited) float to the TOP.
  // - Processed items (paid, partial, missed) stack to the BOTTOM.
  // - Within each group, items are sorted alphabetically by borrower name.
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      // 1. Status Filter (Collected 'paid' tab includes both full paid and partial collections)
      if (statusFilter !== 'all') {
        if (statusFilter === 'paid') {
          if (item.schedule.status !== 'paid' && item.schedule.status !== 'partial') {
            return false;
          }
        } else if (item.schedule.status !== statusFilter) {
          return false;
        }
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

    // Dynamic stacking: pending items float to top, processed items (paid, partial, missed) stack to bottom
    return [...list].sort((a, b) => {
      const aIsPending = a.schedule.status === 'pending';
      const bIsPending = b.schedule.status === 'pending';

      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;

      // Within each tier, preserve clean alphabetical sorting
      return a.borrower.name.localeCompare(b.borrower.name, undefined, {
        sensitivity: 'base',
      });
    });
  }, [items, statusFilter, searchQuery]);

  const isSelectedDateToday = selectedDate === todayIso;
  const isPastDate = selectedDate < todayIso;
  const isFutureDate = selectedDate > todayIso;

  return (
    <div className="p-4 space-y-4">
      {/* Toast Notification with 1-Tap Undo */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
        onUndo={lastAction ? handleUndo : undefined}
        undoLabel={isTe ? 'రద్దు చేయి (Undo)' : 'Undo'}
      />

      {/* Date Navigator Header Card */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between gap-1.5">
          {/* Previous & Next Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handlePrevDay}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
              aria-label="Previous Day"
              title={isTe ? 'మునుపటి రోజు' : 'Previous Day'}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
              aria-label="Next Day"
              title={isTe ? 'తరువాతి రోజు' : 'Next Day'}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Formatted Date & Day Display (Clickable to open native calendar) */}
          <button
            type="button"
            onClick={() => datePickerRef.current?.showPicker()}
            className="text-center flex-1 px-1.5 py-1 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
            title={isTe ? 'క్యాలెండర్ తెరవడానికి నొక్కండి' : 'Tap to open calendar'}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Calendar size={14} className="text-teal-700 group-hover:scale-110 transition-transform" />
              <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                {formatDisplayDate(selectedDate, isTe)}
              </p>
            </div>
            <p className="text-[11px] font-semibold text-teal-700 mt-0.5">
              {getWeekdayName(selectedDate, isTe)}
              {isSelectedDateToday ? (
                <span className="ml-1 bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                  {isTe ? 'ఈరోజు' : 'Today'}
                </span>
              ) : isFutureDate ? (
                <span className="ml-1 bg-sky-100 text-sky-900 border border-sky-200 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                  {isTe ? 'భవిష్యత్తు' : 'Future'}
                </span>
              ) : (
                <span className="ml-1 bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                  {isTe ? 'గత రికార్డు' : 'Past'}
                </span>
              )}
            </p>
          </button>

          {/* Right Action Buttons: Today Quick-Return + Native Calendar */}
          <div className="flex items-center gap-1.5">
            {!isSelectedDateToday && (
              <button
                type="button"
                onClick={handleToday}
                className="min-h-[44px] px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-sm active:scale-95"
                title={isTe ? 'ఈరోజుకి తిరిగి వెళ్లండి' : 'Return to Today'}
              >
                <RotateCcw size={13} className="stroke-[2.5]" />
                <span className="hidden xs:inline">{isTe ? 'ఈరోజు' : 'Today'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker()}
              className="min-h-[44px] min-w-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center active:scale-95"
              title={isTe ? 'క్యాలెండర్' : 'Calendar'}
            >
              <Calendar size={18} />
            </button>

            <input
              ref={datePickerRef}
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>

        {/* Informational Banner for Future Dates */}
        {isFutureDate && (
          <div className="bg-sky-50 border border-sky-200 text-sky-950 rounded-xl p-2.5 flex items-center gap-2 text-xs font-semibold animate-fade-in">
            <Info size={16} className="text-sky-700 shrink-0" />
            <span>
              {isTe
                ? 'భవిష్యత్తు షెడ్యూల్ (View Only): రావలసిన వసూళ్ల ప్రణాళిక మాత్రమే. వసూళ్లు ఆనాటి లేదా మునుపటి తేదీలలో మాత్రమే నమోదు చేయవచ్చు.'
                : 'Future Schedule (View Only): Advance collections can only be recorded on or after the scheduled date.'}
            </span>
          </div>
        )}

        {/* Warning Banner for Past Dates */}
        {isPastDate && (
          <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs font-semibold animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-700 shrink-0" />
              <span>
                {isTe
                  ? 'గత రికార్డులను చూస్తున్నారు. మార్పులకు నిర్ధారణ అవసరం.'
                  : 'Viewing past ledger. Changes require confirmation.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToday}
              className="text-teal-800 underline font-black shrink-0 text-[11px]"
            >
              {isTe ? 'ఈరోజుకి వెళ్లండి →' : 'Go to Today →'}
            </button>
          </div>
        )}
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

      {/* 4-Tab Unified Status Filter (Fits 100% of Screen, Zero Scroll) */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
        {[
          { id: 'all', labelTe: 'అన్నీ', labelEn: 'All', count: metrics.counts.all },
          { id: 'pending', labelTe: 'బాకీ', labelEn: 'Pending', count: metrics.counts.pending },
          { id: 'paid', labelTe: 'వసూలు', labelEn: 'Collected', count: metrics.counts.paid + metrics.counts.partial },
          { id: 'missed', labelTe: 'తప్పింది', labelEn: 'Missed', count: metrics.counts.missed },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`min-h-[48px] px-1 py-1 rounded-xl transition-all flex flex-col items-center justify-center leading-tight active:scale-95 ${
                isActive
                  ? 'bg-teal-800 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60'
              }`}
            >
              <span className="font-extrabold text-[12px] truncate">
                {isTe ? tab.labelTe : tab.labelEn}
              </span>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-full mt-0.5 ${
                  isActive ? 'bg-teal-950 text-teal-200' : 'bg-slate-100 text-slate-700'
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
        /* Collection Items Queue (Dynamic Stacking: Pending at top, Processed at bottom) */
        <div className="space-y-3">
          {filteredItems.map((item, idx) => {
            const { schedule, loan, borrower } = item;
            const isPaid = schedule.status === 'paid';
            const isPartial = schedule.status === 'partial';
            const isMissed = schedule.status === 'missed';
            const isPending = schedule.status === 'pending';

            // Divider condition when viewing 'all': first processed item following pending items
            const isFirstProcessed =
              statusFilter === 'all' &&
              !isPending &&
              (idx === 0 || filteredItems[idx - 1].schedule.status === 'pending');

            return (
              <React.Fragment key={schedule.id}>
                {isFirstProcessed && (
                  <div className="pt-2 pb-1 flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-slate-200" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>{isTe ? 'సందర్శించినవి / ముగిసినవి' : 'Visited / Processed'}</span>
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-200" />
                  </div>
                )}

                <div
                  className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all space-y-3 ${
                    isPaid
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isPartial
                      ? 'border-amber-200 bg-amber-50/20'
                      : isMissed
                      ? 'border-rose-200 bg-rose-50/20'
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

                    {/* 1-Click Call & WhatsApp Receipt Trigger Buttons (48px Touch Targets) */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={`tel:${borrower.phone}`}
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                        title={isTe ? 'ఫోన్ చేయండి' : 'Call Borrower'}
                        aria-label="Call Borrower"
                      >
                        <Phone size={20} />
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
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                        title={isTe ? 'రసీదు పంపండి (WhatsApp)' : 'Share WhatsApp Receipt'}
                        aria-label="Share WhatsApp Receipt"
                      >
                        <MessageCircle size={20} />
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

                  {/* Status Banner - Displayed Uniformly across Pending, Paid, Partial, and Missed */}
                  {isPending ? (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        <Clock size={14} className="text-slate-500" />
                        {isTe ? 'ఇంకా వసూలు కాలేదు' : 'Pending Collection'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {isTe ? 'చర్యను ఎంచుకోండి ↓' : 'Select action ↓'}
                      </span>
                    </div>
                  ) : (
                    /* Processed Status Banner (Completely Uniform across Paid, Partial, and Missed) */
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                        isPaid
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : isPartial
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : 'bg-rose-50/80 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isPaid ? (
                          <CheckCircle2 size={18} className="text-emerald-700 flex-shrink-0" />
                        ) : isPartial ? (
                          <Clock size={18} className="text-amber-700 flex-shrink-0" />
                        ) : (
                          <AlertTriangle size={18} className="text-rose-700 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-extrabold text-xs">
                            {isPaid
                              ? isTe ? 'పూర్తిగా చెల్లించారు' : 'Fully Paid'
                              : isPartial
                              ? isTe ? 'కొంత భాగం చెల్లించారు' : 'Partially Paid'
                              : isTe ? 'వాయిదా తప్పింది' : 'Installment Missed'}
                          </div>
                          <div className="text-[11px] opacity-80 font-medium mt-0.5">
                            {isPaid
                              ? `${isTe ? 'వసూలైనది' : 'Collected'}: ${formatINR(schedule.amountPaid || schedule.amountDue)}`
                              : isPartial
                              ? `${isTe ? 'వసూలైనది' : 'Collected'}: ${formatINR(schedule.amountPaid || 0)} (${isTe ? 'మిగిలినది' : 'Deficit'}: ${formatINR(Math.max(0, schedule.amountDue - (schedule.amountPaid || 0)))})`
                              : `${isTe ? 'వసూలైనది' : 'Collected'}: ₹0 (${isTe ? 'బాకీ' : 'Deficit'}: ${formatINR(schedule.amountDue)})`}
                          </div>
                        </div>
                      </div>

                      {/* Right Badge / Status Pill */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex-shrink-0 ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {isPaid
                          ? isTe ? 'పూర్తయింది' : 'Paid'
                          : isPartial
                          ? `${Math.round(((schedule.amountPaid || 0) / schedule.amountDue) * 100)}%`
                          : isTe ? 'తప్పింది' : 'Missed'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  {isFutureDate ? (
                    /* Future Date: Read-Only Schedule View (No Payment Actions to Prevent Chaos) */
                    <div className="bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Calendar size={14} className="text-teal-700" />
                        <span>{isTe ? 'రావలసిన వాయిదా (Scheduled)' : 'Scheduled Installment'}</span>
                      </span>
                      <span className="text-slate-900 font-extrabold">{formatINR(schedule.amountDue)}</span>
                    </div>
                  ) : isPending ? (
                    /* Pending State: 3-Button Action Grid (56px Primary Touch Targets) */
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {/* 1-Tap Full Paid Button (56px) */}
                      <button
                        type="button"
                        disabled={Boolean(processingId)}
                        onClick={() => onMarkFullPaidClicked(item)}
                        className={`col-span-1 min-h-[56px] rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex flex-col items-center justify-center p-1 ${
                          processingId === item.schedule.id ? 'opacity-70 cursor-wait' : ''
                        }`}
                      >
                        {processingId === item.schedule.id ? (
                          <Loader2 size={20} className="animate-spin text-white" />
                        ) : (
                          <Check size={20} />
                        )}
                        <span className="mt-0.5">{isTe ? 'పూర్తి వసూలు' : 'Full Paid'}</span>
                      </button>

                      {/* Partial Payment Button */}
                      <button
                        type="button"
                        disabled={Boolean(processingId)}
                        onClick={() => setModalItem(item)}
                        className="col-span-1 min-h-[56px] rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex flex-col items-center justify-center p-1"
                      >
                        <Clock size={20} />
                        <span className="mt-0.5">{isTe ? 'కొంత భాగం' : 'Partial'}</span>
                      </button>

                      {/* Missed Button */}
                      <button
                        type="button"
                        disabled={Boolean(processingId)}
                        onClick={() => onMarkMissedClicked(item)}
                        className="col-span-1 min-h-[56px] rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 disabled:opacity-50 active:scale-95 text-slate-700 font-extrabold text-xs transition-all flex flex-col items-center justify-center p-1"
                      >
                        <AlertTriangle size={20} />
                        <span className="mt-0.5">{isTe ? 'తప్పింది' : 'Missed'}</span>
                      </button>
                    </div>
                  ) : (
                    /* Processed State: 2-Button Action Grid (Completely Uniform for Paid, Partial, and Missed) */
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      {/* Reset to Pending (Undo) Button */}
                      <button
                        type="button"
                        disabled={Boolean(processingId)}
                        onClick={() => handleResetToPending(item)}
                        className="min-h-[48px] rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        title={isTe ? 'బాకీగా మార్చు (రీసెట్)' : 'Reset to Pending Queue'}
                      >
                        {processingId === item.schedule.id ? (
                          <Loader2 size={15} className="animate-spin text-rose-700" />
                        ) : (
                          <RotateCcw size={15} />
                        )}
                        <span>{isTe ? 'బాకీగా మార్చు' : 'Reset to Pending'}</span>
                      </button>

                      {/* Edit / Adjust Button */}
                      <button
                        type="button"
                        disabled={Boolean(processingId)}
                        onClick={() => setModalItem(item)}
                        className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        title={isTe ? 'సవరించు' : 'Edit / Adjust'}
                      >
                        <Pencil size={15} />
                        <span>{isTe ? 'సవరించు' : 'Edit / Adjust'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
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
          currentStatus={modalItem.schedule.status}
          onConfirm={handleConfirmPartialPayment}
        />
      )}

      {/* Past Date Safety Confirmation Modal */}
      {pastDateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border-2 border-amber-300 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                  {isTe ? 'గత తేదీ వసూలు నిర్ధారణ' : 'Confirm Past Date Entry'}
                </h4>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {formatDisplayDate(selectedDate, isTe)}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <p className="font-bold">
                {pastDateConfirm.type === 'full'
                  ? isTe
                    ? `మీరు గత తేదీ రికార్డును మారుస్తున్నారు. ${pastDateConfirm.item.borrower.name} నుండి ₹${pastDateConfirm.item.schedule.amountDue.toLocaleString('en-IN')} పూర్తి వసూలు నమోదు చేయాలా?`
                    : `You are recording a retrospective payment of ₹${pastDateConfirm.item.schedule.amountDue.toLocaleString('en-IN')} for ${pastDateConfirm.item.borrower.name}.`
                  : isTe
                    ? `మీరు గత తేదీ రికార్డును మారుస్తున్నారు. ${pastDateConfirm.item.borrower.name} కి ఈ వాయిదా 'తప్పింది' (Missed) గా నమోదు చేయాలా?`
                    : `You are marking installment as Missed for ${pastDateConfirm.item.borrower.name} on a past date.`}
              </p>
              <p className="text-[11px] text-amber-800 opacity-90">
                {isTe
                  ? '⚠️ ఇది గత పుస్తకాల లెక్కలను మరియు నిల్వను మారుస్తుంది.'
                  : '⚠️ This will update historical ledger records and loan balance.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPastDateConfirm(null)}
                className="min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs active:scale-95 transition-all"
              >
                {isTe ? 'రద్దు చేయి (Cancel)' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const { type, item } = pastDateConfirm;
                  setPastDateConfirm(null);
                  if (type === 'full') {
                    handleMarkFullPaid(item);
                  } else {
                    handleMarkMissed(item);
                  }
                }}
                className="min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
              >
                {isTe ? 'అవును, నమోదు చేయి' : 'Yes, Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
