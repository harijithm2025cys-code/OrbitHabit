import { describe, it, expect, beforeEach } from 'vitest';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { TimerEngine } from '../core/services/timerEngine';
import { GpsTrackerEngine } from '../core/services/gpsTracker';
import { calculateStreak } from '../core/services/streakService';
import { BackupService } from '../core/services/backupService';
import { getTodayString } from '../core/utils/date';
import { Habit } from '../core/types/habit';
import { Reminder } from '../core/types/reminder';
import { Account, Transaction } from '../core/types/finance';

describe('Section 13: Final Complete End-to-End Scenario', () => {
  beforeEach(async () => {
    await BackupService.wipeAllData();
  });

  it('successfully executes the full 8-step lifecycle flow (100% offline)', async () => {
    const todayStr = getTodayString();

    // ----------------------------------------------------
    // Step 1 & 2: Create Habits ('Read 20 min', 'Walk 3 km', 'Water 8') & Reminder
    // ----------------------------------------------------
    const timerHabit: Habit = {
      id: 'h_read',
      name: 'Read 20 min',
      icon: '📚',
      color: '#a855f7',
      type: 'timer',
      target_value: 20,
      unit: 'min',
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: 100000,
      archived: 0
    };

    const gpsHabit: Habit = {
      id: 'h_walk',
      name: 'Walk 3 km',
      icon: '🏃',
      color: '#10b981',
      type: 'distance',
      target_value: 3,
      unit: 'km',
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: 100001,
      archived: 0
    };

    const countHabit: Habit = {
      id: 'h_water',
      name: 'Water 8',
      icon: '💧',
      color: '#00f0ff',
      type: 'count',
      target_value: 8,
      unit: 'glasses',
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: 100002,
      archived: 0
    };

    await habitRepository.create(timerHabit);
    await habitRepository.create(gpsHabit);
    await habitRepository.create(countHabit);

    const reminder: Reminder = {
      id: 'rem_e2e',
      habit_id: 'h_read',
      title: 'Reading Time',
      body: 'Time to read 20 minutes',
      time: '20:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      sound: 'ringtone_1.mp3',
      vibrate: 1,
      enabled: 1,
      notif_id: 888999
    };
    await reminderRepository.create(reminder);

    const allHabits = await habitRepository.getAll();
    expect(allHabits.length).toBe(3);

    // ----------------------------------------------------
    // Step 3: Run the timer to completion with simulated app kill
    // ----------------------------------------------------
    const startMs = 1000000;
    const session = await TimerEngine.startSession('h_read', 20 * 60, startMs);

    // Reopen 22 minutes later (> 20 min target)
    const reopenedMs = startMs + 22 * 60 * 1000;
    const reconcileResult = await TimerEngine.reconcileSession(session, reopenedMs);
    expect(reconcileResult.finished).toBe(true);

    const timerLog = await logRepository.getLog('h_read', todayStr);
    expect(timerLog?.completed).toBe(1);
    expect(timerLog?.source).toBe('timer');

    // ----------------------------------------------------
    // Step 4: Simulate the 3 km walk and verify auto-complete
    // ----------------------------------------------------
    const gpsTracker = new GpsTrackerEngine('h_walk', 3.0);
    const baseLat = 37.7749;
    const baseLon = -122.4194;

    gpsTracker.addCoordinate({ latitude: baseLat, longitude: baseLon, timestamp: 0, accuracy: 5 });
    gpsTracker.addCoordinate({ latitude: baseLat + 0.01, longitude: baseLon, timestamp: 350000, accuracy: 5 });
    gpsTracker.addCoordinate({ latitude: baseLat + 0.02, longitude: baseLon, timestamp: 700000, accuracy: 5 });
    gpsTracker.addCoordinate({ latitude: baseLat + 0.03, longitude: baseLon, timestamp: 1050000, accuracy: 5 }); // ~3.33 km

    expect(gpsTracker.getState().isCompleted).toBe(true);
    await gpsTracker.finishRun(true);

    const walkLog = await logRepository.getLog('h_walk', todayStr);
    expect(walkLog?.completed).toBe(1);
    expect(walkLog?.source).toBe('gps');

    // ----------------------------------------------------
    // Step 5: Add 3 transactions and verify daily balance
    // ----------------------------------------------------
    const account: Account = {
      id: 'acc_e2e_bank',
      name: 'Primary Checking',
      opening_balance: 1000,
      currency: 'USD'
    };
    await accountRepository.create(account);

    const tx1: Transaction = {
      id: 'tx_1',
      account_id: 'acc_e2e_bank',
      date: todayStr,
      type: 'income',
      amount: 250,
      category: 'Freelance',
      note: 'Payment',
      created_at: 100
    };
    const tx2: Transaction = {
      id: 'tx_2',
      account_id: 'acc_e2e_bank',
      date: todayStr,
      type: 'expense',
      amount: 40,
      category: 'Food',
      note: 'Lunch',
      created_at: 200
    };
    const tx3: Transaction = {
      id: 'tx_3',
      account_id: 'acc_e2e_bank',
      date: todayStr,
      type: 'expense',
      amount: 60,
      category: 'Transport',
      note: 'Taxi',
      created_at: 300
    };

    await transactionRepository.create(tx1);
    await transactionRepository.create(tx2);
    await transactionRepository.create(tx3);

    const daySummary = await transactionRepository.getDaySummary('acc_e2e_bank', todayStr);
    expect(daySummary.opening_balance).toBe(1000);
    expect(daySummary.total_income).toBe(250);
    expect(daySummary.total_expense).toBe(100);
    expect(daySummary.closing_balance).toBe(1150); // 1000 + 250 - 100

    // ----------------------------------------------------
    // Step 6: Check Stats show today's progress and streak
    // ----------------------------------------------------
    const readLogs = await logRepository.getLogsForHabit('h_read');
    const readStreak = calculateStreak(timerHabit, readLogs);
    expect(readStreak.currentStreak).toBe(1);

    const walkLogs = await logRepository.getLogsForHabit('h_walk');
    const walkStreak = calculateStreak(gpsHabit, walkLogs);
    expect(walkStreak.currentStreak).toBe(1);

    // ----------------------------------------------------
    // Step 7: Export backup, wipe database, import, and verify
    // ----------------------------------------------------
    const backupJson = await BackupService.exportToJsonString();
    expect(backupJson.length).toBeGreaterThan(100);

    await BackupService.wipeAllData();
    expect((await habitRepository.getAll()).length).toBe(0);

    await BackupService.importFromJsonString(backupJson);

    // Verify all records restored accurately
    const restoredHabits = await habitRepository.getAll();
    expect(restoredHabits.length).toBe(3);

    const restoredDaySummary = await transactionRepository.getDaySummary('acc_e2e_bank', todayStr);
    expect(restoredDaySummary.closing_balance).toBe(1150);

    // ----------------------------------------------------
    // Step 8: Verify reminders persist across app restarts/reboot
    // ----------------------------------------------------
    const restoredReminders = await reminderRepository.getAll();
    expect(restoredReminders.length).toBe(1);
    expect(restoredReminders[0].enabled).toBe(1);
    expect(restoredReminders[0].sound).toBe('ringtone_1.mp3');
  });
});
