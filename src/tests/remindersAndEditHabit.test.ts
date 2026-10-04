import { describe, it, expect, beforeEach, vi } from 'vitest';
import { habitNotifId } from '../core/utils/id';
import { NotificationService } from '../core/services/notificationService';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { Habit } from '../core/types/habit';
import { Reminder } from '../core/types/reminder';
import { HabitLog } from '../core/types/log';
import { LocalNotifications } from '@capacitor/local-notifications';

// Mock Capacitor native methods
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android')
  },
  registerPlugin: vi.fn(() => ({
    getDeviceInfo: vi.fn(),
    requestIgnoreBatteryOptimization: vi.fn(),
    openExactAlarmSettings: vi.fn(),
    openOemBatterySettings: vi.fn(),
    isLocationEnabled: vi.fn(),
    checkLocationPermissionsDetail: vi.fn(),
    openLocationSettings: vi.fn(),
    openAppSettings: vi.fn()
  }))
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

describe('PART A: Exact Reminders & Stable Notification IDs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A1: habitNotifId produces deterministic and repeatable IDs for the same reminder and day', () => {
    const remId = 'rem_test_12345';
    const id1 = habitNotifId(remId, 0); // Sunday
    const id2 = habitNotifId(remId, 0);
    const id3 = habitNotifId(remId, 1); // Monday

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).toBeGreaterThanOrEqual(1);
    expect(id1).toBeLessThanOrEqual(2_000_000_000);
  });

  it('A2: habitNotifId generates unique slot IDs across all 7 days of the week', () => {
    const remId = 'rem_weekly_habit';
    const ids = new Set<number>();

    for (let day = 0; day <= 6; day++) {
      const id = habitNotifId(remId, day);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }

    expect(ids.size).toBe(7);
  });

  it('A3: scheduleReminder uses on: { weekday, hour, minute } with allowWhileIdle: true', async () => {
    const reminder: Reminder = {
      id: 'rem_meditation',
      habit_id: 'habit_123',
      title: 'Morning Meditation',
      body: 'Take 10 minutes to breathe',
      time: '07:30',
      days: [1, 3, 5], // Mon, Wed, Fri
      sound: 'ringtone_2.mp3',
      vibrate: 1,
      enabled: 1,
      notif_id: habitNotifId('rem_meditation', 0)
    };

    await NotificationService.scheduleReminder(reminder);

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    const callArgs = (LocalNotifications.schedule as any).mock.calls[0][0];
    const notifications = callArgs.notifications;

    expect(notifications).toHaveLength(3);

    // Mon = day 1 in our system -> weekday 2 in Capacitor
    // Wed = day 3 -> weekday 4
    // Fri = day 5 -> weekday 6
    expect(notifications[0].schedule.on).toEqual({ weekday: 2, hour: 7, minute: 30 });
    expect(notifications[0].schedule.repeats).toBe(true);
    expect(notifications[0].schedule.allowWhileIdle).toBe(true);
    expect(notifications[0].channelId).toBe('channel_ringtone_2');
    expect(notifications[0].sound).toBe('ringtone_2.mp3');

    expect(notifications[1].schedule.on.weekday).toBe(4);
    expect(notifications[2].schedule.on.weekday).toBe(6);
  });

  it('A4: Daily reminders expand to all 7 weekdays rather than unstable interval repeat', async () => {
    const dailyReminder: Reminder = {
      id: 'rem_water',
      habit_id: 'habit_water',
      title: 'Drink Water',
      body: 'Time to drink water',
      time: '09:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      sound: 'ringtone_1.mp3',
      vibrate: 1,
      enabled: 1,
      notif_id: habitNotifId('rem_water', 0)
    };

    await NotificationService.scheduleReminder(dailyReminder);

    const callArgs = (LocalNotifications.schedule as any).mock.calls[0][0];
    const notifications = callArgs.notifications;

    expect(notifications).toHaveLength(7);
    const weekdays = notifications.map((n: any) => n.schedule.on.weekday);
    expect(weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('A5: cancelReminder cancels all 7 deterministic slot IDs for the given reminder', async () => {
    const remId = 'rem_to_cancel';
    await NotificationService.cancelReminder(remId);

    expect(LocalNotifications.cancel).toHaveBeenCalledTimes(1);
    const callArgs = (LocalNotifications.cancel as any).mock.calls[0][0];
    const cancelled = callArgs.notifications.map((n: any) => n.id);

    expect(cancelled).toHaveLength(7);
    for (let day = 0; day <= 6; day++) {
      expect(cancelled).toContain(habitNotifId(remId, day));
    }
  });
});

describe('PART B: Edit Habit Data Persistence & History Preservation', () => {
  const sampleHabit: Habit = {
    id: 'habit_run_test',
    name: 'Morning Jog',
    description: 'Jog through the park',
    icon: 'Footprints',
    color: '#00F0FF',
    type: 'distance',
    target_value: 5,
    unit: 'km',
    repeat_days: [1, 2, 3, 4, 5],
    checklist_items: ['Wear shoes', 'Take water'],
    alarm_time: '06:30',
    alarm_sound: 'ringtone_3.mp3',
    created_at: 1700000000000,
    archived: 0
  };

  beforeEach(async () => {
    await habitRepository.delete(sampleHabit.id);
  });

  it('B1: creates and persists habit with all extended fields', async () => {
    await habitRepository.create(sampleHabit);
    const retrieved = await habitRepository.getById(sampleHabit.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Morning Jog');
    expect(retrieved?.description).toBe('Jog through the park');
    expect(retrieved?.type).toBe('distance');
    expect(retrieved?.target_value).toBe(5);
    expect(retrieved?.unit).toBe('km');
    expect(retrieved?.repeat_days).toEqual([1, 2, 3, 4, 5]);
    expect(retrieved?.checklist_items).toEqual(['Wear shoes', 'Take water']);
    expect(retrieved?.alarm_time).toBe('06:30');
    expect(retrieved?.alarm_sound).toBe('ringtone_3.mp3');
  });

  it('B2: updates all fields on edit including description, checklist, alarm and repeat days', async () => {
    await habitRepository.create(sampleHabit);

    const updatedHabit: Habit = {
      ...sampleHabit,
      name: 'Evening Jog & Stretch',
      description: 'Run around the track then stretch',
      target_value: 7.5,
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      checklist_items: ['Shoes', 'Water bottle', 'Stretch 5 min'],
      alarm_time: '18:00',
      alarm_sound: 'ringtone_4.mp3'
    };

    await habitRepository.update(updatedHabit);
    const retrieved = await habitRepository.getById(sampleHabit.id);

    expect(retrieved?.name).toBe('Evening Jog & Stretch');
    expect(retrieved?.description).toBe('Run around the track then stretch');
    expect(retrieved?.target_value).toBe(7.5);
    expect(retrieved?.repeat_days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(retrieved?.checklist_items).toEqual(['Shoes', 'Water bottle', 'Stretch 5 min']);
    expect(retrieved?.alarm_time).toBe('18:00');
    expect(retrieved?.alarm_sound).toBe('ringtone_4.mp3');
  });

  it('B3: editing habit preserves streak logs and history', async () => {
    await habitRepository.create(sampleHabit);

    // Create past completion logs
    const log1: HabitLog = {
      id: 'log_day_1',
      habit_id: sampleHabit.id,
      date: '2026-10-01',
      progress: 5,
      completed: 1,
      completed_at: 1700100000000,
      source: 'manual'
    };
    const log2: HabitLog = {
      id: 'log_day_2',
      habit_id: sampleHabit.id,
      date: '2026-10-02',
      progress: 5,
      completed: 1,
      completed_at: 1700186400000,
      source: 'gps'
    };

    await logRepository.upsertLog(log1);
    await logRepository.upsertLog(log2);

    // Now edit the habit
    await habitRepository.update({
      ...sampleHabit,
      name: 'Morning Jog (Updated Target)',
      target_value: 10
    });

    // Verify logs are completely intact
    const logs = await logRepository.getLogsForHabit(sampleHabit.id);
    expect(logs).toHaveLength(2);
    expect(logs.find((l) => l.date === '2026-10-01')?.completed).toBe(1);
    expect(logs.find((l) => l.date === '2026-10-02')?.completed).toBe(1);
  });

  it('B4: reminder repository properly associates reminders with habit_id', async () => {
    const reminder: Reminder = {
      id: 'rem_linked_test',
      habit_id: sampleHabit.id,
      title: 'Run Reminder',
      body: 'Time to go for a run',
      time: '06:00',
      days: [1, 2, 3, 4, 5],
      sound: 'ringtone_1.mp3',
      vibrate: 1,
      enabled: 1,
      notif_id: habitNotifId('rem_linked_test', 0)
    };

    await reminderRepository.create(reminder);
    const habitReminders = await reminderRepository.getByHabitId(sampleHabit.id);

    expect(habitReminders).toHaveLength(1);
    expect(habitReminders[0].habit_id).toBe(sampleHabit.id);
    expect(habitReminders[0].title).toBe('Run Reminder');

    // Clean up
    await reminderRepository.delete(reminder.id);
  });
});
