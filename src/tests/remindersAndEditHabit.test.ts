import { describe, it, expect, beforeEach, vi } from 'vitest';
import { habitNotifId } from '../core/utils/id';
import { NotificationService } from '../core/services/notificationService';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { Habit } from '../core/types/habit';
import { Reminder } from '../core/types/reminder';
import { HabitLog } from '../core/types/log';
import { useHabitStore } from '../store/useHabitStore';
import { getTodayString } from '../core/utils/date';
import {
  calculateNextTriggerMs,
  formatWeekday,
  WEEKDAYS,
  stripHabitStoreFields
} from '../core/utils/reminderUtils';

const { mockNativeAlarmHelper } = vi.hoisted(() => ({
  mockNativeAlarmHelper: {
    getDeviceInfo: vi.fn().mockResolvedValue({
      manufacturer: 'vivo',
      model: 'iQOO Neo 9 Pro',
      brand: 'iqoo',
      sdkVersion: 34,
      isIgnoringBatteryOptimizations: true,
      canScheduleExactAlarms: true
    }),
    scheduleReminders: vi.fn().mockResolvedValue({ success: true, count: 1 }),
    cancelReminders: vi.fn().mockResolvedValue({ success: true }),
    listReminders: vi.fn().mockResolvedValue({ reminders: [] }),
    getPendingActions: vi.fn().mockResolvedValue({ actions: [] }),
    clearPendingActions: vi.fn().mockResolvedValue({ success: true }),
    getLastDeliveredAlarm: vi.fn().mockResolvedValue({ title: 'Morning Alarm', timeMs: 1700000000000 }),
    getNotificationLaunchHabitId: vi.fn().mockResolvedValue({ habitId: null })
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android')
  },
  registerPlugin: vi.fn(() => mockNativeAlarmHelper)
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    registerActionTypes: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    getPending: vi.fn().mockResolvedValue({ notifications: [] })
  }
}));

describe('1. Next-Occurrence Calculation', () => {
  it('1.1: schedules for today if reminder time is in the future', () => {
    // Current time: 2026-10-04 (Sunday), 10:00:00
    const fakeNow = new Date(2026, 9, 4, 10, 0, 0); // Month 9 is October (0-indexed)
    expect(fakeNow.getDay()).toBe(0); // Sunday

    // Reminder time: 14:30 today
    const nextTriggerMs = calculateNextTriggerMs(14, 30, [0, 1, 2, 3, 4, 5, 6], fakeNow);
    const triggerDate = new Date(nextTriggerMs);

    expect(triggerDate.getFullYear()).toBe(2026);
    expect(triggerDate.getMonth()).toBe(9);
    expect(triggerDate.getDate()).toBe(4);
    expect(triggerDate.getHours()).toBe(14);
    expect(triggerDate.getMinutes()).toBe(30);
    expect(triggerDate.getSeconds()).toBe(0);
    expect(triggerDate.getMilliseconds()).toBe(0);
  });

  it('1.2: schedules for tomorrow if reminder time today has already passed', () => {
    // Current time: 2026-10-04 (Sunday), 16:00:00
    const fakeNow = new Date(2026, 9, 4, 16, 0, 0);

    // Reminder time: 08:00 (already passed today)
    const nextTriggerMs = calculateNextTriggerMs(8, 0, [0, 1, 2, 3, 4, 5, 6], fakeNow);
    const triggerDate = new Date(nextTriggerMs);

    expect(triggerDate.getFullYear()).toBe(2026);
    expect(triggerDate.getMonth()).toBe(9);
    expect(triggerDate.getDate()).toBe(5); // Monday Oct 5
    expect(triggerDate.getHours()).toBe(8);
    expect(triggerDate.getMinutes()).toBe(0);
  });

  it('1.3: skips non-selected days and picks the earliest matching weekday', () => {
    // Current time: 2026-10-04 (Sunday), 12:00:00
    const fakeNow = new Date(2026, 9, 4, 12, 0, 0);

    // Reminder configured ONLY for Tuesday (2) and Thursday (4) at 09:00
    const nextTriggerMs = calculateNextTriggerMs(9, 0, [2, 4], fakeNow);
    const triggerDate = new Date(nextTriggerMs);

    // Next match should be Tuesday Oct 6
    expect(triggerDate.getDay()).toBe(2); // Tuesday
    expect(triggerDate.getDate()).toBe(6);
    expect(triggerDate.getHours()).toBe(9);
    expect(triggerDate.getMinutes()).toBe(0);
  });

  it('1.4: handles midnight (00:00) and late evening (23:59) transitions cleanly', () => {
    const fakeNow = new Date(2026, 9, 4, 23, 58, 0);

    // Reminder at 23:59: should trigger today in 1 minute
    const triggerToday = new Date(calculateNextTriggerMs(23, 59, [0], fakeNow));
    expect(triggerToday.getDate()).toBe(4);
    expect(triggerToday.getHours()).toBe(23);
    expect(triggerToday.getMinutes()).toBe(59);

    // Reminder at 00:05: should trigger tomorrow
    const triggerMidnight = new Date(calculateNextTriggerMs(0, 5, [0, 1, 2, 3, 4, 5, 6], fakeNow));
    expect(triggerMidnight.getDate()).toBe(5);
    expect(triggerMidnight.getHours()).toBe(0);
    expect(triggerMidnight.getMinutes()).toBe(5);
  });
});

