import { describe, it, expect, beforeEach } from 'vitest';
import { dexieDb } from '../core/db/dexieClient';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { Habit } from '../core/types/habit';
import { Transaction } from '../core/types/finance';

describe('Scale & Stress Tests (500 Habits & High-Volume Transactions)', () => {
  beforeEach(async () => {
    await dexieDb.habits.clear();
    await dexieDb.transactions.clear();
    await dexieDb.accounts.clear();
  });

  it('efficiently creates and retrieves 500 habits in < 500ms', async () => {
    const habits: Habit[] = [];
    for (let i = 0; i < 500; i++) {
      habits.push({
        id: `h_stress_${i}`,
        name: `Habit ${i}`,
        icon: '⚡',
        color: '#00f0ff',
        type: 'check',
        target_value: 1,
        unit: 'done',
        repeat_days: [0, 1, 2, 3, 4, 5, 6],
        created_at: Date.now() + i,
        archived: 0
      });
    }

    const t0 = performance.now();
    await dexieDb.habits.bulkAdd(
      habits.map((h) => ({ ...h, repeat_days: JSON.stringify(h.repeat_days) }))
    );
    const writeTime = performance.now() - t0;
    expect(writeTime).toBeLessThan(500);

    const t1 = performance.now();
    const all = await habitRepository.getAll(false);
    const readTime = performance.now() - t1;

    expect(all.length).toBe(500);
    expect(readTime).toBeLessThan(250);
  });

  it('efficiently processes 1,000 transactions across multiple dates', async () => {
    await accountRepository.create({
      id: 'acc_stress',
      name: 'Stress Account',
      opening_balance: 10000,
      currency: 'USD'
    });

    const txs: Transaction[] = [];
    for (let i = 0; i < 1000; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      txs.push({
        id: `tx_stress_${i}`,
        account_id: 'acc_stress',
        date: `2026-10-${day}`,
        type: i % 3 === 0 ? 'income' : 'expense',
        amount: (i % 50) + 1,
        category: 'Food',
        note: `Note ${i}`,
        created_at: 1000 + i
      });
    }

    await dexieDb.transactions.bulkAdd(txs);

    const t0 = performance.now();
    const summary = await transactionRepository.getDaySummary('acc_stress', '2026-10-15');
    const queryTime = performance.now() - t0;

    expect(queryTime).toBeLessThan(100);
    expect(typeof summary.closing_balance).toBe('number');
  });
});
