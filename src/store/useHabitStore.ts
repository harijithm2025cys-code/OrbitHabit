import { create } from 'zustand';
import { Habit, HabitWithTodayStatus } from '../core/types/habit';
import { HabitLog } from '../core/types/log';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { calculateStreak } from '../core/services/streakService';
import { getTodayString } from '../core/utils/date';
import { generateId } from '../core/utils/id';

interface HabitState {
  habits: HabitWithTodayStatus[];
  isLoading: boolean;
  loadHabits: () => Promise<void>;
  createHabit: (data: Omit<Habit, 'id' | 'created_at' | 'archived'>) => Promise<void>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleCheckHabit: (habitId: string) => Promise<void>;
  incrementCountHabit: (habitId: string, delta: number) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,

  loadHabits: async () => {
    set({ isLoading: true });
    try {
      const allHabits = await habitRepository.getAll(false);
      const todayStr = getTodayString();

      const enriched: HabitWithTodayStatus[] = [];

      for (const h of allHabits) {
        const todayLog = await logRepository.getLog(h.id, todayStr);
        const allLogs = await logRepository.getLogsForHabit(h.id);
        const streak = calculateStreak(h, allLogs);

        enriched.push({
          ...h,
          today_progress: todayLog?.progress || 0,
          today_completed: todayLog?.completed === 1,
          streak_current: streak.currentStreak,
          streak_best: streak.bestStreak
        });
      }

      set({ habits: enriched, isLoading: false });
    } catch (err) {
      console.error('Failed to load habits:', err);
      set({ isLoading: false });
    }
  },

  createHabit: async (data) => {
    const newHabit: Habit = {
      ...data,
      // Use pre-generated id if provided (allows linking reminders before save),
      // otherwise generate a new one
      id: (data as any).id || generateId('habit'),
      created_at: Date.now(),
      archived: 0
    };
    await habitRepository.create(newHabit);
    await get().loadHabits();
  },

  updateHabit: async (habit) => {
    // Strip extra store fields before updateHabit
    const {
      today_progress,
      today_completed,
      streak_current,
      streak_best,
      ...cleanHabit
    } = habit as any;

    const previousHabit = await habitRepository.getById(cleanHabit.id);

    await habitRepository.update(cleanHabit);

    const todayStr = getTodayString();
    const todayLog = await logRepository.getLog(cleanHabit.id, todayStr);

    if (todayLog) {
      // If type changed, reset today's progress
      if (previousHabit && previousHabit.type !== cleanHabit.type) {
        await logRepository.upsertLog({
          ...todayLog,
          progress: 0,
          completed: 0,
          completed_at: null
        });
      } else if (cleanHabit.target_value !== undefined) {
        // When target value changes, recompute today's log completed from progress >= new target
        const isDone = todayLog.progress >= cleanHabit.target_value ? 1 : 0;
        if (todayLog.completed !== isDone) {
          await logRepository.upsertLog({
            ...todayLog,
            completed: isDone,
            completed_at: isDone ? (todayLog.completed_at || Date.now()) : null
          });
        }
      }
    }

    await get().loadHabits();
  },

  deleteHabit: async (id) => {
    await habitRepository.delete(id);
    await get().loadHabits();
  },

  toggleCheckHabit: async (habitId) => {
    const todayStr = getTodayString();
    const existing = await logRepository.getLog(habitId, todayStr);
    const newCompleted = existing?.completed === 1 ? 0 : 1;

    const log: HabitLog = {
      id: existing?.id || generateId('log'),
      habit_id: habitId,
      date: todayStr,
      progress: newCompleted,
      completed: newCompleted,
      completed_at: newCompleted ? Date.now() : null,
      source: 'manual'
    };

    await logRepository.upsertLog(log);
    await get().loadHabits();
  },

  incrementCountHabit: async (habitId, delta) => {
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;

    const todayStr = getTodayString();
    const existing = await logRepository.getLog(habitId, todayStr);
    const currentProgress = existing?.progress || 0;
    const newProgress = Math.max(0, currentProgress + delta);
    const isDone = newProgress >= habit.target_value ? 1 : 0;

    const log: HabitLog = {
      id: existing?.id || generateId('log'),
      habit_id: habitId,
      date: todayStr,
      progress: newProgress,
      completed: isDone,
      completed_at: isDone && !existing?.completed ? Date.now() : existing?.completed_at || null,
      source: 'manual'
    };

    await logRepository.upsertLog(log);
    await get().loadHabits();
  }
}));
