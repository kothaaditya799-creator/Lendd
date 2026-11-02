import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  CheckCircle2,
  Clock,
  Phone,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { loanRepo } from '../db/repositories/loanRepo';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { paymentRepo } from '../db/repositories/paymentRepo';
import { Loan } from '../types/domain';
import { formatDateToISO, addDays, formatDisplayDate } from '../utils/dateUtils';
import { formatINR } from '../utils/currency';
import {
  calculatePortfolioMetrics,
  calculateAgingBuckets,
  detectLeakingBorrowers,
  calculateConcentrationRisk,
  calculateEodSummary,
  openWhatsAppEodSummary,
  PortfolioMetrics,
  AgingBucketsSummary,
  LeakingBorrower,
  ConcentrationRisk,
  EodSummary,
} from '../utils/portfolioAnalytics';

interface InsightsPageProps {
  language: 'en' | 'te';
}

export const InsightsPage: React.FC<InsightsPageProps> = ({ language }) => {
  const isTe = language === 'te';
  const todayStr = formatDateToISO(new Date());

  const [selectedEodDate, setSelectedEodDate] = useState<string>(todayStr);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedBucket, setExpandedBucket] = useState<'healthy' | 'minorDelay' | 'warning' | 'critical' | null>(null);

  // Raw Database Records
  const [loans, setLoans] = useState<Loan[]>([]);

  // Computed Intelligence Metrics
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    totalCapitalDeployed: 0,
    totalOutstandingBalance: 0,
    totalCollected: 0,
    totalProjectedYield: 0,
    activeLoansCount: 0,
    completedLoansCount: 0,
    activeBorrowersCount: 0,
  });

  const [aging, setAging] = useState<AgingBucketsSummary>({
    healthy: { labelEn: 'Healthy / Current', labelTe: 'ఆరోగ్యకరం / సాధారణం', range: '0–5 days', count: 0, amount: 0, items: [] },
    minorDelay: { labelEn: 'Minor Delay', labelTe: 'స్వల్ప ఆలస్యం', range: '6–12 days', count: 0, amount: 0, items: [] },
    warning: { labelEn: 'Warning', labelTe: 'హెచ్చరిక / ప్రమాదం', range: '13–30 days', count: 0, amount: 0, items: [] },
    critical: { labelEn: 'Critical / Hard Default', labelTe: 'తీవ్ర లోటు / డిఫాల్ట్', range: '>30 days', count: 0, amount: 0, items: [] },
    totalOverdueAmount: 0,
    totalOverdueCount: 0,
  });

  const [leakingBorrowers, setLeakingBorrowers] = useState<LeakingBorrower[]>([]);
  const [concentration, setConcentration] = useState<ConcentrationRisk>({
    topBorrowerPercent: 0,
    top3BorrowersPercent: 0,
    top5BorrowersPercent: 0,
    riskLevel: 'healthy',
    totalActiveDebt: 0,
    topBorrowers: [],
  });

  const [eodSummary, setEodSummary] = useState<EodSummary>({
    date: todayStr,
    targetExpected: 0,
    actualCollected: 0,
    shortfall: 0,
    efficiencyPercent: 0,
    headcount: { paid: 0, partial: 0, missed: 0, pending: 0, total: 0 },
    disbursements: { count: 0, totalPrincipal: 0, loans: [] },
    netCashFlow: 0,
  });

  const datePickerRef = useRef<HTMLInputElement>(null);

  // Load all records from Dexie and calculate metrics
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allLoans, allBorrowers, allSchedules] = await Promise.all([
        loanRepo.getAllLoans(),
        borrowerRepo.getAllBorrowers(),
        paymentRepo.getAllSchedules(),
      ]);

      setLoans(allLoans);

      // 1. Portfolio Aggregates
      const pMetrics = calculatePortfolioMetrics(allLoans, allBorrowers);
      setMetrics(pMetrics);

      // 2. Overdue Aging Analysis (Custom Buckets: 0-5d, 6-12d, 13-30d, >30d)
      const pAging = calculateAgingBuckets(allSchedules, allLoans, allBorrowers, todayStr);
      setAging(pAging);

      // 3. Leaking Buckets (Chronic Under-Payers)
      const pLeaking = detectLeakingBorrowers(allSchedules, allLoans, allBorrowers, todayStr);
      setLeakingBorrowers(pLeaking);

      // 4. Capital Concentration Risk Radar
      const pConcentration = calculateConcentrationRisk(allLoans, allBorrowers);
      setConcentration(pConcentration);

      // 5. EOD Summary for selected date
      const pEod = calculateEodSummary(selectedEodDate, allSchedules, allLoans, allBorrowers);
      setEodSummary(pEod);
    } catch (err) {
      console.error('Failed to load insights data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEodDate]);

  // EOD Date Navigation Handlers
  const handlePrevDay = () => setSelectedEodDate((prev) => addDays(prev, -1));
  const handleNextDay = () => setSelectedEodDate((prev) => addDays(prev, 1));

  const toggleBucket = (bucket: 'healthy' | 'minorDelay' | 'warning' | 'critical') => {
    setExpandedBucket((prev) => (prev === bucket ? null : bucket));
  };

  // Capital Recovery Progress
  const totalPrincipalAllLoans = loans.reduce((s, l) => s + l.principalAmount, 0);
  const recoveryProgress =
    totalPrincipalAllLoans > 0
      ? Math.min(100, Math.round((metrics.totalCollected / totalPrincipalAllLoans) * 100))
      : 0;

  return (
    <div className="p-4 space-y-5 pb-24 max-w-2xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-10 w-10 rounded-2xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              {isTe ? 'తెలివైన విశ్లేషణ' : 'Decision Intelligence'}
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {isTe ? 'పోర్ట్‌ఫోలియో స్థితి & నేటి ముగింపు లెక్క' : 'Portfolio Health & EOD Audit'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="h-10 w-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 flex items-center justify-center text-slate-600 transition-all"
          title={isTe ? 'తాజాపరచండి' : 'Refresh Data'}
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin text-teal-700' : ''} />
        </button>
      </div>

      {/* =========================================================================
          SECTION 1: PORTFOLIO CAPITAL HERO CARD
          ========================================================================= */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-850 to-teal-800 text-white rounded-3xl p-5 shadow-xl border border-teal-700 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-teal-800/80 text-teal-200 border border-teal-700">
            <Wallet size={14} />
            {isTe ? 'మొత్తం పోర్ట్‌ఫోలియో' : 'Portfolio Overview'}
          </span>
          <span className="text-xs font-bold text-teal-300">
            {metrics.activeLoansCount} {isTe ? 'క్రియాశీల రుణాలు' : 'Active Loans'}
          </span>
        </div>

        {/* Big Numbers Grid */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
              {isTe ? 'పెట్టుబడి మొత్తం (Deployed)' : 'Capital Deployed'}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-0.5 tracking-tight">
              {formatINR(metrics.totalCapitalDeployed)}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
              {isTe ? 'రావలసిన అసలు బాకీ' : 'Active Outstanding'}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-teal-100 mt-0.5 tracking-tight">
              {formatINR(metrics.totalOutstandingBalance)}
            </p>
          </div>
        </div>

        {/* Secondary Figures Row */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-teal-750 text-xs">
          <div className="bg-teal-950/40 p-2.5 rounded-xl border border-teal-700/50">
            <span className="text-teal-300 font-semibold block">
              {isTe ? 'మొత్తం వసూలైన నగదు' : 'Total Cash Collected'}
            </span>
            <span className="text-base font-extrabold text-emerald-300 block mt-0.5">
              {formatINR(metrics.totalCollected)}
            </span>
          </div>

          <div className="bg-teal-950/40 p-2.5 rounded-xl border border-teal-700/50">
            <span className="text-teal-300 font-semibold block">
              {isTe ? 'అంచనా రాబడి (Yield/Interest)' : 'Projected Profit / Yield'}
            </span>
            <span className="text-base font-extrabold text-amber-300 block mt-0.5">
              +{formatINR(metrics.totalProjectedYield)}
            </span>
          </div>
        </div>

        {/* Recovery Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-bold text-teal-300">
            <span>{isTe ? 'అసలు రికవరీ పురోగతి' : 'Capital Recovery Progress'}</span>
            <span>{recoveryProgress}%</span>
          </div>
          <div className="w-full bg-teal-950/70 h-2.5 rounded-full overflow-hidden p-0.5 border border-teal-700">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${recoveryProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: END-OF-DAY (EOD) CASH TALLY CARD
          ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-slate-200 space-y-4">
        {/* EOD Header & Date Selector */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🌅</span>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {isTe ? 'నేటి ముగింపు లెక్క (EOD Tally)' : 'End-of-Day Cash Tally'}
              </h3>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {formatDisplayDate(selectedEodDate, isTe)}
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700"
              title="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker()}
              className="px-2.5 h-9 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 hover:bg-teal-100 active:scale-95"
            >
              <Calendar size={14} />
              <span>{isTe ? 'తేదీ' : 'Date'}</span>
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700"
              title="Next Day"
            >
              <ChevronRight size={18} />
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={selectedEodDate}
              onChange={(e) => e.target.value && setSelectedEodDate(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>

        {/* Big Net Cash in Hand Hero Banner */}
        <div
          className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${eodSummary.netCashFlow >= 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-80 block">
              {isTe ? 'చేతిలో మిగిలిన నికర నగదు (Net Cash in Hand)' : 'Net Cash Position Today'}
            </span>
            <p className="text-3xl font-black mt-0.5 tracking-tight">
              {eodSummary.netCashFlow >= 0 ? '+' : ''}
              {formatINR(eodSummary.netCashFlow)}
            </p>
            <span className="text-xs font-semibold opacity-90 mt-0.5 block">
              {eodSummary.netCashFlow >= 0
                ? isTe
                  ? '✓ నేటి వసూళ్లు కొత్త రుణాల కంటే ఎక్కువ'
                  : '✓ Cash surplus after today’s disbursements'
                : isTe
                  ? '⚠️ నేటి కొత్త రుణాలు వసూళ్ల కంటే ఎక్కువ'
                  : '⚠️ Disbursements exceeded today’s collections'}
            </span>
          </div>

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${eodSummary.netCashFlow >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
          >
            {eodSummary.netCashFlow >= 0 ? <ArrowUpRight size={28} /> : <ArrowDownRight size={28} />}
          </div>
        </div>

        {/* Cash Flow Breakdown (Collections In vs Disbursements Out) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isTe ? 'వసూలైన నగదు (In)' : 'Collections In'}</span>
            </div>
            <p className="text-xl font-black text-slate-900">
              +{formatINR(eodSummary.actualCollected)}
            </p>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              {eodSummary.efficiencyPercent}% {isTe ? 'వసూలు రేటు' : 'Efficiency'}
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-rose-700 font-bold mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{isTe ? 'కొత్త రుణాలు (Out)' : 'Disbursements Out'}</span>
            </div>
            <p className="text-xl font-black text-slate-900">
              -{formatINR(eodSummary.disbursements.totalPrincipal)}
            </p>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              {eodSummary.disbursements.count} {isTe ? 'కొత్త రుణాలు' : 'New Loans'}
            </p>
          </div>
        </div>

        {/* Target vs Shortfall Row */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-semibold block">{isTe ? 'నేటి లక్ష్యం' : 'Target Expected'}</span>
            <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
              {formatINR(eodSummary.targetExpected)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-500 font-semibold block">{isTe ? 'లోటు / బాకీ' : 'Shortfall / Gap'}</span>
            <span className="text-base font-extrabold text-rose-700 mt-0.5 block">
              {formatINR(eodSummary.shortfall)}
            </span>
          </div>
        </div>

        {/* Headcount Breakdown Grid */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            {isTe ? 'ఖాతాదారుల వివరాలు (Headcount)' : 'Borrowers Visited & Status'}
          </span>
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-emerald-950 font-bold">
              <span className="block text-[10px] uppercase text-emerald-800">{isTe ? 'పూర్తి' : 'Paid'}</span>
              <span className="text-base font-extrabold mt-0.5 block">{eodSummary.headcount.paid}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-amber-950 font-bold">
              <span className="block text-[10px] uppercase text-amber-800">{isTe ? 'పాక్షికం' : 'Partial'}</span>
              <span className="text-base font-extrabold mt-0.5 block">{eodSummary.headcount.partial}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-rose-950 font-bold">
              <span className="block text-[10px] uppercase text-rose-800">{isTe ? 'తప్పింది' : 'Missed'}</span>
              <span className="text-base font-extrabold mt-0.5 block">{eodSummary.headcount.missed}</span>
            </div>
            <div className="bg-slate-100 border border-slate-200 p-2 rounded-xl text-slate-800 font-bold">
              <span className="block text-[10px] uppercase text-slate-600">{isTe ? 'బాకీ' : 'Pending'}</span>
              <span className="text-base font-extrabold mt-0.5 block">{eodSummary.headcount.pending}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Share Button (52px Touch Target) */}
        <button
          type="button"
          onClick={() => openWhatsAppEodSummary(eodSummary, isTe)}
          className="w-full min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <MessageCircle size={20} />
          <span>{isTe ? 'WhatsApp లో ముగింపు లెక్క పంపండి' : 'Share EOD Summary to WhatsApp'}</span>
        </button>
      </div>

      {/* =========================================================================
          SECTION 3: OVERDUE AGING ANALYSIS (CUSTOM BUCKETS: 0-5d, 6-12d, 13-30d, >30d)
          ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {isTe ? 'బాకీ కాలపరిమితి విశ్లేషణ (Aging Buckets)' : 'Overdue Aging Analysis'}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isTe
                  ? `మొత్తం బాకీ: ${formatINR(aging.totalOverdueAmount)} (${aging.totalOverdueCount} వాయిదాలు)`
                  : `Total At-Risk: ${formatINR(aging.totalOverdueAmount)} (${aging.totalOverdueCount} installments)`}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Interactive Aging Bucket Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Healthy Bucket: 0-5 days */}
          <button
            type="button"
            onClick={() => toggleBucket('healthy')}
            className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${expandedBucket === 'healthy'
                ? 'bg-emerald-100/70 border-emerald-500 shadow-sm'
                : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/40'
              }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
              <span>{isTe ? 'సాధారణం' : 'Healthy'}</span>
              <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-full">0–5d</span>
            </div>
            <p className="text-xl font-black text-emerald-950">{formatINR(aging.healthy.amount)}</p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 mt-1">
              <span>{aging.healthy.count} {isTe ? 'వాయిదాలు' : 'due'}</span>
              {expandedBucket === 'healthy' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {/* Minor Delay Bucket: 6-12 days */}
          <button
            type="button"
            onClick={() => toggleBucket('minorDelay')}
            className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${expandedBucket === 'minorDelay'
                ? 'bg-amber-100/70 border-amber-500 shadow-sm'
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/40'
              }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
              <span>{isTe ? 'స్వల్ప ఆలస్యం' : 'Minor Delay'}</span>
              <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full">6–12d</span>
            </div>
            <p className="text-xl font-black text-amber-950">{formatINR(aging.minorDelay.amount)}</p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 mt-1">
              <span>{aging.minorDelay.count} {isTe ? 'వాయిదాలు' : 'due'}</span>
              {expandedBucket === 'minorDelay' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {/* Warning Bucket: 13-30 days */}
          <button
            type="button"
            onClick={() => toggleBucket('warning')}
            className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${expandedBucket === 'warning'
                ? 'bg-orange-100/70 border-orange-500 shadow-sm'
                : 'bg-orange-50/50 border-orange-200 hover:bg-orange-100/40'
              }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-orange-900 mb-1">
              <span>{isTe ? 'హెచ్చరిక' : 'Warning'}</span>
              <span className="text-[10px] bg-orange-200/80 px-2 py-0.5 rounded-full">13–30d</span>
            </div>
            <p className="text-xl font-black text-orange-950">{formatINR(aging.warning.amount)}</p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-orange-800 mt-1">
              <span>{aging.warning.count} {isTe ? 'వాయిదాలు' : 'due'}</span>
              {expandedBucket === 'warning' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {/* Critical Bucket: >30 days */}
          <button
            type="button"
            onClick={() => toggleBucket('critical')}
            className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${expandedBucket === 'critical'
                ? 'bg-rose-100/70 border-rose-500 shadow-sm'
                : 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/40'
              }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-rose-900 mb-1">
              <span>{isTe ? 'తీవ్ర డిఫాల్ట్' : 'Hard Default'}</span>
              <span className="text-[10px] bg-rose-200/80 px-2 py-0.5 rounded-full">&gt;30d</span>
            </div>
            <p className="text-xl font-black text-rose-950">{formatINR(aging.critical.amount)}</p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 mt-1">
              <span>{aging.critical.count} {isTe ? 'వాయిదాలు' : 'due'}</span>
              {expandedBucket === 'critical' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
        </div>

        {/* Expanded Drawer: List of Overdue Borrowers in Selected Bucket */}
        {expandedBucket && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
              <span>
                {isTe ? aging[expandedBucket].labelTe : aging[expandedBucket].labelEn} ({aging[expandedBucket].range})
              </span>
              <span className="text-teal-900 font-extrabold">{formatINR(aging[expandedBucket].amount)}</span>
            </div>

            {aging[expandedBucket].items.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2 font-medium">
                {isTe ? 'ఈ కేటగిరీలో ఎలాంటి బాకీలు లేవు ✓' : 'No overdue records in this bucket ✓'}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {aging[expandedBucket].items.map((item, idx) => (
                  <div
                    key={`${item.loanId}-${item.dueDate}-${idx}`}
                    className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{item.borrowerName}</h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {item.daysOverdue} {isTe ? 'రోజుల ఆలస్యం' : 'days overdue'} • {formatINR(item.amountOverdue)}
                      </p>
                    </div>

                    {item.borrowerPhone && (
                      <a
                        href={`tel:${item.borrowerPhone}`}
                        className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center flex-shrink-0"
                        title={isTe ? 'ఫోన్ చేయండి' : 'Call'}
                      >
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 4: LEAKING BUCKETS DETECTOR (CHRONIC UNDER-PAYERS)
          ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              {isTe ? 'లీకేజీల గుర్తింపు (Leaking Buckets)' : 'Leaking Buckets Detector'}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {isTe
                ? 'తరచుగా పాక్షిక వసూళ్లు లేదా వాయిదాలు తప్పే రుణగ్రహీతలు'
                : 'Chronic under-payers masking potential default risk'}
            </p>
          </div>
        </div>

        {leakingBorrowers.length === 0 ? (
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center space-y-1">
            <CheckCircle2 size={24} className="text-emerald-600 mx-auto" />
            <p className="text-xs font-extrabold text-emerald-950">
              {isTe ? 'అద్భుతం! ఎలాంటి లీకేజీలు లేవు' : 'All Clear! No Chronic Under-Payers'}
            </p>
            <p className="text-[11px] text-emerald-800 font-medium">
              {isTe
                ? 'ఖాతాదారులందరూ సమయానికి లేదా పూర్తి వాయిదాలు చెల్లిస్తున్నారు.'
                : 'All borrowers are maintaining regular repayments.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leakingBorrowers.map((borrower) => (
              <div
                key={borrower.loanId}
                className="bg-amber-50/60 rounded-2xl p-3.5 border-2 border-amber-300 flex items-start justify-between gap-2"
              >
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">{borrower.borrowerName}</h4>
                  <p className="text-xs text-rose-700 font-extrabold mt-0.5">
                    {isTe ? 'పేరుకుపోయిన లోటు:' : 'Accumulated Deficit:'}{' '}
                    <span>{formatINR(borrower.totalDeficit)}</span>
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {(isTe ? borrower.reasonsTe : borrower.reasonsEn).map((reason, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300"
                      >
                        ⚠️ {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {borrower.borrowerPhone && (
                  <a
                    href={`tel:${borrower.borrowerPhone}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center justify-center flex-shrink-0"
                    title={isTe ? 'ఫోన్ చేయండి' : 'Call'}
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 5: CAPITAL CONCENTRATION RISK RADAR
          ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              <PieChart size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {isTe ? 'మూలధన కేంద్రీకరణ రాడార్' : 'Capital Concentration Radar'}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isTe ? 'టాప్ ఖాతాదారులలో రిస్క్ సాంద్రత' : 'Exposure in Top Borrowers'}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${concentration.riskLevel === 'high'
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : concentration.riskLevel === 'moderate'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}
          >
            {concentration.riskLevel === 'high'
              ? isTe ? 'అధిక రిస్క్' : 'High Risk'
              : concentration.riskLevel === 'moderate'
                ? isTe ? 'మోస్తరు రిస్క్' : 'Moderate Risk'
                : isTe ? 'ఆరోగ్యకరం' : 'Healthy'}
          </span>
        </div>

        {/* Concentration Meter Bar */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>{isTe ? 'టాప్ 3 ఖాతాదారుల వాటా' : 'Top 3 Borrowers Share'}</span>
            <span className="text-sm font-black text-slate-900">
              {concentration.top3BorrowersPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ${concentration.riskLevel === 'high'
                  ? 'bg-rose-600'
                  : concentration.riskLevel === 'moderate'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              style={{ width: `${Math.min(100, concentration.top3BorrowersPercent)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
            {concentration.riskLevel === 'high'
              ? isTe
                ? '⚠️ మీ మొత్తం మూలధనంలో 50% కంటే ఎక్కువ టాప్ 3 వ్యక్తుల వద్దే ఉంది. కొత్త రుణాలను ఇతర చిన్న వ్యాపారులకు విస్తరించడం శ్రేయస్కరం.'
                : '⚠️ Over 50% of your total loan capital is concentrated in just 3 borrowers. Diversify to reduce default vulnerability.'
              : isTe
                ? '✓ మీ మూలధన పెట్టుబడి ఆరోగ్యకరంగా విస్తరించబడింది.'
                : '✓ Capital is well distributed across multiple borrowers.'}
          </p>
        </div>

        {/* Top 3 Borrowers Breakdown */}
        {concentration.topBorrowers.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              {isTe ? 'అత్యధిక అప్పు కలిగిన వ్యక్తులు' : 'Highest Exposure Borrowers'}
            </span>
            {concentration.topBorrowers.slice(0, 3).map((item, idx) => (
              <div
                key={item.borrowerId}
                className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-900 font-black text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-extrabold text-slate-900 block">{item.borrowerName}</span>
                    <span className="text-[10px] text-slate-500">
                      {item.activeLoanCount} {isTe ? 'క్రియాశీల లోన్లు' : 'active loans'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-slate-900 block">
                    {formatINR(item.outstandingBalance)}
                  </span>
                  <span className="text-[10px] text-teal-800 font-bold block">
                    {item.percentageOfTotal}% {isTe ? 'మొత్తంలో' : 'of total'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
