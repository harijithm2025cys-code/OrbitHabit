import { describe, it, expect } from 'vitest';
import { calculateStreak, get7DayDotTrail } from '../core/services/streakService';
import { Habit } from '../core/types/habit';
import { HabitLog } from '../core/types/log';
import { getTodayString, addDays } from '../core/utils/date';

describe('Streak Service Algorithm', () => {
  const today = getTodayString();
  const yesterday = addDays(today, -1);
  const dayBeforeYesterday = addDays(today, -2);
  const threeDaysAgo = addDays(today, -3);

  const baseHabit: Habit = {
    id: 'h_test',
    name: 'Daily Test Habit',
    icon: '⚡',
    color: '#00f0ff',
    type: 'check',
    target_value: 1,
    unit: 'done',
    repeat_days: [0, 1, 2, 3, 4, 5, 6], // Everyday
    created_at: 1000,
    archived: 0
  };

  it('returns 0 streaks for empty logs', () => {
    const res = calculateStreak(baseHabit, []);
    expect(res.currentStreak).toBe(0);
    expect(res.bestStreak).toBe(0);
  });

  it('calculates 3-day consecutive streak including today', () => {
    const logs: HabitLog[] = [
      { id: '1', habit_id: 'h_test', date: threeDaysAgo, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      { id: '2', habit_id: 'h_test', date: dayBeforeYesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      { id: '3', habit_id: 'h_test', date: yesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      { id: '4', habit_id: 'h_test', date: today, progress: 1, completed: 1, completed_at: null, source: 'manual' }
    ];

    const res = calculateStreak(baseHabit, logs);
    expect(res.currentStreak).toBe(4);
    expect(res.bestStreak).toBe(4);
  });

  it('preserves current streak if today is not completed yet but yesterday was completed', () => {
    const logs: HabitLog[] = [
      { id: '1', habit_id: 'h_test', date: dayBeforeYesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      { id: '2', habit_id: 'h_test', date: yesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' }
    ];

    const res = calculateStreak(baseHabit, logs);
    expect(res.currentStreak).toBe(2);
  });

  it('breaks streak when a scheduled day is missed in between', () => {
    const logs: HabitLog[] = [
      { id: '1', habit_id: 'h_test', date: threeDaysAgo, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      // dayBeforeYesterday missed!
      { id: '3', habit_id: 'h_test', date: yesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' },
      { id: '4', habit_id: 'h_test', date: today, progress: 1, completed: 1, completed_at: null, source: 'manual' }
    ];

    const res = calculateStreak(baseHabit, logs);
    expect(res.currentStreak).toBe(2); // yesterday + today
    expect(res.bestStreak).toBe(2);
  });

  it('handles rest days (non-scheduled days) without breaking the streak', () => {
    // Habit only on Mondays and Wednesdays
    const weekdayHabit: Habit = {
      ...baseHabit,
      repeat_days: [1, 3] // Monday, Wednesday
    };

    // Construct 2 scheduled completions across a week
    const logs: HabitLog[] = [
      { id: '1', habit_id: 'h_test', date: '2026-09-28', progress: 1, completed: 1, completed_at: null, source: 'manual' }, // Mon
      { id: '2', habit_id: 'h_test', date: '2026-09-30', progress: 1, completed: 1, completed_at: null, source: 'manual' }  // Wed
    ];

    const res = calculateStreak(weekdayHabit, logs);
    expect(res.bestStreak).toBe(2);
  });

  it('generates accurate 7-day dot trail', () => {
    const logs: HabitLog[] = [
      { id: '1', habit_id: 'h_test', date: yesterday, progress: 1, completed: 1, completed_at: null, source: 'manual' }
    ];

    const trail = get7DayDotTrail(baseHabit, logs, today);
    expect(trail.length).toBe(7);
    expect(trail[trail.length - 1].status).toBe('pending'); // today
    expect(trail[trail.length - 2].status).toBe('completed'); // yesterday
  });
});

