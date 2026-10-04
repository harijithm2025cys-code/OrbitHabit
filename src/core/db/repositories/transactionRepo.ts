import { Transaction, DaySummary, DailyBalance } from '../../types/finance';
import { dexieDb } from '../dexieClient';
import { sqliteService } from '../sqliteClient';
import { accountRepository } from './accountRepo';

export interface ITransactionRepository {
  getAll(accountId?: string): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  getByDate(accountId: string, date: string): Promise<Transaction[]>;
  getByDateRange(accountId: string, startDate: string, endDate: string): Promise<Transaction[]>;
  create(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
  getDaySummary(accountId: string, date: string): Promise<DaySummary>;
  getDailyBalance(accountId: string, date: string): Promise<number>;
  recalculateBalances(accountId: string): Promise<void>;
}

class TransactionRepository implements ITransactionRepository {
  async getAll(accountId?: string): Promise<Transaction[]> {
    if (sqliteService.isNativeActive()) {
      let sql = 'SELECT * FROM transactions';
      const params: any[] = [];
      if (accountId) {
        sql += ' WHERE account_id = ?';
        params.push(accountId);
      }
      sql += ' ORDER BY date DESC, created_at DESC';
      return await sqliteService.query<Transaction>(sql, params);
    }

    if (accountId) {
      return await dexieDb.transactions
        .where('account_id')
        .equals(accountId)
        .reverse()
        .sortBy('date');
    }
    return await dexieDb.transactions.toCollection().reverse().sortBy('date');
  }

  async getById(id: string): Promise<Transaction | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<Transaction>(
        'SELECT * FROM transactions WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    }
    const t = await dexieDb.transactions.get(id);
    return t || null;
  }

  async getByDate(accountId: string, date: string): Promise<Transaction[]> {
    if (sqliteService.isNativeActive()) {
      return await sqliteService.query<Transaction>(
        'SELECT * FROM transactions WHERE account_id = ? AND date = ? ORDER BY created_at ASC',
        [accountId, date]
      );
    }
    return await dexieDb.transactions
      .where('[account_id+date]')
      .equals([accountId, date])
      .toArray();
  }

  async getByDateRange(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    if (sqliteService.isNativeActive()) {
      return await sqliteService.query<Transaction>(
        'SELECT * FROM transactions WHERE account_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
        [accountId, startDate, endDate]
      );
    }
    const list = await dexieDb.transactions
      .where('account_id')
      .equals(accountId)
      .toArray();
    return list
      .filter((t) => t.date >= startDate && t.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async create(transaction: Transaction): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO transactions (id, account_id, date, type, amount, category, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.id,
          transaction.account_id,
          transaction.date,
          transaction.type,
          transaction.amount,
          transaction.category,
          transaction.note,
          transaction.created_at
        ]
      );
      await this.recalculateBalances(transaction.account_id);
      return;
    }

    await dexieDb.transactions.add(transaction);
    await this.recalculateBalances(transaction.account_id);
  }

  async update(transaction: Transaction): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `UPDATE transactions SET date = ?, type = ?, amount = ?, category = ?, note = ?
         WHERE id = ?`,
        [
          transaction.date,
          transaction.type,
          transaction.amount,
          transaction.category,
          transaction.note,
          transaction.id
        ]
      );
      await this.recalculateBalances(transaction.account_id);
      return;
    }

    await dexieDb.transactions.put(transaction);
    await this.recalculateBalances(transaction.account_id);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;

    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM transactions WHERE id = ?', [id]);
      await this.recalculateBalances(existing.account_id);
      return;
    }

    await dexieDb.transactions.delete(id);
    await this.recalculateBalances(existing.account_id);
  }

  async getDailyBalance(accountId: string, date: string): Promise<number> {
    const summary = await this.getDaySummary(accountId, date);
    return summary.closing_balance;
  }

  async getDaySummary(accountId: string, date: string): Promise<DaySummary> {
    const account = await accountRepository.getById(accountId);
    const initialOpeningBalance = account?.opening_balance || 0;

    // Fetch all transactions on or before this date
    let allPriorTransactions: Transaction[] = [];
    if (sqliteService.isNativeActive()) {
      allPriorTransactions = await sqliteService.query<Transaction>(
        'SELECT * FROM transactions WHERE account_id = ? AND date <= ? ORDER BY date ASC, created_at ASC',
        [accountId, date]
      );
    } else {
      const all = await dexieDb.transactions
        .where('account_id')
        .equals(accountId)
        .toArray();
      allPriorTransactions = all
        .filter((t) => t.date <= date)
        .sort((a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at);
    }

    let runningBalance = initialOpeningBalance;
    let dayOpening = initialOpeningBalance;
    let dayIncome = 0;
    let dayExpense = 0;
    const dayTransactions: Transaction[] = [];

    for (const t of allPriorTransactions) {
      if (t.date < date) {
        if (t.type === 'income') runningBalance += t.amount;
        else runningBalance -= t.amount;
        dayOpening = runningBalance;
      } else if (t.date === date) {
        dayTransactions.push(t);
        if (t.type === 'income') {
          dayIncome += t.amount;
          runningBalance += t.amount;
        } else {
          dayExpense += t.amount;
          runningBalance -= t.amount;
        }
      }
    }

    return {
      date,
      opening_balance: dayOpening,
      total_income: dayIncome,
      total_expense: dayExpense,
      closing_balance: runningBalance,
      transactions: dayTransactions
    };
  }

  async recalculateBalances(accountId: string): Promise<void> {
    const account = await accountRepository.getById(accountId);
    if (!account) return;

    let allTransactions: Transaction[] = [];
    if (sqliteService.isNativeActive()) {
      allTransactions = await sqliteService.query<Transaction>(
        'SELECT * FROM transactions WHERE account_id = ? ORDER BY date ASC, created_at ASC',
        [accountId]
      );
    } else {
      const list = await dexieDb.transactions
        .where('account_id')
        .equals(accountId)
        .toArray();
      allTransactions = list.sort(
        (a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at
      );
    }

    // Group transactions by date
    const dateMap = new Map<string, { income: number; expense: number }>();
    for (const t of allTransactions) {
      const cur = dateMap.get(t.date) || { income: 0, expense: 0 };
      if (t.type === 'income') cur.income += t.amount;
      else cur.expense += t.amount;
      dateMap.set(t.date, cur);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    let running = account.opening_balance;

    const dailyBalancesToSave: DailyBalance[] = [];
    for (const d of sortedDates) {
      const summary = dateMap.get(d)!;
      running += summary.income - summary.expense;
      dailyBalancesToSave.push({
        date: d,
        account_id: accountId,
        closing_balance: running
      });
    }

    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM daily_balance WHERE account_id = ?', [accountId]);
      for (const item of dailyBalancesToSave) {
        await sqliteService.run(
          'INSERT INTO daily_balance (date, account_id, closing_balance) VALUES (?, ?, ?)',
          [item.date, item.account_id, item.closing_balance]
        );
      }
      return;
    }

    await dexieDb.transaction('rw', dexieDb.daily_balance, async () => {
      await dexieDb.daily_balance.where('account_id').equals(accountId).delete();
      for (const item of dailyBalancesToSave) {
        await dexieDb.daily_balance.put(item);
      }
    });
  }
}

export const transactionRepository = new TransactionRepository();
