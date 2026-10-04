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
    await habitRepository.update(habit);
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
