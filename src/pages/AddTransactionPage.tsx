import React, { useState } from 'react';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Check, AlertCircle } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { getTodayString } from '../core/utils/date';
import { TransactionType } from '../core/types/finance';

interface AddTransactionPageProps {
  onBack: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const CATEGORIES_EXPENSE = ['Food', 'Transport', 'Groceries', 'Bills', 'Health', 'Fun', 'Other'];
const CATEGORIES_INCOME = ['Salary', 'Freelance', 'Investment', 'Gift', 'Refund', 'Other'];

export const AddTransactionPage: React.FC<AddTransactionPageProps> = ({ onBack, onShowToast }) => {
  const { addTransaction, selectedAccountId } = useFinanceStore();
  const { currency } = useSettingsStore();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [amountError, setAmountError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categories = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(newType === 'expense' ? CATEGORIES_EXPENSE[0] : CATEGORIES_INCOME[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAmountError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Please enter a valid positive amount.');
      return;
    }

    setIsSaving(true);
    try {
      await addTransaction({
        account_id: selectedAccountId || 'acc_default_bank',
        type,
        amount: numAmount,
        category,
        note: note.trim(),
        date
      });

      if (onShowToast) {
        onShowToast('success', `${type === 'income' ? 'Income' : 'Expense'} entry saved!`);
      }
      onBack();
    } catch (err) {
      console.error('Error adding transaction:', err);
      if (onShowToast) onShowToast('error', 'Failed to save entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28 pt-4 px-4 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-space-800/80 border border-white/10 text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white">Add Transaction</h1>
        <div className="w-9" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Income / Expense Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-space-900 border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${
              type === 'expense'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" /> Expense
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${
              type === 'income'
                ? 'bg-neon-emerald/20 text-neon-emerald border border-neon-emerald/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" /> Income
          </button>
        </div>

        {/* Amount Input */}
        <GlassCard className="p-6 text-center space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Amount
          </label>
          <div className="flex items-center justify-center gap-1 text-3xl font-bold text-white font-mono">
            <span className="text-neon-cyan">{currencySymbol}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError) setAmountError('');
              }}
              className="w-52 bg-transparent text-center text-4xl font-extrabold text-white placeholder-slate-600 focus:outline-none font-mono"
            />
          </div>
          {amountError && (
            <div className="flex items-center justify-center gap-1 text-xs text-rose-400 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{amountError}</span>
            </div>
          )}
        </GlassCard>

        {/* Category & Details */}
        <GlassCard className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    category === cat
                      ? type === 'expense'
                        ? 'bg-rose-500/20 border-rose-500 text-white shadow-sm'
                        : 'bg-neon-emerald/20 border-neon-emerald text-white shadow-sm'
                      : 'bg-space-800/80 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch with team, Groceries"
              className="w-full bg-space-800/80 border border-white/10 rounded-2xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-neon-cyan text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-space-800/80 border border-white/10 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-neon-cyan text-sm font-mono"
            />
          </div>
        </GlassCard>

        <NeonButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={isSaving}
          className="w-full font-bold shadow-neon-emerald"
        >
          <Check className="w-5 h-5 mr-2" />
          {isSaving ? 'Saving...' : 'Save Entry'}
        </NeonButton>
      </form>
    </div>
  );
};
