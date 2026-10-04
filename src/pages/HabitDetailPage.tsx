import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Play,
  Navigation,
  Flame,
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  Trophy,
  Archive
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Modal } from '../components/ui/Modal';
import { useHabitStore } from '../store/useHabitStore';
import { logRepository } from '../core/db/repositories/logRepo';
import { HabitLog } from '../core/types/log';
import { formatDisplayDate, getPastDaysList, getTodayString } from '../core/utils/date';
import { get7DayDotTrail } from '../core/services/streakService';

interface HabitDetailPageProps {
  habitId?: string;
  onBack: () => void;
  onNavigate: (route: string, params?: Record<string, string>) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const HabitDetailPage: React.FC<HabitDetailPageProps> = ({
  habitId,
  onBack,
  onNavigate,
  onShowToast
}) => {
  const { habits, deleteHabit, updateHabit } = useHabitStore();
  const habit = habits.find((h) => h.id === habitId);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (habitId) {
      logRepository.getLogsForHabit(habitId).then(setLogs);
    }
  }, [habitId]);

  if (!habit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <p className="text-sm text-slate-400">Habit not found or was removed.</p>
        <NeonButton variant="secondary" size="sm" onClick={onBack}>
          Return Home
        </NeonButton>
      </div>
    );
  }

  const completedLogsCount = logs.filter((l) => l.completed === 1).length;

  // 30 days completion rate
  const past30Days = getPastDaysList(30);
  const completedIn30Days = past30Days.filter((d) =>
    logs.some((l) => l.date === d && l.completed === 1)
  ).length;
  const completionRate30 = Math.round((completedIn30Days / 30) * 100);

  const dots = get7DayDotTrail(habit, logs, getTodayString());

  const handleDelete = async () => {
    try {
      setShowDeleteConfirm(false);
      await deleteHabit(habit.id);
      if (onShowToast) onShowToast('info', `Deleted "${habit.name}"`);
      onBack();
    } catch (err) {
      console.error('Delete habit error:', err);
    }
  };

  const handleToggleArchive = async () => {
    try {
      const newArchived = habit.archived === 1 ? 0 : 1;
      await updateHabit({ ...habit, archived: newArchived });
      if (onShowToast) {
        onShowToast('info', newArchived ? `Archived "${habit.name}"` : `Restored "${habit.name}"`);
      }
      onBack();
    } catch (err) {
      console.error('Archive error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-32 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-space-800 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-[var(--text-main)]">Habit Mission</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate('edit-habit', { id: habit.id })}
            className="p-2 rounded-2xl text-[var(--text-muted)] hover:text-neon-cyan hover:bg-space-800 transition"
            aria-label="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={handleToggleArchive}
            className="p-2 rounded-2xl text-[var(--text-muted)] hover:text-neon-purple hover:bg-space-800 transition"
            aria-label="Archive"
          >
            <Archive className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-2xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-space-800 transition"
            aria-label="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Habit Mission?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Are you sure you want to permanently delete <strong className="text-[var(--text-main)] font-bold">"{habit.name}"</strong> and all its logged history and streaks?
          </p>
          <div className="flex gap-3 pt-2">
            <NeonButton variant="secondary" size="md" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </NeonButton>
            <NeonButton variant="danger" size="md" className="flex-1 font-bold bg-rose-600 hover:bg-rose-500" onClick={handleDelete}>
              Delete Habit
            </NeonButton>
          </div>
        </div>
      </Modal>

      {/* Habit Header Card with 3D Visual Aura */}
      <GlassCard glow="cyan" className="p-5 text-center space-y-3">
        <div
          className="w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto text-3xl shadow-lg transition-transform"
          style={{
            backgroundColor: `${habit.color}20`,
            borderColor: `${habit.color}60`
          }}
        >
          {habit.icon}
        </div>
        <div>
          <h2 className="text-xl font-black text-[var(--text-main)]">{habit.name}</h2>
          {habit.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs mx-auto">{habit.description}</p>
          )}
          <span className="text-[11px] text-neon-cyan font-mono capitalize block mt-1">
            {habit.type === 'check'
              ? 'Standard Check Goal'
              : `Target: ${habit.target_value} ${habit.unit} • ${habit.type}`}
          </span>
        </div>

        {/* 7-Day Trail */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-center gap-3">
          {dots.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <span className="text-[8px] font-mono text-[var(--text-dim)]">{d.dayLabel}</span>
              <div
                className={`w-3 h-3 rounded-full ${
                  d.status === 'completed'
                    ? 'bg-neon-emerald shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                    : d.status === 'pending'
                    ? 'border-2 border-neon-cyan/70 animate-pulse'
                    : d.status === 'missed'
                    ? 'bg-rose-500/40 border border-rose-500/60'
                    : 'bg-space-800'
                }`}
              />
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Metric Cards Grid (Fix E) */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <GlassCard className="p-3">
          <Flame className="w-4 h-4 text-neon-amber mx-auto mb-1" />
          <span className="text-[10px] text-[var(--text-muted)] block uppercase">Current Streak</span>
          <span className="text-sm font-extrabold font-mono text-[var(--text-main)]">
            {habit.streak_current} {habit.streak_current === 1 ? 'day' : 'days'}
          </span>
        </GlassCard>

        <GlassCard className="p-3">
          <Trophy className="w-4 h-4 text-neon-cyan mx-auto mb-1" />
          <span className="text-[10px] text-[var(--text-muted)] block uppercase">Best Streak</span>
          <span className="text-sm font-extrabold font-mono text-[var(--text-main)]">
            {habit.streak_best} {habit.streak_best === 1 ? 'day' : 'days'}
          </span>
        </GlassCard>

        <GlassCard className="p-3">
          <Calendar className="w-4 h-4 text-neon-purple mx-auto mb-1" />
          <span className="text-[10px] text-[var(--text-muted)] block uppercase">Total Done</span>
          <span className="text-sm font-extrabold font-mono text-[var(--text-main)]">
            {completedLogsCount}
          </span>
        </GlassCard>
      </div>

      {/* 30-Day Consistency Card */}
      <GlassCard className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--text-main)] uppercase font-mono">30-Day Consistency</span>
          <span className="font-mono text-neon-emerald font-bold">{completionRate30}% ({completedIn30Days}/30 days)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-space-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-emerald rounded-full"
            style={{ width: `${completionRate30}%` }}
          />
        </div>
      </GlassCard>

      {/* Action Buttons based on Habit Type */}
      <div className="space-y-2">
        {habit.type === 'timer' && (
          <NeonButton
            variant="primary"
            size="lg"
            onClick={() => onNavigate('timer-run', { id: habit.id })}
            className="w-full font-bold shadow-neon-purple"
          >
            <Play className="w-5 h-5 mr-2" /> Start Focus Timer
          </NeonButton>
        )}

        {habit.type === 'distance' && (
          <NeonButton
            variant="primary"
            size="lg"
            onClick={() => onNavigate('gps-run', { id: habit.id })}
            className="w-full font-bold shadow-neon-emerald"
          >
            <Navigation className="w-5 h-5 mr-2 text-white font-bold" /> Start GPS Live Run
          </NeonButton>
        )}

        <NeonButton
          variant="secondary"
          size="md"
          onClick={() => onNavigate('edit-habit', { id: habit.id })}
          className="w-full font-semibold"
        >
          <Edit className="w-4 h-4 mr-2 text-neon-cyan" /> Edit Habit & Reminders
        </NeonButton>
      </div>

      {/* History List */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
          Recent Log History
        </h3>
        {logs.length === 0 ? (
          <GlassCard className="p-5 text-center text-xs text-[var(--text-muted)]">
            No completed history recorded yet for this habit.
          </GlassCard>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {logs.slice(0, 15).map((l) => (
              <GlassCard key={l.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      l.completed ? 'text-neon-emerald' : 'text-[var(--text-dim)]'
                    }`}
                  />
                  <span className="text-xs font-semibold text-[var(--text-main)]">
                    {formatDisplayDate(l.date)}
                  </span>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {l.progress} {habit.unit}
                </span>
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
