import { create } from 'zustand';
import { Account, Transaction, DaySummary } from '../core/types/finance';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { transactionRepository } from '../core/db/repositories/transactionRepo';
import { getTodayString } from '../core/utils/date';
import { generateId } from '../core/utils/id';

interface FinanceState {
  accounts: Account[];
  selectedAccountId: string;
  selectedDate: string;
  daySummary: DaySummary | null;
  isLoading: boolean;
  loadAccounts: () => Promise<void>;
  setSelectedAccountId: (id: string) => void;
  setSelectedDate: (date: string) => void;
  loadDaySummary: (date?: string) => Promise<void>;
  addTransaction: (data: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  accounts: [],
  selectedAccountId: 'acc_default_bank',
  selectedDate: getTodayString(),
  daySummary: null,
  isLoading: false,

  loadAccounts: async () => {
    const list = await accountRepository.getAll();
    set({
      accounts: list,
      selectedAccountId: list[0]?.id || 'acc_default_bank'
    });
    await get().loadDaySummary();
  },

  setSelectedAccountId: (id) => {
    set({ selectedAccountId: id });
    get().loadDaySummary();
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadDaySummary(date);
  },

  loadDaySummary: async (date) => {
    const targetDate = date || get().selectedDate;
    const accountId = get().selectedAccountId;
    if (!accountId) return;

    set({ isLoading: true });
    try {
      const summary = await transactionRepository.getDaySummary(accountId, targetDate);
      set({ daySummary: summary, isLoading: false });
    } catch (err) {
      console.error('Failed to load day summary:', err);
      set({ isLoading: false });
    }
  },

  addTransaction: async (data) => {
    const transaction: Transaction = {
      ...data,
      id: generateId('tx'),
      created_at: Date.now()
    };
    await transactionRepository.create(transaction);
    await get().loadDaySummary();
  },

  updateTransaction: async (transaction) => {
    await transactionRepository.update(transaction);
    await get().loadDaySummary();
  },

  deleteTransaction: async (id) => {
    await transactionRepository.delete(id);
    await get().loadDaySummary();
  }
}));