describe('2. Weekday Mapping (0=Sun .. 6=Sat)', () => {
  it('2.1: conforms to JavaScript Date.getDay() (0=Sunday to 6=Saturday)', () => {
    // 2026-10-04 is Sunday -> 0
    expect(new Date(2026, 9, 4).getDay()).toBe(0);
    // 2026-10-05 is Monday -> 1
    expect(new Date(2026, 9, 5).getDay()).toBe(1);
    // 2026-10-10 is Saturday -> 6
    expect(new Date(2026, 9, 10).getDay()).toBe(6);
  });

  it('2.2: WEEKDAYS array matches standard calendar order starting with Sun', () => {
    expect(WEEKDAYS).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(formatWeekday(0)).toBe('Sun');
    expect(formatWeekday(1)).toBe('Mon');
    expect(formatWeekday(6)).toBe('Sat');
  });

  it('2.3: habitNotifId produces deterministic and unique integer IDs per weekday', () => {
    const remId = 'rem_test_abc';
    const sundayId = habitNotifId(remId, 0);
    const mondayId = habitNotifId(remId, 1);

    expect(sundayId).toBe(habitNotifId(remId, 0)); // idempotent
    expect(sundayId).not.toBe(mondayId);
    expect(sundayId).toBeGreaterThan(0);
  });
});

