import { Account } from '../../types/finance';
import { dexieDb } from '../dexieClient';
import { sqliteService } from '../sqliteClient';

export interface IAccountRepository {
  getAll(): Promise<Account[]>;
  getById(id: string): Promise<Account | null>;
  create(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  delete(id: string): Promise<void>;
}

class AccountRepository implements IAccountRepository {
  async getAll(): Promise<Account[]> {
    if (sqliteService.isNativeActive()) {
      return await sqliteService.query<Account>('SELECT * FROM accounts');
    }
    return await dexieDb.accounts.toArray();
  }

  async getById(id: string): Promise<Account | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
      return rows[0] || null;
    }
    const acc = await dexieDb.accounts.get(id);
    return acc || null;
  }

  async create(account: Account): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        'INSERT INTO accounts (id, name, opening_balance, currency) VALUES (?, ?, ?, ?)',
        [account.id, account.name, account.opening_balance, account.currency]
      );
      return;
    }
    await dexieDb.accounts.add(account);
  }

  async update(account: Account): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        'UPDATE accounts SET name = ?, opening_balance = ?, currency = ? WHERE id = ?',
        [account.name, account.opening_balance, account.currency, account.id]
      );
      return;
    }
    await dexieDb.accounts.put(account);
  }

  async delete(id: string): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM accounts WHERE id = ?', [id]);
      await sqliteService.run('DELETE FROM transactions WHERE account_id = ?', [id]);
      await sqliteService.run('DELETE FROM daily_balance WHERE account_id = ?', [id]);
      return;
    }
    await dexieDb.transaction('rw', [dexieDb.accounts, dexieDb.transactions, dexieDb.daily_balance], async () => {
      await dexieDb.accounts.delete(id);
      await dexieDb.transactions.where('account_id').equals(id).delete();
      await dexieDb.daily_balance.where('account_id').equals(id).delete();
    });
  }
}

export const accountRepository = new AccountRepository();
