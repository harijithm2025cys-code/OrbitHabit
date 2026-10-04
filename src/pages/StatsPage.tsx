import React, { useEffect, useState } from 'react';
import {
  Flame,
  Trophy,
  Calendar,
  TrendingUp,
  Activity,
  Navigation
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { useHabitStore } from '../store/useHabitStore';
import { logRepository } from '../core/db/repositories/logRepo';
import { runRepository } from '../core/db/repositories/runRepo';
import { getPastDaysList, parseDateString } from '../core/utils/date';
import { HabitLog, RunRecord } from '../core/types/log';

export const StatsPage: React.FC = () => {
  const { habits, loadHabits } = useHabitStore();
  const [pastLogs, setPastLogs] = useState<HabitLog[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  useEffect(() => {
    loadHabits();
    // Load last 30 days of activity
    const pastDays = getPastDaysList(30);
    const startDate = pastDays[0];
    const endDate = pastDays[pastDays.length - 1];

    Promise.all(habits.map((h) => logRepository.getLogsForHabit(h.id, startDate, endDate)))
      .then((results) => setPastLogs(results.flat()))
      .catch((err) => console.error(err));

    runRepository.getAllRuns().then(setRuns).catch((err) => console.error(err));
  }, [loadHabits, habits.length]);

  const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak_current), 0);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_best), 0);

  const completedCount = pastLogs.filter((l) => l.completed === 1).length;
  const totalKm = runs.reduce((acc, r) => acc + r.distance_m / 1000, 0);

  // Compute 7-day weekly bars
  const weekDays = getPastDaysList(7);
  const weeklyDayData = weekDays.map((dateStr) => {
    const d = parseDateString(dateStr);
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    const dayLogs = pastLogs.filter((l) => l.date === dateStr);
    const done = dayLogs.filter((l) => l.completed === 1).length;
    const total = habits.length || 1;
    const pct = Math.min(100, Math.round((done / total) * 100));

    return {
      date: dateStr,
      dayLabel,
      completed: done,
      percentage: pct
    };
  });

  // 30-day heatmap grid
  const past30Days = getPastDaysList(28);
  const heatmapData = past30Days.map((dateStr) => {
    const dayLogs = pastLogs.filter((l) => l.date === dateStr);
    const completed = dayLogs.filter((l) => l.completed === 1).length;
    const intensity =
      completed === 0 ? 0 : completed === 1 ? 1 : completed <= 3 ? 2 : 3;
    return {
      date: dateStr,
      dayNum: parseDateString(dateStr).getDate(),
      completed,
      intensity
    };
  });

  const intensityColors = [
    'bg-space-800/80 border-white/5 text-slate-500',
    'bg-neon-cyan/20 border-neon-cyan/40 text-cyan-200',
    'bg-neon-purple/40 border-neon-purple/60 text-purple-100',
    'bg-neon-emerald/60 border-neon-emerald/80 text-white font-bold'
  ];

  return (
    <div className="flex flex-col gap-6 pb-28 pt-4 px-4 max-w-md mx-auto">
      <header>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold tracking-wider text-neon-purple uppercase">
            Performance Insights
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mt-1">Streaks & Stats</h1>
      </header>

      {/* Highlights Grid */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard glow="purple" className="p-4 space-y-1 bg-space-900/90 border-neon-amber/30">
          <div className="flex items-center gap-2 text-neon-amber">
            <Flame className="w-5 h-5 fill-neon-amber" />
            <span className="text-xs font-semibold uppercase">Current Streak</span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{maxStreak} Days</div>
          <span className="text-[11px] text-slate-400 font-mono">Best: {bestStreak} Days</span>
        </GlassCard>

        <GlassCard glow="cyan" className="p-4 space-y-1 bg-space-900/90 border-neon-cyan/30">
          <div className="flex items-center gap-2 text-neon-cyan">
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase">Total Completed</span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{completedCount}</div>
          <span className="text-[11px] text-slate-400 font-mono">Past 30 Days</span>
        </GlassCard>
      </div>

      {/* Activity Distance & Focus Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-emerald/15 border border-neon-emerald/30 flex items-center justify-center text-neon-emerald shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Run / Walk</div>
            <div className="text-lg font-bold font-mono text-white">{totalKm.toFixed(1)} km</div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-purple/15 border border-neon-purple/30 flex items-center justify-center text-neon-purple shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Active Habits</div>
            <div className="text-lg font-bold font-mono text-white">{habits.length}</div>
          </div>
        </GlassCard>
      </div>

      {/* Real Weekly Progress Bar Chart */}
      <GlassCard className="p-5 space-y-4 bg-space-900/90">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-cyan" /> Weekly Consistency
          </h3>
          <span className="text-xs text-slate-400">Last 7 Days</span>
        </div>

        <div className="flex items-end justify-between gap-2.5 h-36 pt-4 pb-1 px-1">
          {weeklyDayData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[10px] font-mono text-slate-400">{d.percentage}%</span>
              <div className="w-full bg-space-800 rounded-xl h-24 flex items-end p-1 overflow-hidden border border-white/5">
                <div
                  className="w-full bg-gradient-to-t from-neon-cyan to-neon-purple rounded-lg transition-all duration-500 shadow-neon-cyan"
                  style={{ height: `${Math.max(8, d.percentage)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-300">{d.dayLabel}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Real Consistency Heatmap */}
      <GlassCard className="p-5 space-y-3 bg-space-900/90">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neon-purple" /> Monthly Activity Heatmap
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Past 4 Weeks</span>
        </div>

        <div className="grid grid-cols-7 gap-2 pt-2">
          {heatmapData.map((item) => (
            <div
              key={item.date}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-xs font-mono transition-all ${
                intensityColors[item.intensity]
              }`}
              title={`${item.date}: ${item.completed} completed`}
            >
              <span>{item.dayNum}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 pt-2 border-t border-white/5">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-space-800 border border-white/5" />
            <div className="w-3 h-3 rounded bg-neon-cyan/30 border border-neon-cyan/50" />
            <div className="w-3 h-3 rounded bg-neon-purple/50 border border-neon-purple/70" />
            <div className="w-3 h-3 rounded bg-neon-emerald border border-neon-emerald" />
          </div>
          <span>More</span>
        </div>
      </GlassCard>
    </div>
  );
};