describe('3. Edit Habit Save Ordering & Atomicity', () => {
  const sampleHabit: Habit = {
    id: 'habit_save_order_test',
    name: 'Hydration Target',
    description: 'Drink healthy water daily',
    icon: '💧',
    color: '#00F0FF',
    type: 'count',
    target_value: 8,
    unit: 'glasses',
    repeat_days: [0, 1, 2, 3, 4, 5, 6],
    checklist_items: [],
    created_at: 1700000000000,
    archived: 0
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await habitRepository.delete(sampleHabit.id);
  });

  it('3.1: strips volatile store fields (today_progress, streak_*) before persisting', () => {
    const storeEnriched = {
      ...sampleHabit,
      today_progress: 5,
      today_completed: false,
      streak_current: 3,
      streak_best: 10
    };

    const clean = stripHabitStoreFields(storeEnriched);

    expect((clean as any).today_progress).toBeUndefined();
    expect((clean as any).today_completed).toBeUndefined();
    expect((clean as any).streak_current).toBeUndefined();
    expect((clean as any).streak_best).toBeUndefined();
    expect(clean.id).toBe(sampleHabit.id);
    expect(clean.name).toBe(sampleHabit.name);
  });

  it('3.2: preserves old reminders if new reminder scheduling fails', async () => {
    await habitRepository.create(sampleHabit);

    const oldReminder: Reminder = {
      id: 'old_rem_1',
      habit_id: sampleHabit.id,
      title: 'Drink Water (Old)',
      body: 'Time for water',
      time: '08:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      sound: 'ringtone_1',
      vibrate: 1,
      enabled: 1,
      notif_id: 1001
    };
    await reminderRepository.create(oldReminder);

    // Simulate native scheduling failure on new reminder
    mockNativeAlarmHelper.scheduleReminders.mockRejectedValueOnce(new Error('OS ALARM_MANAGER_ERROR'));

    const newReminder: Reminder = {
      id: 'new_rem_2',
      habit_id: sampleHabit.id,
      title: 'Drink Water (New)',
      body: 'Time for hydration',
      time: '12:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      sound: 'ringtone_2',
      vibrate: 1,
      enabled: 1,
      notif_id: 1002
    };

    // Attempt scheduling new reminder
    let failed = false;
    try {
      await NotificationService.scheduleReminder(newReminder);
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);

    // Old reminder in DB must STILL exist intact
    const existing = await reminderRepository.getByHabitId(sampleHabit.id);
    expect(existing).toHaveLength(1);
    expect(existing[0].id).toBe('old_rem_1');
    expect(existing[0].title).toBe('Drink Water (Old)');

    await reminderRepository.delete(oldReminder.id);
  });

  it('3.3: updates today completed status when target value changes', async () => {
    await habitRepository.create(sampleHabit);
    await useHabitStore.getState().loadHabits();

    const todayStr = getTodayString();

    // Create log with progress = 6 (not completed for target = 8)
    const log: HabitLog = {
      id: 'log_today_target_test',
      habit_id: sampleHabit.id,
      date: todayStr,
      progress: 6,
      completed: 0,
      completed_at: null,
      source: 'manual'
    };
    await logRepository.upsertLog(log);

    // Edit habit target from 8 down to 5
    await useHabitStore.getState().updateHabit({
      ...sampleHabit,
      target_value: 5
    });

    // Recomputed log: 6 >= 5 -> completed should now be 1
    const updatedLog = await logRepository.getLog(sampleHabit.id, todayStr);
    expect(updatedLog?.completed).toBe(1);
    expect(updatedLog?.completed_at).not.toBeNull();

    // Now edit target up to 10
    await useHabitStore.getState().updateHabit({
      ...sampleHabit,
      target_value: 10
    });

    // Recomputed log: 6 < 10 -> completed should now be 0
    const logAfterIncrease = await logRepository.getLog(sampleHabit.id, todayStr);
    expect(logAfterIncrease?.completed).toBe(0);
    expect(logAfterIncrease?.completed_at).toBeNull();
  });

  it('3.4: resets today progress when habit type changes', async () => {
    await habitRepository.create(sampleHabit); // type: 'count'
    await useHabitStore.getState().loadHabits();

    const todayStr = getTodayString();
    await logRepository.upsertLog({
      id: 'log_type_change_test',
      habit_id: sampleHabit.id,
      date: todayStr,
      progress: 8,
      completed: 1,
      completed_at: Date.now(),
      source: 'manual'
    });

    // Change type from 'count' to 'distance'
    await useHabitStore.getState().updateHabit({
      ...sampleHabit,
      type: 'distance',
      target_value: 5,
      unit: 'km'
    });

    const resetLog = await logRepository.getLog(sampleHabit.id, todayStr);
    expect(resetLog?.progress).toBe(0);
    expect(resetLog?.completed).toBe(0);
    expect(resetLog?.completed_at).toBeNull();
  });
});
