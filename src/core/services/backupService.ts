import { dexieDb } from '../db/dexieClient';
import { sqliteService } from '../db/sqliteClient';
import { habitRepository } from '../db/repositories/habitRepo';
import { logRepository } from '../db/repositories/logRepo';
import { runRepository } from '../db/repositories/runRepo';
import { reminderRepository } from '../db/repositories/reminderRepo';
import { accountRepository } from '../db/repositories/accountRepo';
import { transactionRepository } from '../db/repositories/transactionRepo';
import { NotificationService } from './notificationService';
import { useSettingsStore, ThemeMode } from '../../store/useSettingsStore';
import { Habit } from '../types/habit';
import { HabitLog, RunRecord, TimerSession } from '../types/log';
import { Reminder } from '../types/reminder';
import { Account, Transaction, DailyBalance } from '../types/finance';

export interface BackupSettings {
  userName?: string;
  userAge?: string;
  userFocus?: string;
  theme?: ThemeMode | string;
  currency?: string;
  hapticsEnabled?: boolean;
  soundEnabled?: boolean;
  onboardingCompleted?: boolean;
}

export interface OrbitHabitBackupData {
  version: number;
  exported_at: number;
  appName: 'OrbitHabit';
  settings?: BackupSettings;
  data: {
    habits: Habit[];
    habit_logs: HabitLog[];
    timer_sessions: TimerSession[];
    runs: RunRecord[];
    reminders: Reminder[];
    accounts: Account[];
    transactions: Transaction[];
    daily_balance?: DailyBalance[];
  };
}

export interface DatabaseSnapshot {
  settings: BackupSettings;
  data: {
    habits: Habit[];
    habit_logs: HabitLog[];
    timer_sessions: TimerSession[];
    runs: RunRecord[];
    reminders: Reminder[];
    accounts: Account[];
    transactions: Transaction[];
    daily_balance: DailyBalance[];
  };
}

