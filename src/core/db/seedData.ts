import { habitRepository } from './repositories/habitRepo';
import { accountRepository } from './repositories/accountRepo';
import { reminderRepository } from './repositories/reminderRepo';
import { logRepository } from './repositories/logRepo';
import { Account } from '../types/finance';

export async function seedInitialDataIfEmpty(): Promise<void> {
  // Ensure default primary bank account exists with 0.0 balance
  const existingAccounts = await accountRepository.getAll();
  if (existingAccounts.length === 0) {
    const defaultAccount: Account = {
      id: 'acc_default_bank',
      name: 'Primary Bank',
      opening_balance: 0.0,
      currency: 'INR'
    };
    await accountRepository.create(defaultAccount);
  }

  // One-time cleanup for existing installations that had demo habits seeded
  try {
    const allHabits = await habitRepository.getAll();
    const demoHabitNames = [
      'Drink 8 Glasses of Water',
      'Daily Mindful Reading',
      'Evening 3km Walk',
      'Morning Stretching'
    ];
    for (const h of allHabits) {
      if (demoHabitNames.includes(h.name)) {
        await habitRepository.delete(h.id);
        const logs = await logRepository.getLogsForHabit(h.id);
        for (const log of logs) {
          await logRepository.deleteLog(log.id);
        }
      }
    }

    // Clean up demo reminders
    const allReminders = await reminderRepository.getAll();
    const demoReminderTitles = ['Morning Orbit Check-in', 'Nightly Balance Update'];
    for (const r of allReminders) {
      if (demoReminderTitles.includes(r.title)) {
        await reminderRepository.delete(r.id);
      }
    }
  } catch (err) {
    console.warn('Demo cleanup skipped:', err);
  }
}

