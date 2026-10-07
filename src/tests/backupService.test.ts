import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupService, OrbitHabitBackupData } from '../core/services/backupService';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { NotificationService } from '../core/services/notificationService';
import { useSettingsStore } from '../store/useSettingsStore';
import { Habit } from '../core/types/habit';
import { HabitLog } from '../core/types/log';
import { Reminder } from '../core/types/reminder';
import { Account, Transaction } from '../core/types/finance';

describe('Backup Service (Export, Rollback Safety, V1 Compatibility & Reminders)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await BackupService.wipeAllData();
    useSettingsStore.getState().resetAllSettings();
  });

  it('1. export -> wipe -> import equals original (full fidelity, daily_balance matching, settings restored without PIN)', async () => {
    // 1. Setup settings (and ensure PIN is set)
    const settings = useSettingsStore.getState();
    settings.setProfile({ name: 'Captain Orbit', age: '28', focus: 'Deep Focus & Running' });
    settings.setCurrency('INR');
    settings.setTheme('amoled');
    settings.setHapticsEnabled(true);
    settings.setSoundEnabled(true);
    settings.setOnboardingCompleted(true);
    settings.setPinLock(true, '8765'); // Secret PIN

    // 2. Setup habit
    const habit: Habit = {
      id: 'h_backup_full',
      name: 'Hydration Challenge',
      icon: '💧',
      color: '#00F0FF',
      type: 'count',
      target_value: 3000,
      unit: 'ml',
      repeat_days: [1, 2, 3, 4, 5],
      created_at: 1700000000000,
      archived: 0
    };
    await habitRepository.create(habit);

    // 3. Setup habit log
    const log: HabitLog = {
      id: 'log_backup_1',
      habit_id: 'h_backup_full',
      date: '2026-10-04',
      progress: 3000,
      completed: 1,
      completed_at: 1700000050000,
      source: 'manual'
    };
    await logRepository.upsertLog(log);

    // 4. Setup reminder
    const reminder: Reminder = {
      id: 'rem_backup_1',
      habit_id: 'h_backup_full',
      title: 'Hydration Mission',
      body: 'Drink 500ml water now',
      time: '09:30',
      days: [1, 2, 3, 4, 5],
      sound: 'ringtone_1',
      vibrate: 1,
      enabled: 1,
      notif_id: 10101
    };
    await reminderRepository.create(reminder);

    // 5. Setup account and transactions
    const account: Account = {
      id: 'acc_backup_1',
      name: 'Vault Account',
      opening_balance: 1000,
      currency: 'INR'
    };
    await accountRepository.create(account);

    const tx1: Transaction = {
      id: 'tx_backup_1',
      account_id: 'acc_backup_1',
      date: '2026-10-04',
      type: 'expense',
      amount: 250,
      category: 'Supplements',
      note: 'Electrolytes',
      created_at: 1700000100000
    };
    await transactionRepository.create(tx1);

    // 6. Export JSON
    const jsonString = await BackupService.exportToJsonString();
    expect(jsonString).toContain('OrbitHabit');
    expect(jsonString).toContain('Captain Orbit');
    expect(jsonString).toContain('Hydration Challenge');
    expect(jsonString).toContain('Vault Account');

    // CRITICAL: Ensure PIN is NOT leaked in the backup
    expect(jsonString).not.toContain('8765');

    // 7. Wipe everything & reset settings to clean slate
    await BackupService.wipeAllData();
    useSettingsStore.getState().resetAllSettings();

    expect((await habitRepository.getAll(true)).length).toBe(0);
    expect((await accountRepository.getAll()).length).toBe(0);
    expect(useSettingsStore.getState().userName).not.toBe('Captain Orbit');

    // 8. Import JSON
    const importSuccess = await BackupService.importFromJsonString(jsonString);
    expect(importSuccess).toBe(true);

    // 9. Verify restored data equals original
    const restoredHabits = await habitRepository.getAll(true);
    expect(restoredHabits.length).toBe(1);
    expect(restoredHabits[0].name).toBe('Hydration Challenge');
    expect(restoredHabits[0].target_value).toBe(3000);

    const restoredLogs = await logRepository.getLogsForHabit('h_backup_full');
    expect(restoredLogs.length).toBe(1);
    expect(restoredLogs[0].progress).toBe(3000);

    const restoredReminders = await reminderRepository.getAll();
    expect(restoredReminders.length).toBe(1);
    expect(restoredReminders[0].title).toBe('Hydration Mission');
    expect(restoredReminders[0].time).toBe('09:30');

    const restoredAccounts = await accountRepository.getAll();
    expect(restoredAccounts.length).toBe(1);
    expect(restoredAccounts[0].name).toBe('Vault Account');

    const restoredTxs = await transactionRepository.getAll('acc_backup_1');
    expect(restoredTxs.length).toBe(1);
    expect(restoredTxs[0].amount).toBe(250);

    // Verify daily_balance matches financial transactions (1000 - 250 = 750)
    const closingBalance = await transactionRepository.getDailyBalance('acc_backup_1', '2026-10-04');
    expect(closingBalance).toBe(750);

    // Verify settings restored
    const restoredSettings = useSettingsStore.getState();
    expect(restoredSettings.userName).toBe('Captain Orbit');
    expect(restoredSettings.userAge).toBe('28');
    expect(restoredSettings.userFocus).toBe('Deep Focus & Running');
    expect(restoredSettings.currency).toBe('INR');
    expect(restoredSettings.theme).toBe('amoled');
    expect(restoredSettings.onboardingCompleted).toBe(true);
  });

  it('2. corrupted or failing file triggers ROLLBACK and preserves existing data', async () => {
    // 1. Seed existing data
    const existingHabit: Habit = {
      id: 'h_safe_keeper',
      name: 'Existing Habit to Keep',
      icon: '🛡️',
      color: '#A855F7',
      type: 'check',
      target_value: 1,
      unit: 'done',
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: 1000,
      archived: 0
    };
    await habitRepository.create(existingHabit);

    useSettingsStore.getState().setProfile({ name: 'Original Pilot' });

    // 2. Corrupted file 1: Not valid JSON
    await expect(BackupService.importFromJsonString('{ broken json')).rejects.toThrow();

    // Verify existing data untouched
    let habits = await habitRepository.getAll(true);
    expect(habits.length).toBe(1);
    expect(habits[0].name).toBe('Existing Habit to Keep');
    expect(useSettingsStore.getState().userName).toBe('Original Pilot');

    // 3. Corrupted file 2: Wrong app name
    const foreignBackup = JSON.stringify({
      appName: 'OtherApp',
      version: 2,
      data: { habits: [] }
    });
    await expect(BackupService.importFromJsonString(foreignBackup)).rejects.toThrow(/OrbitHabit application signature/);

    // Verify existing data untouched
    habits = await habitRepository.getAll(true);
    expect(habits.length).toBe(1);
    expect(habits[0].name).toBe('Existing Habit to Keep');

    // 4. Corrupted file 3: Error during restore operation triggers rollback
    // Mock habitRepository.create to throw on import
    const createSpy = vi.spyOn(habitRepository, 'create').mockRejectedValueOnce(new Error('Simulated SQLite Disk Failure'));

    const validLookingJson = JSON.stringify({
      appName: 'OrbitHabit',
      version: 2,
      data: {
        habits: [
          {
            id: 'h_new_fail',
            name: 'Will Fail',
            icon: '❌',
            color: '#FF0055',
            type: 'check',
            target_value: 1,
            unit: 'done',
            repeat_days: [0],
            created_at: 2000,
            archived: 0
          }
        ]
      }
    });

    await expect(BackupService.importFromJsonString(validLookingJson)).rejects.toThrow(/Previous data was safely preserved/);

    createSpy.mockRestore();

    // Verify that rollback restored the original habit
    habits = await habitRepository.getAll(true);
    expect(habits.length).toBe(1);
    expect(habits[0].name).toBe('Existing Habit to Keep');
    expect(useSettingsStore.getState().userName).toBe('Original Pilot');
  });

  it('3. version 1 file still imports cleanly (backwards compatibility)', async () => {
    const v1Backup: OrbitHabitBackupData = {
      version: 1,
      exported_at: 1690000000000,
      appName: 'OrbitHabit',
      data: {
        habits: [
          {
            id: 'h_v1_legacy',
            name: 'Legacy Habit v1',
            icon: '📜',
            color: '#3B82F6',
            type: 'check',
            target_value: 1,
            unit: 'check',
            repeat_days: [0, 6],
            created_at: 1690000000000,
            archived: 0
          }
        ],
        habit_logs: [],
        timer_sessions: [],
        runs: [],
        reminders: [],
        accounts: [
          {
            id: 'acc_v1',
            name: 'Legacy Cash',
            opening_balance: 100,
            currency: 'USD'
          }
        ],
        transactions: [],
        daily_balance: []
      }
    };

    const v1JsonString = JSON.stringify(v1Backup);
    const success = await BackupService.importFromJsonString(v1JsonString);
    expect(success).toBe(true);

    const habits = await habitRepository.getAll(true);
    expect(habits.length).toBe(1);
    expect(habits[0].name).toBe('Legacy Habit v1');

    const accounts = await accountRepository.getAll();
    expect(accounts.length).toBe(1);
    expect(accounts[0].name).toBe('Legacy Cash');
  });

  it('4. reminders are cancelled before wipe and re-armed after restore', async () => {
    const cancelSpy = vi.spyOn(NotificationService, 'cancelAllReminders').mockResolvedValue(undefined);
    const rescheduleSpy = vi.spyOn(NotificationService, 'rescheduleAllReminders').mockResolvedValue(undefined);

    const reminder: Reminder = {
      id: 'rem_rearm_test',
      habit_id: 'h_rearm',
      title: 'Morning Yoga',
      body: 'Time to stretch',
      time: '07:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      sound: 'ringtone_1',
      vibrate: 1,
      enabled: 1,
      notif_id: 8888
    };

    const backupData: OrbitHabitBackupData = {
      version: 2,
      exported_at: Date.now(),
      appName: 'OrbitHabit',
      data: {
        habits: [],
        habit_logs: [],
        timer_sessions: [],
        runs: [],
        reminders: [reminder],
        accounts: [],
        transactions: [],
        daily_balance: []
      }
    };

    const jsonString = JSON.stringify(backupData);
    await BackupService.importFromJsonString(jsonString);

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(rescheduleSpy).toHaveBeenCalledTimes(1);

    const reminders = await reminderRepository.getAll();
    expect(reminders.length).toBe(1);
    expect(reminders[0].title).toBe('Morning Yoga');
  });
});