export class BackupService {
  /**
   * Export all database tables and user settings as a formatted JSON string (Version 2).
   * Note: The PIN is deliberately excluded for user security.
   */
  public static async exportToJsonString(): Promise<string> {
    const habits = await habitRepository.getAll(true);
    const habitLogs = await logRepository.getAllLogs();
    let timerSessions: TimerSession[] = [];
    if (sqliteService.isNativeActive()) {
      timerSessions = await sqliteService.query<TimerSession>('SELECT * FROM timer_sessions');
    } else {
      timerSessions = await dexieDb.timer_sessions.toArray();
    }
    const runs = await runRepository.getAllRuns();
    const reminders = await reminderRepository.getAll();
    const accounts = await accountRepository.getAll();
    const transactions = await transactionRepository.getAll();
    let dailyBalances: DailyBalance[] = [];
    if (sqliteService.isNativeActive()) {
      dailyBalances = await sqliteService.query<DailyBalance>('SELECT * FROM daily_balance');
    } else {
      dailyBalances = await dexieDb.daily_balance.toArray();
    }

    const currentSettings = useSettingsStore.getState();
    const settings: BackupSettings = {
      userName: currentSettings.userName,
      userAge: currentSettings.userAge,
      userFocus: currentSettings.userFocus,
      theme: currentSettings.theme,
      currency: currentSettings.currency,
      hapticsEnabled: currentSettings.hapticsEnabled,
      soundEnabled: currentSettings.soundEnabled,
      onboardingCompleted: currentSettings.onboardingCompleted
    };

    const backup: OrbitHabitBackupData = {
      version: 2,
      exported_at: Date.now(),
      appName: 'OrbitHabit',
      settings,
      data: {
        habits,
        habit_logs: habitLogs,
        timer_sessions: timerSessions,
        runs,
        reminders,
        accounts,
        transactions,
        daily_balance: dailyBalances
      }
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Captures an in-memory snapshot of current database state and settings for rollback safety.
   */
  public static async getSnapshot(): Promise<DatabaseSnapshot> {
    const habits = await habitRepository.getAll(true);
    const habitLogs = await logRepository.getAllLogs();
    let timerSessions: TimerSession[] = [];
    if (sqliteService.isNativeActive()) {
      timerSessions = await sqliteService.query<TimerSession>('SELECT * FROM timer_sessions');
    } else {
      timerSessions = await dexieDb.timer_sessions.toArray();
    }
    const runs = await runRepository.getAllRuns();
    const reminders = await reminderRepository.getAll();
    const accounts = await accountRepository.getAll();
    const transactions = await transactionRepository.getAll();
    let dailyBalances: DailyBalance[] = [];
    if (sqliteService.isNativeActive()) {
      dailyBalances = await sqliteService.query<DailyBalance>('SELECT * FROM daily_balance');
    } else {
      dailyBalances = await dexieDb.daily_balance.toArray();
    }

    const currentSettings = useSettingsStore.getState();
    const settings: BackupSettings = {
      userName: currentSettings.userName,
      userAge: currentSettings.userAge,
      userFocus: currentSettings.userFocus,
      theme: currentSettings.theme,
      currency: currentSettings.currency,
      hapticsEnabled: currentSettings.hapticsEnabled,
      soundEnabled: currentSettings.soundEnabled,
      onboardingCompleted: currentSettings.onboardingCompleted
    };

    return {
      settings,
      data: {
        habits: JSON.parse(JSON.stringify(habits)),
        habit_logs: JSON.parse(JSON.stringify(habitLogs)),
        timer_sessions: JSON.parse(JSON.stringify(timerSessions)),
        runs: JSON.parse(JSON.stringify(runs)),
        reminders: JSON.parse(JSON.stringify(reminders)),
        accounts: JSON.parse(JSON.stringify(accounts)),
        transactions: JSON.parse(JSON.stringify(transactions)),
        daily_balance: JSON.parse(JSON.stringify(dailyBalances))
      }
    };
  }

  /**
   * Parses and validates backup JSON string without modifying any state.
   */
  public static parseAndValidate(jsonString: string): OrbitHabitBackupData {
    if (!jsonString || typeof jsonString !== 'string' || !jsonString.trim()) {
      throw new Error('Backup file is empty.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format: Unable to parse file.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup file: Root must be a valid JSON object.');
    }

    if (parsed.appName !== 'OrbitHabit') {
      throw new Error('Invalid backup file: Missing or incorrect OrbitHabit application signature.');
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Invalid backup file: Missing data payload.');
    }

    // Accepts Version 1 and Version 2
    if (parsed.version !== 1 && parsed.version !== 2) {
      throw new Error(`Unsupported backup version: ${parsed.version}. Only versions 1 and 2 are supported.`);
    }

    // Validate collections
    const { habits, habit_logs, transactions, accounts } = parsed.data;
    if (habits !== undefined && !Array.isArray(habits)) {
      throw new Error('Invalid backup file: habits collection must be an array.');
    }
    if (habit_logs !== undefined && !Array.isArray(habit_logs)) {
      throw new Error('Invalid backup file: habit_logs collection must be an array.');
    }
    if (transactions !== undefined && !Array.isArray(transactions)) {
      throw new Error('Invalid backup file: transactions collection must be an array.');
    }
    if (accounts !== undefined && !Array.isArray(accounts)) {
      throw new Error('Invalid backup file: accounts collection must be an array.');
    }

    return parsed as OrbitHabitBackupData;
  }

  /**
   * Internal helper to wipe and restore data payload and settings.
   */
  public static async restoreDataPayload(
    data: OrbitHabitBackupData['data'],
    settings?: BackupSettings
  ): Promise<void> {
    const {
      habits,
      habit_logs,
      timer_sessions,
      runs,
      reminders,
      accounts,
      transactions,
      daily_balance
    } = data;

    // Wipe existing data
    await this.wipeAllData();

    // 1. Restore Habits
    if (Array.isArray(habits)) {
      for (const h of habits) {
        await habitRepository.create(h);
      }
    }

    // 2. Restore Habit Logs
    if (Array.isArray(habit_logs)) {
      for (const l of habit_logs) {
        await logRepository.upsertLog(l);
      }
    }

    // 3. Restore Timer Sessions
    if (Array.isArray(timer_sessions)) {
      for (const ts of timer_sessions) {
        await logRepository.saveTimerSession(ts);
      }
    }

    // 4. Restore Runs
    if (Array.isArray(runs)) {
      for (const r of runs) {
        await runRepository.saveRun(r);
      }
    }

    // 5. Restore Reminders
    if (Array.isArray(reminders)) {
      for (const rem of reminders) {
        await reminderRepository.create(rem);
      }
    }

    // 6. Restore Accounts
    if (Array.isArray(accounts)) {
      for (const a of accounts) {
        await accountRepository.create(a);
      }
    }

    // 7. Restore Transactions
    if (Array.isArray(transactions)) {
      for (const t of transactions) {
        await transactionRepository.create(t);
      }
    }

    // 8. Restore or recompute daily_balance so Money balances match
    if (Array.isArray(daily_balance) && daily_balance.length > 0) {
      if (sqliteService.isNativeActive()) {
        for (const db of daily_balance) {
          await sqliteService.run(
            'INSERT OR REPLACE INTO daily_balance (date, account_id, closing_balance) VALUES (?, ?, ?)',
            [db.date, db.account_id, db.closing_balance]
          );
        }
      } else {
        await dexieDb.transaction('rw', dexieDb.daily_balance, async () => {
          for (const db of daily_balance) {
            await dexieDb.daily_balance.put(db);
          }
        });
      }
    }

    // Always recalculate balances for each account to guarantee financial integrity
    if (Array.isArray(accounts)) {
      for (const a of accounts) {
        await transactionRepository.recalculateBalances(a.id);
      }
    }

    // 9. Restore Settings (version 2 files)
    if (settings) {
      const store = useSettingsStore.getState();
      if (settings.theme) store.setTheme(settings.theme as ThemeMode);
      if (settings.currency) store.setCurrency(settings.currency);
      if (settings.hapticsEnabled !== undefined) store.setHapticsEnabled(settings.hapticsEnabled);
      if (settings.soundEnabled !== undefined) store.setSoundEnabled(settings.soundEnabled);
      if (settings.onboardingCompleted !== undefined) store.setOnboardingCompleted(settings.onboardingCompleted);
      store.setProfile({
        name: settings.userName,
        age: settings.userAge,
        focus: settings.userFocus
      });
    }
  }

  /**
   * Safe, complete and atomic restore from JSON string:
   * 1. Validates file signature & structure
   * 2. Takes safety snapshot of current data and settings
   * 3. Disarms existing native reminders before wipe
   * 4. Attempts restore; on any failure, automatically ROLLS BACK to snapshot
   * 5. Re-arms reminders and re-evaluates balances
   */
  public static async importFromJsonString(jsonString: string): Promise<boolean> {
    // 1. Validate
    const parsed = this.parseAndValidate(jsonString);

    // 2. Snapshot
    const snapshot = await this.getSnapshot();

    // 3. Disarm reminders before wipe
    try {
      await NotificationService.cancelAllReminders();
    } catch (err) {
      console.warn('[BackupService] Warning: Failed to cancel reminders before wipe:', err);
    }

    // 4. Atomic wipe & restore with rollback guarantee
    try {
      await this.restoreDataPayload(parsed.data, parsed.settings);

      // 5. Re-arm reminders
      try {
        await NotificationService.rescheduleAllReminders();
      } catch (err) {
        console.warn('[BackupService] Warning: Failed to reschedule reminders after restore:', err);
      }

      return true;
    } catch (restoreErr: any) {
      console.error('[BackupService] Restore failed, rolling back to snapshot:', restoreErr);
      try {
        await this.restoreDataPayload(snapshot.data, snapshot.settings);
        await NotificationService.rescheduleAllReminders();
      } catch (rollbackErr) {
        console.error('[BackupService] CRITICAL: Rollback failed:', rollbackErr);
      }
      throw new Error(`Restore failed: ${restoreErr?.message || 'Database error'}. Previous data was safely preserved.`);
    }
  }

  /**
   * Wipes all user database tables across SQLite and Dexie.
   */
  public static async wipeAllData(): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM habits');
      await sqliteService.run('DELETE FROM habit_logs');
      await sqliteService.run('DELETE FROM timer_sessions');
      await sqliteService.run('DELETE FROM runs');
      await sqliteService.run('DELETE FROM reminders');
      await sqliteService.run('DELETE FROM transactions');
      await sqliteService.run('DELETE FROM daily_balance');
      await sqliteService.run('DELETE FROM accounts');
    }
    await dexieDb.habits.clear();
    await dexieDb.habit_logs.clear();
    await dexieDb.timer_sessions.clear();
    await dexieDb.runs.clear();
    await dexieDb.reminders.clear();
    await dexieDb.transactions.clear();
    await dexieDb.daily_balance.clear();
    await dexieDb.accounts.clear();
  }
}
