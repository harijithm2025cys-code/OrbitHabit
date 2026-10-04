import { describe, it, expect, beforeEach } from 'vitest';
import { BackupService } from '../core/services/backupService';
import { habitRepository } from '../core/db/repositories/habitRepo';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { Habit } from '../core/types/habit';
import { Account, Transaction } from '../core/types/finance';

describe('Backup Service (JSON Export, Wipe & Restore)', () => {
  beforeEach(async () => {
    await BackupService.wipeAllData();
  });

  it('exports, wipes, and fully restores all data without loss', async () => {
    // 1. Seed data
    const habit: Habit = {
      id: 'h_backup_test',
      name: 'Backup Habit',
      icon: '💎',
      color: '#00f0ff',
      type: 'check',
      target_value: 1,
      unit: 'done',
      repeat_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: 1000000,
      archived: 0
    };
    await habitRepository.create(habit);

    const account: Account = {
      id: 'acc_test',
      name: 'Test Account',
      opening_balance: 500,
      currency: 'USD'
    };
    await accountRepository.create(account);

    const tx: Transaction = {
      id: 'tx_1',
      account_id: 'acc_test',
      date: '2026-10-03',
      type: 'expense',
      amount: 45.5,
      category: 'Food',
      note: 'Dinner',
      created_at: 1000
    };
    await transactionRepository.create(tx);

    // 2. Export JSON
    const jsonString = await BackupService.exportToJsonString();
    expect(jsonString).toContain('OrbitHabit');
    expect(jsonString).toContain('Backup Habit');
    expect(jsonString).toContain('45.5');

    // 3. Wipe data
    await BackupService.wipeAllData();
    const emptyHabits = await habitRepository.getAll(true);
    expect(emptyHabits.length).toBe(0);

    // 4. Import JSON
    await BackupService.importFromJsonString(jsonString);

    // 5. Verify restored
    const restoredHabits = await habitRepository.getAll(true);
    expect(restoredHabits.length).toBe(1);
    expect(restoredHabits[0].name).toBe('Backup Habit');

    const restoredAccounts = await accountRepository.getAll();
    expect(restoredAccounts.length).toBe(1);
    expect(restoredAccounts[0].name).toBe('Test Account');

    const restoredTxs = await transactionRepository.getAll('acc_test');
    expect(restoredTxs.length).toBe(1);
    expect(restoredTxs[0].amount).toBe(45.5);
  });

  it('rejects corrupted or invalid JSON without crashing or corrupting data', async () => {
    const invalidJson = JSON.stringify({ randomKey: 'invalid data' });
    await expect(BackupService.importFromJsonString(invalidJson)).rejects.toThrow();
  });
});
