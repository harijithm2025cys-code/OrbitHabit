/**
 * Reminder calculation utilities.
 * Mirrors native Android AlarmScheduler calculation logic.
 *
 * Weekday mapping:
 * 0 = Sunday
 * 1 = Monday
 * 2 = Tuesday
 * 3 = Wednesday
 * 4 = Thursday
 * 5 = Friday
 * 6 = Saturday
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Calculates the exact upcoming trigger timestamp (in ms) for given hour, minute and weekdays.
 * @param hour 0-23
 * @param minute 0-59
 * @param weekdays array of integers (0=Sun..6=Sat)
 * @param fromDate base Date to calculate from (defaults to now)
 */
export function calculateNextTriggerMs(
  hour: number,
  minute: number,
  weekdays: number[],
  fromDate: Date = new Date()
): number {
  const targetDays = weekdays && weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6];
  const nowMs = fromDate.getTime();

  let earliestTrigger = Number.MAX_SAFE_INTEGER;

  // Scan 0 to 7 days ahead (today + next 7 days)
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(hour, minute, 0, 0);

    const candDayIndex = candidate.getDay(); // 0 = Sunday ... 6 = Saturday

    if (targetDays.includes(candDayIndex)) {
      const candMs = candidate.getTime();
      // Must be at least 2 seconds in the future
      if (candMs > nowMs + 2000) {
        if (candMs < earliestTrigger) {
          earliestTrigger = candMs;
        }
      }
    }
  }

  if (earliestTrigger === Number.MAX_SAFE_INTEGER) {
    // Fallback: 24h from now
    return nowMs + 24 * 60 * 60 * 1000;
  }

  return earliestTrigger;
}

/**
 * Maps day index (0=Sun..6=Sat) to short 3-letter day name.
 */
export function formatWeekday(dayIndex: number): string {
  return WEEKDAYS[dayIndex % 7];
}

/**
 * Formats time string HH:mm to 12-hour AM/PM format.
 */
export function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Strips volatile store enrichment fields before updating habit in database.
 */
export function stripHabitStoreFields<T extends Record<string, any>>(habit: T): Omit<T, 'today_progress' | 'today_completed' | 'streak_current' | 'streak_best'> {
  const { today_progress, today_completed, streak_current, streak_best, ...clean } = habit;
  return clean as any;
}
