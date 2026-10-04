import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Trash2,
  Lock,
  Edit2,
  Check
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Modal } from '../components/ui/Modal';
import { useFinanceStore } from '../store/useFinanceStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { accountRepository } from '../core/db/repositories/accountRepo';
import { formatCurrency } from '../core/utils/currency';
import { formatDisplayDate, addDays } from '../core/utils/date';

interface MoneyPageProps {
  onNavigate: (route: string, params?: Record<string, string>) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const MoneyPage: React.FC<MoneyPageProps> = ({ onNavigate, onShowToast }) => {
  const {
    accounts,
    selectedAccountId,
    selectedDate,
    setSelectedDate,
    daySummary,
    loadAccounts,
    deleteTransaction
  } = useFinanceStore();

  const { currency, pinLockEnabled, isUnlocked, unlockWithPin } = useSettingsStore();

  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
  const [newOpeningBalance, setNewOpeningBalance] = useState('');

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handlePrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = unlockWithPin(enteredPin);
    if (!success) {
      setPinError(true);
      setEnteredPin('');
    } else {
      setPinError(false);
    }
  };

  const handleSaveOpeningBalance = async () => {
    const amount = parseFloat(newOpeningBalance);
    if (isNaN(amount)) return;

    try {
      const currentAccount = accounts.find((a) => a.id === selectedAccountId);
      if (currentAccount) {
        await accountRepository.update({
          ...currentAccount,
          opening_balance: amount
        });
        await loadAccounts();
        setShowOpeningBalanceModal(false);
        if (onShowToast) onShowToast('success', 'Opening balance updated!');
      }
    } catch (err) {
      console.error('Error saving opening balance:', err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      if (onShowToast) onShowToast('info', 'Transaction removed');
    } catch (err) {
      console.error('Delete transaction error:', err);
    }
  };

  // PIN Lock Overlay (Fix 5)
  if (pinLockEnabled && !isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 max-w-sm mx-auto text-center gap-6 text-[var(--text-main)]">
        <div className="w-16 h-16 rounded-3xl bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan shadow-neon-cyan animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--text-main)]">Money Vault Locked</h2>
          <p className="text-xs text-[var(--text-muted)]">Enter your 4-digit PIN to access bank balances.</p>
        </div>
        <form onSubmit={handlePinSubmit} className="w-full space-y-4">
          <input
            type="password"
            maxLength={6}
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            placeholder="••••"
            className="w-40 mx-auto text-center text-3xl tracking-widest bg-space-800 border border-[var(--border-subtle)] rounded-2xl py-3 text-[var(--text-main)] focus:outline-none focus:border-neon-cyan font-mono"
          />
          {pinError && <p className="text-xs text-rose-500">Incorrect PIN. Try again.</p>}
          <NeonButton type="submit" variant="primary" size="md" className="w-full">
            Unlock Vault
          </NeonButton>
        </form>
      </div>
    );
  }

  const openingBalance = daySummary?.opening_balance || 0;
  const totalIncome = daySummary?.total_income || 0;
  const totalExpense = daySummary?.total_expense || 0;
  const closingBalance = daySummary?.closing_balance || 0;
  const transactions = daySummary?.transactions || [];

