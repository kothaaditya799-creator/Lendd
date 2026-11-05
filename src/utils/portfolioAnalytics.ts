import type { Loan, PaymentSchedule, Borrower } from '../types/domain.ts';
import { getDaysDifference, formatDisplayDate } from './dateUtils.ts';
import { formatINR } from './currency.ts';

export interface AgingBucketItem {
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  loanId: string;
  loanType: 'DF' | 'SP';
  daysOverdue: number;
  amountOverdue: number;
  dueDate: string;
}

export interface AgingBucketGroup {
  labelEn: string;
  labelTe: string;
  range: string;
  count: number;
  amount: number;
  items: AgingBucketItem[];
}

export interface AgingBucketsSummary {
  healthy: AgingBucketGroup;     // 0-5 days
  minorDelay: AgingBucketGroup;  // 6-12 days
  warning: AgingBucketGroup;     // 13-30 days
  critical: AgingBucketGroup;    // >30 days
  totalOverdueAmount: number;
  totalOverdueCount: number;
}

export interface LeakingBorrower {
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  loanId: string;
  loanType: 'DF' | 'SP';
  partialCount: number;
  missedCount: number;
  totalDeficit: number;
  totalScheduled: number;
  totalPaid: number;
  reasonsEn: string[];
  reasonsTe: string[];
}

export interface BorrowerExposure {
  borrowerId: string;
  borrowerName: string;
  borrowerPhone: string;
  outstandingBalance: number;
  percentageOfTotal: number;
  activeLoanCount: number;
}

export interface ConcentrationRisk {
  topBorrowerPercent: number;
  top3BorrowersPercent: number;
  top5BorrowersPercent: number;
  riskLevel: 'healthy' | 'moderate' | 'high';
  totalActiveDebt: number;
  topBorrowers: BorrowerExposure[];
}

export interface EodDisbursementItem {
  loanId: string;
  borrowerName: string;
  borrowerPhone: string;
  principalAmount: number;
  loanType: 'DF' | 'SP';
}

export interface EodSummary {
  date: string;
  targetExpected: number;
  actualCollected: number;
  shortfall: number;
  efficiencyPercent: number;
  headcount: {
    paid: number;
    partial: number;
    missed: number;
    pending: number;
    total: number;
  };
  disbursements: {
    count: number;
    totalPrincipal: number;
    loans: EodDisbursementItem[];
  };
  netCashFlow: number; // actualCollected - totalPrincipal
}

export interface PortfolioMetrics {
  totalCapitalDeployed: number;
  totalOutstandingBalance: number;
  totalCollected: number;
  totalProjectedYield: number;
  activeLoansCount: number;
  completedLoansCount: number;
  activeBorrowersCount: number;
}

/**
 * 1. Calculate overall portfolio health aggregates
 */
export function calculatePortfolioMetrics(
  loans: Loan[],
  borrowers: Borrower[]
): PortfolioMetrics {
  const activeLoans = loans.filter((l) => l.status === 'active');
  const completedLoans = loans.filter((l) => l.status === 'completed');

  const totalCapitalDeployed = activeLoans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalOutstandingBalance = activeLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const totalCollected = loans.reduce((sum, l) => sum + (l.totalCollected || 0), 0);

  // Projected yield: For DF = totalRepaymentAmount - principal; for SP = (principal * rate% * 12) or expected interest
  const totalProjectedYield = activeLoans.reduce((sum, l) => {
    if (l.loanType === 'DF' && l.totalRepaymentAmount) {
      return sum + Math.max(0, l.totalRepaymentAmount - l.principalAmount);
    }
    if (l.loanType === 'SP' && l.interestRateMonthly) {
      // Annualized baseline projected yield: (principal * rate / 100) * 12
      return sum + Math.round((l.principalAmount * (l.interestRateMonthly / 100)) * 12);
    }
    return sum;
  }, 0);

  // Active borrowers with active loans
  const activeBorrowerIds = new Set(activeLoans.map((l) => l.borrowerId));
  const activeBorrowersCount = borrowers.filter(
    (b) => b.isActive && activeBorrowerIds.has(b.id)
  ).length;

  return {
    totalCapitalDeployed,
    totalOutstandingBalance,
    totalCollected,
    totalProjectedYield,
    activeLoansCount: activeLoans.length,
    completedLoansCount: completedLoans.length,
    activeBorrowersCount,
  };
}

/**
 * 2. Overdue Aging Analysis (Custom Buckets: 0-5d, 6-12d, 13-30d, >30d)
 */
