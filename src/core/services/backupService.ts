import { dexieDb } from '../db/dexieClient';
import { sqliteService } from '../db/sqliteClient';
import { habitRepository } from '../db/repositories/habitRepo';
import { logRepository } from '../db/repositories/logRepo';
import { runRepository } from '../db/repositories/runRepo';
import { reminderRepository } from '../db/repositories/reminderRepo';
import { accountRepository } from '../db/repositories/accountRepo';
import { transactionRepository } from '../db/repositories/transactionRepo';
import { Habit } from '../types/habit';
import { HabitLog, RunRecord, TimerSession } from '../types/log';
import { Reminder } from '../types/reminder';
import { Account, Transaction, DailyBalance } from '../types/finance';

export interface OrbitHabitBackupData {
  version: number;
  exported_at: number;
  appName: 'OrbitHabit';
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

    const backup: OrbitHabitBackupData = {
      version: 1,
      exported_at: Date.now(),
      appName: 'OrbitHabit',
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

  public static async importFromJsonString(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString) as OrbitHabitBackupData;

      // Validate signature
      if (!parsed || parsed.appName !== 'OrbitHabit' || !parsed.data) {
        throw new Error('Invalid backup file format or missing OrbitHabit signature.');
      }

      const { habits, habit_logs, timer_sessions, runs, reminders, accounts, transactions } = parsed.data;

      // Wipe first
      await this.wipeAllData();

      // Restore
      if (Array.isArray(habits)) {
        for (const h of habits) {
          await habitRepository.create(h);
        }
      }
      if (Array.isArray(habit_logs)) {
        for (const l of habit_logs) {
          await logRepository.upsertLog(l);
        }
      }
      if (Array.isArray(timer_sessions)) {
        for (const ts of timer_sessions) {
          await logRepository.saveTimerSession(ts);
        }
      }
      if (Array.isArray(runs)) {
        for (const r of runs) {
          await runRepository.saveRun(r);
        }
      }
      if (Array.isArray(reminders)) {
        for (const rem of reminders) {
          await reminderRepository.create(rem);
        }
      }
      if (Array.isArray(accounts)) {
        for (const a of accounts) {
          await accountRepository.create(a);
        }
      }
      if (Array.isArray(transactions)) {
        for (const t of transactions) {
          await transactionRepository.create(t);
        }
      }

      return true;
    } catch (err) {
      console.error('Backup import error:', err);
      throw err;
    }
  }

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
