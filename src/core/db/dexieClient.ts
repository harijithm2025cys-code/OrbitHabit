import Dexie, { type Table } from 'dexie';
import { Habit } from '../types/habit';
import { HabitLog, TimerSession, RunRecord } from '../types/log';
import { Reminder } from '../types/reminder';
import { Account, Transaction, DailyBalance } from '../types/finance';

// Dexie schema uses standard stringified or indexed attributes
export interface HabitDoc extends Omit<Habit, 'repeat_days'> {
  repeat_days: string; // JSON string [0-6]
}

export interface ReminderDoc extends Omit<Reminder, 'days'> {
  days: string; // JSON string [0-6]
}

export class OrbitHabitDexieDB extends Dexie {
  habits!: Table<HabitDoc, string>;
  habit_logs!: Table<HabitLog, string>;
  timer_sessions!: Table<TimerSession, string>;
  runs!: Table<RunRecord, string>;
  reminders!: Table<ReminderDoc, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  daily_balance!: Table<DailyBalance, [string, string]>; // compound key [date, account_id]

  constructor() {
    super('OrbitHabitDB');

    this.version(1).stores({
      habits: 'id, name, type, created_at, archived',
      habit_logs: 'id, habit_id, date, [habit_id+date], completed, source',
      timer_sessions: 'id, habit_id, status, start_ts',
      runs: 'id, habit_id, start_ts',
      reminders: 'id, habit_id, time, enabled, notif_id',
      accounts: 'id, name',
      transactions: 'id, account_id, date, [account_id+date], type, category, created_at',
      daily_balance: '[date+account_id], date, account_id'
    });
  }
}

export const dexieDb = new OrbitHabitDexieDB();