  return (
    <div className="flex flex-col gap-6 pb-28 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold tracking-wider text-neon-emerald uppercase">
              Manual Money Tracker
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-space-800 text-[var(--text-muted)] border border-[var(--border-subtle)]">
              100% Private & Offline
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)] mt-1">Bank Balance</h1>
        </div>

        <NeonButton
          size="icon"
          onClick={() => onNavigate('add-transaction')}
          aria-label="Add transaction"
          className="shadow-neon-emerald"
        >
          <Plus className="w-5 h-5 text-white font-bold" />
        </NeonButton>
      </header>

      {/* Date Navigator Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-space-900 border border-[var(--border-subtle)] shadow-lg">
        <button
          onClick={handlePrevDay}
          className="p-2 rounded-xl hover:bg-space-800 text-[var(--text-muted)] transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center font-bold text-sm text-[var(--text-main)]">
          {formatDisplayDate(selectedDate)}
        </div>
        <button
          onClick={handleNextDay}
          className="p-2 rounded-xl hover:bg-space-800 text-[var(--text-muted)] transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Closing Balance Card */}
      <GlassCard glow="emerald" className="p-6 text-center space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-neon-emerald/10 rounded-full blur-2xl pointer-events-none" />
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Day Closing Balance
        </span>
        <div className="text-4xl font-extrabold text-[var(--text-main)] font-mono tracking-tight">
          {formatCurrency(closingBalance, currency)}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] pt-1">
          <span>
            Opening: <span className="font-mono text-[var(--text-main)]">{formatCurrency(openingBalance, currency)}</span>
          </span>
          <button
            onClick={() => {
              setNewOpeningBalance(String(openingBalance));
              setShowOpeningBalanceModal(true);
            }}
            className="p-1 hover:text-neon-cyan transition"
            title="Edit Opening Balance"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </GlassCard>

      {/* Daily In / Out Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4 space-y-1 bg-space-900/70 border-neon-emerald/30 shadow-sm">
          <div className="flex items-center gap-1.5 text-neon-emerald text-xs font-bold uppercase">
            <ArrowDownLeft className="w-4 h-4" /> Total In
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-main)]">
            +{formatCurrency(totalIncome, currency)}
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1 bg-space-900/70 border-rose-500/30 shadow-sm">
          <div className="flex items-center gap-1.5 text-rose-500 text-xs font-bold uppercase">
            <ArrowUpRight className="w-4 h-4" /> Total Out
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text-main)]">
            -{formatCurrency(totalExpense, currency)}
          </div>
        </GlassCard>
      </div>

      {/* Transactions List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-main)]">Today's Transactions</h3>
          <button
            onClick={() => onNavigate('add-transaction')}
            className="text-xs text-neon-emerald hover:underline font-semibold"
          >
            + Add Entry
          </button>
        </div>

        {transactions.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-space-800 border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--text-dim)]">
              <Wallet className="w-6 h-6" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">No transactions recorded for this date.</p>
            <NeonButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('add-transaction')}
            >
              + Add Transaction
            </NeonButton>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <GlassCard
                key={tx.id}
                className="p-3.5 flex items-center justify-between hover:border-[var(--border-active)] transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      tx.type === 'income'
                        ? 'bg-neon-emerald/15 border-neon-emerald/40 text-neon-emerald'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                    }`}
                  >
                    {tx.type === 'income' ? (
                      <ArrowDownLeft className="w-4 h-4 font-bold" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 font-bold" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-main)]">{tx.category}</div>
                    {tx.note && <div className="text-xs text-[var(--text-muted)]">{tx.note}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono font-bold text-sm ${
                      tx.type === 'income' ? 'text-neon-emerald' : 'text-[var(--text-main)]'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount, currency)}
                  </span>
                  <button
                    onClick={() => handleDeleteTransaction(tx.id)}
                    className="p-1.5 text-[var(--text-dim)] hover:text-rose-500 rounded-lg transition"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Opening Balance Modal */}
      <Modal
        isOpen={showOpeningBalanceModal}
        onClose={() => setShowOpeningBalanceModal(false)}
        title="Set Initial Opening Balance"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[var(--text-muted)]">
            Enter your starting account balance. Daily transactions will roll forward from this amount.
          </p>
          <div className="flex items-center gap-2 bg-space-900 border border-[var(--border-subtle)] rounded-2xl px-4 py-3">
            <span className="text-lg font-bold text-neon-cyan font-mono">
              {currency === 'INR' ? '₹' : currency}
            </span>
            <input
              type="number"
              step="0.01"
              value={newOpeningBalance}
              onChange={(e) => setNewOpeningBalance(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-[var(--text-main)] font-mono text-lg font-bold focus:outline-none"
            />
          </div>
          <NeonButton
            variant="primary"
            size="lg"
            onClick={handleSaveOpeningBalance}
            className="w-full font-bold"
          >
            <Check className="w-5 h-5 mr-2" /> Save Opening Balance
          </NeonButton>
        </div>
      </Modal>
    </div>
  );
};
