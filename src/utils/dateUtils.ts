/**
 * Calendar & Date Mathematics Utility for Financial Schedules
 * Provides timezone-safe date math, leap-year calculations, Sunday detection,
 * and month-end preserved arithmetic for loans.
 */

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  // monthIndex: 0 = Jan, 1 = Feb, ..., 11 = Dec
  const daysInMonths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonths[monthIndex];
}

/**
 * Format a Date object to YYYY-MM-DD string using local calendar numbers
 */
export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string into a local Date without UTC offset skewing
 */
export function parseISODate(isoStr: string): Date {
  const cleanDate = isoStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid ISO date format: ${isoStr}. Expected YYYY-MM-DD.`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Checks if a given date string or Date object is a Sunday
 */
export function isSunday(input: Date | string): boolean {
  const date = typeof input === 'string' ? parseISODate(input) : input;
  return date.getDay() === 0;
}

/**
 * Safely adds days to an ISO date string
 */
export function addDays(isoStr: string, days: number): string {
  const date = parseISODate(isoStr);
  date.setDate(date.getDate() + days);
  return formatDateToISO(date);
}

/**
 * Robust month addition that preserves original target day where possible,
 * clamping safely to the last day of the month without rollover bugs.
 * (e.g. Jan 31 + 1 month in 2024 leap year -> Feb 29, in 2025 -> Feb 28, in 2 months -> Mar 31)
 */
export function addMonthsPreservingDay(baseDateStr: string, monthsToAdd: number): string {
  const base = parseISODate(baseDateStr);
  const originalDay = base.getDate();

  const totalMonths = base.getMonth() + monthsToAdd;
  const targetYear = base.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;

  const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonthIndex);
  const clampedDay = Math.min(originalDay, maxDaysInTargetMonth);

  const resultDate = new Date(targetYear, targetMonthIndex, clampedDay, 0, 0, 0, 0);
  return formatDateToISO(resultDate);
}

const TELUGU_MONTHS = [
  'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్',
  'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'
];

const ENGLISH_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const TELUGU_WEEKDAYS = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
const ENGLISH_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDisplayDate(isoStr: string, isTe: boolean): string {
  try {
    const d = parseISODate(isoStr);
    const day = d.getDate();
    const month = isTe ? TELUGU_MONTHS[d.getMonth()] : ENGLISH_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const weekday = isTe ? TELUGU_WEEKDAYS[d.getDay()] : ENGLISH_WEEKDAYS[d.getDay()];

    return `${day} ${month} ${year} (${weekday})`;
  } catch {
    return isoStr;
  }
}

export function formatShortDate(isoStr: string, isTe: boolean): string {
  try {
    const d = parseISODate(isoStr);
    const day = d.getDate();
    const month = isTe ? TELUGU_MONTHS[d.getMonth()] : ENGLISH_MONTHS[d.getMonth()];
    const year = d.getFullYear();

    return `${day} ${month} ${year}`;
  } catch {
    return isoStr;
  }
}

export function getWeekdayName(isoStr: string, isTe: boolean): string {
  try {
    const d = parseISODate(isoStr);
    return isTe ? TELUGU_WEEKDAYS[d.getDay()] : ENGLISH_WEEKDAYS[d.getDay()];
  } catch {
    return '';
  }
}
