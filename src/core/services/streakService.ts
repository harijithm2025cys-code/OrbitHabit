import { Habit } from '../types/habit';
import { HabitLog } from '../types/log';
import { getTodayString, getDayOfWeek, addDays } from '../utils/date';

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

/**
 * Calculates current and best streaks for a habit taking repeat days into account.
 * Rest days (days not selected in repeat_days) do NOT break the streak.
 */
export function calculateStreak(habit: Habit, logs: HabitLog[]): StreakResult {
  if (!logs || logs.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Create a quick lookup for completed dates
  const completedDateMap = new Set<string>();
  for (const log of logs) {
    if (log.completed === 1) {
      completedDateMap.add(log.date);
    }
  }

  // Sort unique dates ascending
  const allLogsSorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (allLogsSorted.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const startDateStr = allLogsSorted[0].date;
  const todayStr = getTodayString();

  let maxStreak = 0;
  let runningStreak = 0;

  let iterDate = startDateStr;

  while (iterDate <= todayStr) {
    const dayOfWeek = getDayOfWeek(iterDate);
    const isScheduledDay = habit.repeat_days.includes(dayOfWeek);

    if (isScheduledDay) {
      if (completedDateMap.has(iterDate)) {
        runningStreak++;
        if (runningStreak > maxStreak) {
          maxStreak = runningStreak;
        }
      } else {
        // If it's today and not yet completed, don't reset runningStreak yet
        if (iterDate !== todayStr) {
          runningStreak = 0;
        }
      }
    }
    // Advance to next day
    iterDate = addDays(iterDate, 1);
  }

  // Calculate current streak by walking backward from today
  let currentStreak = 0;
  let checkDate = todayStr;

  // If today is scheduled and completed, count it
  const todayDow = getDayOfWeek(todayStr);
  const isTodayScheduled = habit.repeat_days.includes(todayDow);
  const isTodayDone = completedDateMap.has(todayStr);

  if (isTodayScheduled && isTodayDone) {
    currentStreak++;
    checkDate = addDays(checkDate, -1);
  } else if (!isTodayScheduled) {
    // Today is rest day, walk backward from yesterday
    checkDate = addDays(checkDate, -1);
  } else {
    // Today is scheduled but not completed yet: check if yesterday was done
    checkDate = addDays(checkDate, -1);
  }

  // Walk backward
  while (checkDate >= startDateStr) {
    const dow = getDayOfWeek(checkDate);
    const isScheduled = habit.repeat_days.includes(dow);

    if (isScheduled) {
      if (completedDateMap.has(checkDate)) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }
    // If not scheduled (rest day), continue walking backward without resetting
    checkDate = addDays(checkDate, -1);
  }

  return {
    currentStreak,
    bestStreak: Math.max(maxStreak, currentStreak)
  };
}

export interface DayDotStatus {
  date: string;
  dayLabel: string;
  status: 'completed' | 'missed' | 'rest' | 'pending';
}

/**
 * Returns the status for the past 7 days up to today.
 */
export function get7DayDotTrail(habit: Habit, logs: HabitLog[], todayStr = getTodayString()): DayDotStatus[] {
  const completedDateMap = new Set<string>();
  for (const log of logs) {
    if (log.completed === 1) {
      completedDateMap.add(log.date);
    }
  }

  const result: DayDotStatus[] = [];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let i = 6; i >= 0; i--) {
    const targetDate = addDays(todayStr, -i);
    const dow = getDayOfWeek(targetDate);
    const isScheduled = habit.repeat_days.includes(dow);
    const isDone = completedDateMap.has(targetDate);

    let status: 'completed' | 'missed' | 'rest' | 'pending';
    if (!isScheduled) {
      status = 'rest';
    } else if (isDone) {
      status = 'completed';
    } else if (targetDate === todayStr) {
      status = 'pending';
    } else {
      status = 'missed';
    }

    result.push({
      date: targetDate,
      dayLabel: dayNames[dow],
      status
    });
  }

  return result;
}

