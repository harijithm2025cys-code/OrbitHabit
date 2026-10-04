import { describe, it, expect, beforeEach } from 'vitest';
import { dexieDb } from '../core/db/dexieClient';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { logRepository } from '../core/db/repositories/logRepo';
import { runRepository } from '../core/db/repositories/runRepo';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { Habit } from '../core/types/habit';
import { HabitLog, RunRecord, TimerSession } from '../core/types/log';
import { Reminder } from '../core/types/reminder';
import { Account, Transaction } from '../core/types/finance';

describe('Offline Database Layer & Repositories', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await dexieDb.habits.clear();
    await dexieDb.habit_logs.clear();
    await dexieDb.timer_sessions.clear();
    await dexieDb.runs.clear();
    await dexieDb.reminders.clear();
    await dexieDb.accounts.clear();
    await dexieDb.transactions.clear();
    await dexieDb.daily_balance.clear();
  });

  describe('Habit Repository', () => {
    it('creates, retrieves, updates, and deletes habits', async () => {
      const habit: Habit = {
        id: 'h1',
        name: 'Drink Water',
        icon: '💧',
        color: '#00f0ff',
        type: 'count',
        target_value: 8,
        unit: 'glasses',
        repeat_days: [0, 1, 2, 3, 4, 5, 6],
        created_at: 1000,
        archived: 0
      };

      await habitRepository.create(habit);

      const fetched = await habitRepository.getById('h1');
      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('Drink Water');
      expect(fetched?.repeat_days).toEqual([0, 1, 2, 3, 4, 5, 6]);

      // Update
      const updated: Habit = { ...habit, name: 'Drink Hydration Water', target_value: 10 };
      await habitRepository.update(updated);

      const fetchedUpdated = await habitRepository.getById('h1');
      expect(fetchedUpdated?.name).toBe('Drink Hydration Water');
      expect(fetchedUpdated?.target_value).toBe(10);

      // Archive & filter
      await habitRepository.archive('h1', true);
      const activeList = await habitRepository.getAll(false);
      expect(activeList.length).toBe(0);

      const allList = await habitRepository.getAll(true);
      expect(allList.length).toBe(1);

      // Delete
      await habitRepository.delete('h1');
      const deleted = await habitRepository.getById('h1');
      expect(deleted).toBeNull();
    });
  });

  describe('Habit Log Repository & Timer Sessions', () => {
    it('upserts and queries daily habit logs', async () => {
      const log1: HabitLog = {
        id: 'log_h1_2026-10-03',
        habit_id: 'h1',
        date: '2026-10-03',
        progress: 4,
        completed: 0,
        completed_at: null,
        source: 'manual'
      };

      await logRepository.upsertLog(log1);

      const fetched = await logRepository.getLog('h1', '2026-10-03');
      expect(fetched?.progress).toBe(4);
      expect(fetched?.completed).toBe(0);

      // Complete habit
      const logCompleted: HabitLog = {
        ...log1,
        progress: 8,
        completed: 1,
        completed_at: Date.now()
      };
      await logRepository.upsertLog(logCompleted);

      const fetchedUpdated = await logRepository.getLog('h1', '2026-10-03');
      expect(fetchedUpdated?.progress).toBe(8);
      expect(fetchedUpdated?.completed).toBe(1);

      const dateLogs = await logRepository.getLogsByDate('2026-10-03');
      expect(dateLogs.length).toBe(1);
    });

    it('persists and reconciles active timer sessions', async () => {
      const session: TimerSession = {
        id: 'ts1',
        habit_id: 'h2',
        start_ts: Date.now(),
        target_seconds: 1200,
        paused_total_ms: 0,
        last_paused_at: null,
        status: 'running'
      };

      await logRepository.saveTimerSession(session);

      const active = await logRepository.getActiveTimerSession();
      expect(active?.id).toBe('ts1');
      expect(active?.status).toBe('running');

      await logRepository.clearActiveTimerSession();
      const cleared = await logRepository.getActiveTimerSession();
      expect(cleared).toBeNull();
    });
  });

  describe('GPS Run Repository', () => {
    it('saves and retrieves run routes', async () => {
      const run: RunRecord = {
        id: 'run_1',
        habit_id: 'h3',
        start_ts: 10000,
        end_ts: 11200,
        distance_m: 3050,
        duration_s: 1200,
        route_json: JSON.stringify([
          { latitude: 37.77, longitude: -122.41, timestamp: 10000, accuracy: 5 },
          { latitude: 37.78, longitude: -122.41, timestamp: 11200, accuracy: 5 }
        ])
      };

      await runRepository.saveRun(run);

      const retrieved = await runRepository.getRunById('run_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.distance_m).toBe(3050);

      const runsForHabit = await runRepository.getAllRuns('h3');
      expect(runsForHabit.length).toBe(1);
    });
  });

  describe('Reminder Repository', () => {
    it('creates, toggles, and deletes reminders', async () => {
      const rem: Reminder = {
        id: 'rem_1',
        habit_id: 'h1',
        title: 'Drink Water Reminder',
        body: 'Stay hydrated!',
        time: '14:00',
        days: [1, 2, 3, 4, 5],
        sound: 'ringtone_3.mp3',
        vibrate: 1,
        enabled: 1,
        notif_id: 12345
      };

      await reminderRepository.create(rem);

      const list = await reminderRepository.getAll();
      expect(list.length).toBe(1);
      expect(list[0].days).toEqual([1, 2, 3, 4, 5]);

      await reminderRepository.toggleEnabled('rem_1', false);
      const updated = await reminderRepository.getById('rem_1');
      expect(updated?.enabled).toBe(0);
    });
  });

  describe('Finance & Daily Balance Engine (Section 10 Acceptance Test #5)', () => {
    it('correctly calculates opening and closing balances across days and updates cascading balances on edit', async () => {
      // 1. Create account with $1,000 opening balance
      const account: Account = {
        id: 'acc_bank',
        name: 'Main Bank',
        opening_balance: 1000,
        currency: 'USD'
      };
      await accountRepository.create(account);

      // 2. Day 1: 2026-10-01
      // Income: +$500 (Salary bonus)
      // Expense: -$100 (Groceries)
      const t1: Transaction = {
        id: 't1',
        account_id: 'acc_bank',
        date: '2026-10-01',
        type: 'income',
        amount: 500,
        category: 'Salary',
        note: 'Bonus',
        created_at: 100
      };
      const t2: Transaction = {
        id: 't2',
        account_id: 'acc_bank',
        date: '2026-10-01',
        type: 'expense',
        amount: 100,
        category: 'Groceries',
        note: 'Market',
        created_at: 200
      };

      await transactionRepository.create(t1);
      await transactionRepository.create(t2);

      const day1Summary = await transactionRepository.getDaySummary('acc_bank', '2026-10-01');
      expect(day1Summary.opening_balance).toBe(1000);
      expect(day1Summary.total_income).toBe(500);
      expect(day1Summary.total_expense).toBe(100);
      expect(day1Summary.closing_balance).toBe(1400); // 1000 + 500 - 100

      // 3. Day 2: 2026-10-02
      // Income: +$200
      // Expense: -$50
      // Expense: -$250
      const t3: Transaction = {
        id: 't3',
        account_id: 'acc_bank',
        date: '2026-10-02',
        type: 'income',
        amount: 200,
        category: 'Freelance',
        note: 'Design gig',
        created_at: 300
      };
      const t4: Transaction = {
        id: 't4',
        account_id: 'acc_bank',
        date: '2026-10-02',
        type: 'expense',
        amount: 50,
        category: 'Transport',
        note: 'Fuel',
        created_at: 400
      };
      const t5: Transaction = {
        id: 't5',
        account_id: 'acc_bank',
        date: '2026-10-02',
        type: 'expense',
        amount: 250,
        category: 'Bills',
        note: 'Electricity',
        created_at: 500
      };

      await transactionRepository.create(t3);
      await transactionRepository.create(t4);
      await transactionRepository.create(t5);

      const day2Summary = await transactionRepository.getDaySummary('acc_bank', '2026-10-02');
      expect(day2Summary.opening_balance).toBe(1400); // Carried over from Day 1 closing
      expect(day2Summary.total_income).toBe(200);
      expect(day2Summary.total_expense).toBe(300);
      expect(day2Summary.closing_balance).toBe(1300); // 1400 + 200 - 300

      // 4. Test Cascade Edit: Edit Day 1 transaction t2 (change groceries expense from 100 to 200)
      const t2Updated: Transaction = { ...t2, amount: 200 };
      await transactionRepository.update(t2Updated);

      // Re-verify Day 1
      const day1SummaryAfterEdit = await transactionRepository.getDaySummary('acc_bank', '2026-10-01');
      expect(day1SummaryAfterEdit.closing_balance).toBe(1300); // 1000 + 500 - 200

      // Verify Day 2 opening and closing automatically adjusted!
      const day2SummaryAfterEdit = await transactionRepository.getDaySummary('acc_bank', '2026-10-02');
      expect(day2SummaryAfterEdit.opening_balance).toBe(1300);
      expect(day2SummaryAfterEdit.closing_balance).toBe(1200); // 1300 + 200 - 300

      // 5. Test Delete: Delete t5 ($250 bills)
      await transactionRepository.delete('t5');
      const day2SummaryAfterDelete = await transactionRepository.getDaySummary('acc_bank', '2026-10-02');
      expect(day2SummaryAfterDelete.total_expense).toBe(50);
      expect(day2SummaryAfterDelete.closing_balance).toBe(1450); // 1300 + 200 - 50
    });
  });
});
