export type TransactionType = 'income' | 'expense';

export interface Account {
  id: string;
  name: string;
  opening_balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string; // 'YYYY-MM-DD'
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  created_at: number; // timestamp in ms
}

export interface DailyBalance {
  date: string; // 'YYYY-MM-DD'
  account_id: string;
  closing_balance: number;
}

export interface DaySummary {
  date: string;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  closing_balance: number;
  transactions: Transaction[];
}