export function calculateAgingBuckets(
  schedules: PaymentSchedule[],
  loans: Loan[],
  borrowers: Borrower[],
  todayStr: string
): AgingBucketsSummary {
  const loanMap = new Map(loans.map((l) => [l.id, l]));
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  const healthyItems: AgingBucketItem[] = [];
  const minorDelayItems: AgingBucketItem[] = [];
  const warningItems: AgingBucketItem[] = [];
  const criticalItems: AgingBucketItem[] = [];

  for (const schedule of schedules) {
    // Only inspect overdue installments on active loans that are not fully paid
    if (schedule.status === 'paid') continue;
    if (schedule.dueDate > todayStr) continue;

    const loan = loanMap.get(schedule.loanId);
    if (!loan || loan.status !== 'active') continue;

    const borrower = borrowerMap.get(schedule.borrowerId);
    const amountOverdue = Math.max(0, schedule.amountDue - (schedule.amountPaid || 0));
    if (amountOverdue <= 0) continue;

    const daysOverdue = Math.max(0, getDaysDifference(schedule.dueDate, todayStr));

    const item: AgingBucketItem = {
      borrowerId: schedule.borrowerId,
      borrowerName: borrower?.name || 'Unknown',
      borrowerPhone: borrower?.phone || '',
      loanId: schedule.loanId,
      loanType: loan.loanType,
      daysOverdue,
      amountOverdue,
      dueDate: schedule.dueDate,
    };

    if (daysOverdue >= 0 && daysOverdue <= 5) {
      healthyItems.push(item);
    } else if (daysOverdue >= 6 && daysOverdue <= 12) {
      minorDelayItems.push(item);
    } else if (daysOverdue >= 13 && daysOverdue <= 30) {
      warningItems.push(item);
    } else {
      criticalItems.push(item);
    }
  }

  const sumAmount = (items: AgingBucketItem[]) => items.reduce((s, i) => s + i.amountOverdue, 0);

  const totalOverdueAmount =
    sumAmount(healthyItems) +
    sumAmount(minorDelayItems) +
    sumAmount(warningItems) +
    sumAmount(criticalItems);

  const totalOverdueCount =
    healthyItems.length + minorDelayItems.length + warningItems.length + criticalItems.length;

  return {
    healthy: {
      labelEn: 'Healthy / Current',
      labelTe: 'ఆరోగ్యకరం / సాధారణం',
      range: '0–5 days',
      count: healthyItems.length,
      amount: sumAmount(healthyItems),
      items: healthyItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    },
    minorDelay: {
      labelEn: 'Minor Delay',
      labelTe: 'స్వల్ప ఆలస్యం',
      range: '6–12 days',
      count: minorDelayItems.length,
      amount: sumAmount(minorDelayItems),
      items: minorDelayItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    },
    warning: {
      labelEn: 'Warning',
      labelTe: 'హెచ్చరిక / ప్రమాదం',
      range: '13–30 days',
      count: warningItems.length,
      amount: sumAmount(warningItems),
      items: warningItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    },
    critical: {
      labelEn: 'Critical / Hard Default',
      labelTe: 'తీవ్ర లోటు / డిఫాల్ట్',
      range: '>30 days',
      count: criticalItems.length,
      amount: sumAmount(criticalItems),
      items: criticalItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    },
    totalOverdueAmount,
    totalOverdueCount,
  };
}

/**
 * 3. Leaking Buckets Detector (Early Warning for Chronic Under-Payers)
 * Flags borrowers with >=3 partial payments OR >=2 missed payments on active loans.
 */
export function detectLeakingBorrowers(
  schedules: PaymentSchedule[],
  loans: Loan[],
  borrowers: Borrower[],
  todayStr: string
): LeakingBorrower[] {
  const loanMap = new Map(loans.map((l) => [l.id, l]));
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  // Group due schedules by active loan
  const loanSchedulesMap = new Map<string, PaymentSchedule[]>();
  for (const s of schedules) {
    if (s.dueDate > todayStr) continue; // Only past or due schedules
    const loan = loanMap.get(s.loanId);
    if (!loan || loan.status !== 'active') continue;

    if (!loanSchedulesMap.has(s.loanId)) {
      loanSchedulesMap.set(s.loanId, []);
    }
    loanSchedulesMap.get(s.loanId)!.push(s);
  }

  const leakingList: LeakingBorrower[] = [];

  for (const [loanId, loanSchedules] of loanSchedulesMap.entries()) {
    const loan = loanMap.get(loanId)!;
    const borrower = borrowerMap.get(loan.borrowerId);
    if (!borrower || !borrower.isActive) continue;

    let partialCount = 0;
    let missedCount = 0;
    let totalDeficit = 0;
    let totalScheduled = 0;
    let totalPaid = 0;

    for (const s of loanSchedules) {
      totalScheduled += s.amountDue;
      totalPaid += s.amountPaid || 0;

      if (s.status === 'partial') {
        partialCount++;
        totalDeficit += Math.max(0, s.amountDue - (s.amountPaid || 0));
      } else if (s.status === 'missed') {
        missedCount++;
        totalDeficit += s.amountDue;
      }
    }

    // Flagging Condition: >=3 partial payments OR >=2 missed payments
    if (partialCount >= 3 || missedCount >= 2) {
      const reasonsEn: string[] = [];
      const reasonsTe: string[] = [];

      if (partialCount >= 3) {
        reasonsEn.push(`${partialCount} partial payments recorded`);
        reasonsTe.push(`${partialCount} పాక్షిక చెల్లింపులు నమోదయ్యాయి`);
      }
      if (missedCount >= 2) {
        reasonsEn.push(`${missedCount} missed installments`);
        reasonsTe.push(`${missedCount} వాయిదాలు తప్పాయి`);
      }

      leakingList.push({
        borrowerId: borrower.id,
        borrowerName: borrower.name,
        borrowerPhone: borrower.phone,
        loanId: loan.id,
        loanType: loan.loanType,
        partialCount,
        missedCount,
        totalDeficit,
        totalScheduled,
        totalPaid,
        reasonsEn,
        reasonsTe,
      });
    }
  }

  // Sort by highest uncollected deficit descending
  return leakingList.sort((a, b) => b.totalDeficit - a.totalDeficit);
}

