import React, { useEffect, useState } from 'react';
import {
  Plus,
  Flame,
  Clock,
  Navigation,
  Sparkles,
  Check,
  ChevronRight,
  ListTodo,
  AlarmClock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import logoImg from '../assets/logo.png';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { useHabitStore } from '../store/useHabitStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatDisplayDate, getTodayString, getDayOfWeek } from '../core/utils/date';
import { HabitWithTodayStatus } from '../core/types/habit';
import { get7DayDotTrail } from '../core/services/streakService';
import { logRepository } from '../core/db/repositories/logRepo';
import { HabitLog } from '../core/types/log';

interface HomePageProps {
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { habits, loadHabits, toggleCheckHabit, incrementCountHabit } = useHabitStore();
  const { userName } = useSettingsStore();
  const [habitLogsMap, setHabitLogsMap] = useState<Record<string, HabitLog[]>>({});

  const todayStr = getTodayString();
  const todayDow = getDayOfWeek(todayStr);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  // Load logs for 7-day dot trail
  useEffect(() => {
    async function loadLogs() {
      const map: Record<string, HabitLog[]> = {};
      for (const h of habits) {
        map[h.id] = await logRepository.getLogsForHabit(h.id);
      }
      setHabitLogsMap(map);
    }
    if (habits.length > 0) {
      loadLogs();
    }
  }, [habits]);

  // Greeting by hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Filter habits scheduled for today
  const todayHabits = habits.filter((h) => h.repeat_days.includes(todayDow) && h.archived === 0);
  const completedCount = todayHabits.filter((h) => h.today_completed).length;
  const completionRate =
    todayHabits.length > 0 ? Math.round((completedCount / todayHabits.length) * 100) : 0;
  const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak_current), 0);

  const handleCheckCompletion = async (habit: HabitWithTodayStatus) => {
    if (!habit.today_completed) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
        colors: [habit.color || '#00f0ff', '#8b5cf6', '#d946ef', '#10b981']
      });
    }
    await toggleCheckHabit(habit.id);
  };

  const handleCountChange = async (habitId: string, delta: number) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    await incrementCountHabit(habitId, delta);
  };

  return (
    <div className="flex flex-col gap-5 pb-32 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header & Personalized Greeting */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="OrbitHabit"
            className="w-11 h-11 rounded-2xl border border-neon-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.25)] shrink-0 object-cover"
          />
          <div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-neon-cyan uppercase">
              {formatDisplayDate(todayStr)}
            </span>
            <h1 className="text-xl font-black text-[var(--text-main)] tracking-tight">
              {getGreeting()}, {userName.split(' ')[0] || 'Explorer'}
            </h1>
          </div>
        </div>
        <button
          onClick={() => onNavigate('add-habit')}
          className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/40 text-neon-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.25)] hover:scale-105 active:scale-95 transition"
          aria-label="Add Habit"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Orbit Summary Banner */}
      <GlassCard className="relative overflow-hidden p-5 border-neon-cyan/20 bg-gradient-to-br from-space-900/90 via-space-900/60 to-space-950">
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase">
              Today's Completion
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[var(--text-main)] font-mono tracking-tight">
                {completionRate}%
              </span>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                ({completedCount}/{todayHabits.length} done)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase block">
                Best current streak
              </span>
              <span className="text-sm font-bold text-neon-amber font-mono flex items-center justify-end gap-1">
                <Flame className="w-4 h-4 text-neon-amber" />
                {maxStreak} {maxStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-space-800 mt-4 overflow-hidden relative z-10">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-emerald rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,240,255,0.5)]"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </GlassCard>

      {/* Habit List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
            Today's Missions ({todayHabits.length})
          </h2>
          <button
            onClick={() => onNavigate('habits')}
            className="text-xs font-semibold text-neon-cyan hover:underline flex items-center gap-0.5"
          >
            Manage All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayHabits.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-4 border-dashed border-[var(--border-subtle)]">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <Sparkles className="w-8 h-8 text-neon-cyan animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-main)]">No Habits Scheduled Today</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">
                Begin your orbit by launching your first habit mission.
              </p>
            </div>
            <NeonButton
              variant="primary"
              size="md"
              className="font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)]"
              onClick={() => onNavigate('add-habit')}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Your First Habit
            </NeonButton>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {todayHabits.map((habit) => {
              const dots = get7DayDotTrail(habit, habitLogsMap[habit.id] || [], todayStr);

              return (
                <GlassCard
                  key={habit.id}
                  className={`p-4 transition-all duration-300 border-l-4 cursor-pointer hover:border-[var(--border-active)] ${
                    habit.today_completed
                      ? 'bg-space-900/40 border-neon-emerald/40 opacity-90'
                      : 'bg-space-900/80 border-[var(--border-subtle)] hover:shadow-glass'
                  }`}
                  style={{ borderLeftColor: habit.color || '#00f0ff' }}
                  onClick={() => onNavigate('habit-detail', { id: habit.id })}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Icon & Title */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg border border-[var(--border-subtle)]"
                        style={{
                          backgroundColor: `${habit.color}15`,
                          color: habit.color
                        }}
                      >
                        {habit.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[var(--text-main)] text-sm truncate">
                            {habit.name}
                          </h3>
                        </div>

                        {/* Streak Subtitle */}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-bold text-neon-amber font-mono flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-neon-amber" />
                            {habit.streak_current} {habit.streak_current === 1 ? 'day' : 'days'}
                          </span>
                          {habit.type === 'timer' && (
                            <span className="text-[10px] text-neon-purple font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {habit.target_value}m target
                            </span>
                          )}
                          {habit.type === 'distance' && (
                            <span className="text-[10px] text-neon-emerald font-mono flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> {habit.target_value}km target
                            </span>
                          )}
                          {habit.type === 'checklist' && (
                            <span className="text-[10px] text-neon-cyan font-mono flex items-center gap-1">
                              <ListTodo className="w-3 h-3" /> {habit.target_value} steps
                            </span>
                          )}
                          {habit.type === 'alarm' && (
                            <span className="text-[10px] text-neon-amber font-mono flex items-center gap-1">
                              <AlarmClock className="w-3 h-3" /> {habit.alarm_time || '07:00'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Triggers */}
                    <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {habit.type === 'check' || habit.type === 'alarm' ? (
                        <button
                          onClick={() => handleCheckCompletion(habit)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                            habit.today_completed
                              ? 'bg-neon-emerald text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                              : 'bg-space-800 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-neon-cyan'
                          }`}
                        >
                          <Check className="w-5 h-5 font-bold" />
                        </button>
                      ) : habit.type === 'count' ? (
                        <div className="flex items-center gap-1.5 bg-space-800 rounded-2xl p-1 border border-[var(--border-subtle)]">
                          <button
                            onClick={() => handleCountChange(habit.id, -1)}
                            className="w-7 h-7 rounded-xl bg-space-700 text-[var(--text-muted)] font-bold hover:text-[var(--text-main)] flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold text-[var(--text-main)] px-1.5 min-w-[28px] text-center">
                            {habit.today_progress}/{habit.target_value}
                          </span>
                          <button
                            onClick={() => handleCountChange(habit.id, 1)}
                            className="w-7 h-7 rounded-xl bg-neon-cyan text-white font-bold flex items-center justify-center text-xs shadow-sm"
                          >
                            +
                          </button>
                        </div>
                      ) : habit.type === 'timer' ? (
                        <NeonButton
                          variant={habit.today_completed ? 'secondary' : 'primary'}
                          size="sm"
                          className="font-bold"
                          onClick={() => onNavigate('timer-run', { id: habit.id })}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {habit.today_completed ? 'Redo' : 'Start'}
                        </NeonButton>
                      ) : habit.type === 'distance' ? (
                        <NeonButton
                          variant={habit.today_completed ? 'secondary' : 'primary'}
                          size="sm"
                          className="font-bold"
                          onClick={() => onNavigate('gps-run', { id: habit.id })}
                        >
                          <Navigation className="w-3.5 h-3.5 mr-1" />
                          {habit.today_completed ? 'Redo' : 'Run'}
                        </NeonButton>
                      ) : (
                        <button
                          onClick={() => handleCheckCompletion(habit)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                            habit.today_completed
                              ? 'bg-neon-emerald text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                              : 'bg-space-800 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          <Check className="w-5 h-5 font-bold" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 7-Day Dot Trail (Fix E) */}
                  <div className="mt-3.5 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                      7-day trail
                    </span>
                    <div className="flex items-center gap-2">
                      {dots.map((d, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-[8px] font-mono text-[var(--text-dim)]">{d.dayLabel}</span>
                          <div
                            className={`w-3 h-3 rounded-full transition-all ${
                              d.status === 'completed'
                                ? 'bg-neon-emerald shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                                : d.status === 'pending'
                                ? 'border-2 border-neon-cyan/60 animate-pulse'
                                : d.status === 'missed'
                                ? 'bg-rose-500/40 border border-rose-500/60'
                                : 'bg-space-800 border border-[var(--border-subtle)]'
                            }`}
                            title={`${d.date}: ${d.status}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