/**
 * 4. Capital Concentration Risk Radar
 * Analyzes top borrower debt exposure against total active debt.
 */
export function calculateConcentrationRisk(
  loans: Loan[],
  borrowers: Borrower[]
): ConcentrationRisk {
  const activeLoans = loans.filter((l) => l.status === 'active');
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  const borrowerDebtMap = new Map<string, { outstanding: number; count: number }>();

  for (const loan of activeLoans) {
    const existing = borrowerDebtMap.get(loan.borrowerId) || { outstanding: 0, count: 0 };
    borrowerDebtMap.set(loan.borrowerId, {
      outstanding: existing.outstanding + loan.outstandingBalance,
      count: existing.count + 1,
    });
  }

  const totalActiveDebt = Array.from(borrowerDebtMap.values()).reduce(
    (sum, val) => sum + val.outstanding,
    0
  );

  const exposures: BorrowerExposure[] = [];

  for (const [borrowerId, data] of borrowerDebtMap.entries()) {
    const borrower = borrowerMap.get(borrowerId);
    const percentage = totalActiveDebt > 0 ? (data.outstanding / totalActiveDebt) * 100 : 0;

    exposures.push({
      borrowerId,
      borrowerName: borrower?.name || 'Unknown',
      borrowerPhone: borrower?.phone || '',
      outstandingBalance: data.outstanding,
      percentageOfTotal: Math.round(percentage * 10) / 10,
      activeLoanCount: data.count,
    });
  }

  // Sort descending by outstanding balance
  exposures.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  const top1Amount = exposures[0]?.outstandingBalance || 0;
  const top3Amount = exposures.slice(0, 3).reduce((sum, b) => sum + b.outstandingBalance, 0);
  const top5Amount = exposures.slice(0, 5).reduce((sum, b) => sum + b.outstandingBalance, 0);

  const topBorrowerPercent = totalActiveDebt > 0 ? Math.round((top1Amount / totalActiveDebt) * 100) : 0;
  const top3BorrowersPercent = totalActiveDebt > 0 ? Math.round((top3Amount / totalActiveDebt) * 100) : 0;
  const top5BorrowersPercent = totalActiveDebt > 0 ? Math.round((top5Amount / totalActiveDebt) * 100) : 0;

  // Risk level assignment
  let riskLevel: 'healthy' | 'moderate' | 'high' = 'healthy';
  if (top3BorrowersPercent > 50) {
    riskLevel = 'high';
  } else if (top3BorrowersPercent >= 30) {
    riskLevel = 'moderate';
  }

  return {
    topBorrowerPercent,
    top3BorrowersPercent,
    top5BorrowersPercent,
    riskLevel,
    totalActiveDebt,
    topBorrowers: exposures.slice(0, 5),
  };
}

/**
 * 5. End-of-Day (EOD) Summary Calculation
 * Daily collections reconciliation against new disbursements.
 */
export function calculateEodSummary(
  targetDateStr: string,
  schedules: PaymentSchedule[],
  loans: Loan[],
  borrowers: Borrower[]
): EodSummary {
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

  // Schedules due on target date
  const daySchedules = schedules.filter((s) => s.dueDate === targetDateStr);

  let targetExpected = 0;
  let actualCollected = 0;
  let paidCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let pendingCount = 0;

  for (const s of daySchedules) {
    targetExpected += s.amountDue;
    actualCollected += s.amountPaid || 0;

    if (s.status === 'paid') paidCount++;
    else if (s.status === 'partial') partialCount++;
    else if (s.status === 'missed') missedCount++;
    else pendingCount++;
  }

  const shortfall = Math.max(0, targetExpected - actualCollected);
  const efficiencyPercent =
    targetExpected > 0 ? Math.round((actualCollected / targetExpected) * 100) : 0;

  // Loans disbursed on target date (economic occurrence date: startDate)
  const disbursedLoans = loans.filter((l) => {
    const disbursementDate = l.startDate || l.createdAt.slice(0, 10);
    return disbursementDate === targetDateStr;
  });

  const disbursementItems: EodDisbursementItem[] = disbursedLoans.map((l) => {
    const borrower = borrowerMap.get(l.borrowerId);
    return {
      loanId: l.id,
      borrowerName: borrower?.name || 'Unknown',
      borrowerPhone: borrower?.phone || '',
      principalAmount: l.principalAmount,
      loanType: l.loanType,
    };
  });

  const totalPrincipalDisbursed = disbursementItems.reduce(
    (sum, d) => sum + d.principalAmount,
    0
  );

  const netCashFlow = actualCollected - totalPrincipalDisbursed;

  return {
    date: targetDateStr,
    targetExpected,
    actualCollected,
    shortfall,
    efficiencyPercent,
    headcount: {
      paid: paidCount,
      partial: partialCount,
      missed: missedCount,
      pending: pendingCount,
      total: daySchedules.length,
    },
    disbursements: {
      count: disbursementItems.length,
      totalPrincipal: totalPrincipalDisbursed,
      loans: disbursementItems,
    },
    netCashFlow,
  };
}

/**
 * 6. Generate WhatsApp EOD Summary Text & URL
 */
export function generateWhatsAppEodText(summary: EodSummary, isTe: boolean): string {
  const formattedDate = formatDisplayDate(summary.date, isTe);
  const sign = summary.netCashFlow >= 0 ? '+' : '';

  if (isTe) {
    return (
      `📋 *లేండ్‌ట్రాక్ • నేటి ముగింపు లెక్క (EOD Tally)*\n` +
      `📅 తేదీ: ${formattedDate}\n` +
      `------------------------------------\n` +
      `💰 *చేతిలో నికర నగదు: ${sign}${formatINR(summary.netCashFlow)}*\n\n` +
      `📥 *వసూలైన నగదు:* ${formatINR(summary.actualCollected)} (${summary.efficiencyPercent}% వసూలు రేటు)\n` +
      `📤 *కొత్తగా ఇచ్చిన రుణాలు:* ${formatINR(summary.disbursements.totalPrincipal)} (${summary.disbursements.count} రుణాలు)\n\n` +
      `🎯 *లక్ష్యం:* ${formatINR(summary.targetExpected)}\n` +
      `⚠️ *నేటి బాకీ / లోటు:* ${formatINR(summary.shortfall)}\n\n` +
      `👥 *ఖాతాదారుల వివరాలు:*\n` +
      `• పూర్తి వసూలు: ${summary.headcount.paid}\n` +
      `• పాక్షిక వసూలు: ${summary.headcount.partial}\n` +
      `• వాయిదా తప్పింది: ${summary.headcount.missed}\n` +
      `• ఇంకా రావలసినవి: ${summary.headcount.pending}\n` +
      `• మొత్తం షెడ్యూల్: ${summary.headcount.total}\n` +
      `------------------------------------\n` +
      `📌 లెడ్జర్: LendTrack`
    );
  }

  return (
    `📋 *LendTrack • End-of-Day Cash Tally*\n` +
    `📅 Date: ${formattedDate}\n` +
    `------------------------------------\n` +
    `💰 *Net Cash in Hand: ${sign}${formatINR(summary.netCashFlow)}*\n\n` +
    `📥 *Total Collected:* ${formatINR(summary.actualCollected)} (${summary.efficiencyPercent}% Efficiency)\n` +
    `📤 *New Loans Disbursed:* ${formatINR(summary.disbursements.totalPrincipal)} (${summary.disbursements.count} loans)\n\n` +
    `🎯 *Target Expected:* ${formatINR(summary.targetExpected)}\n` +
    `⚠️ *Shortfall / Deficit:* ${formatINR(summary.shortfall)}\n\n` +
    `👥 *Headcount Audit:*\n` +
    `• Fully Paid: ${summary.headcount.paid}\n` +
    `• Partial: ${summary.headcount.partial}\n` +
    `• Missed: ${summary.headcount.missed}\n` +
    `• Pending: ${summary.headcount.pending}\n` +
    `• Total Scheduled: ${summary.headcount.total}\n` +
    `------------------------------------\n` +
    `📌 Generated via LendTrack`
  );
}

export function openWhatsAppEodSummary(summary: EodSummary, isTe: boolean): void {
  const message = generateWhatsAppEodText(summary, isTe);
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}
