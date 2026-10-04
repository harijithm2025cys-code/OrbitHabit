import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  BarChart3,
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Navigation,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Modal } from '../components/ui/Modal';
import { useHabitStore } from '../store/useHabitStore';
import { logRepository } from '../core/db/repositories/logRepo';
import { runRepository } from '../core/db/repositories/runRepo';
import { HabitLog, RunRecord } from '../core/types/log';
import {
  getTodayString,
  getDayOfWeek,
  formatDisplayDate
} from '../core/utils/date';
import { generateId } from '../core/utils/id';

type SegmentTab = 'calendar' | 'stats' | 'activity';

interface CalendarHubPageProps {
  initialTab?: SegmentTab;
  onNavigate?: (route: string, params?: Record<string, string>) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const CalendarHubPage: React.FC<CalendarHubPageProps> = ({
  initialTab = 'calendar',
  onNavigate,
  onShowToast
}) => {
  const [activeSegment, setActiveSegment] = useState<SegmentTab>(initialTab);
  const { habits, loadHabits } = useHabitStore();

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const [selectedDayStr, setSelectedDayStr] = useState<string>(getTodayString());
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  // Backfill Modal
  const [backfillHabit, setBackfillHabit] = useState<{ id: string; name: string } | null>(null);

  const todayStr = getTodayString();

  useEffect(() => {
    loadHabits();
    loadAllLogsAndRuns();
  }, [loadHabits]);

  const loadAllLogsAndRuns = async () => {
    try {
      const logs = await logRepository.getAllLogs();
      setAllLogs(logs);
      const runList = await runRepository.getAllRuns();
      setRuns(runList);
    } catch (err) {
      console.error('Failed to load logs/runs:', err);
    }
  };

  // Month Navigation
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  // Generate days in month
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Calendar calculations
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLogs = allLogs.filter((l) => l.date.startsWith(monthPrefix));

  let totalScheduledMonth = 0;
  let totalCompletedMonth = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dow = getDayOfWeek(dayStr);

    const relevantHabits =
      selectedHabitId === 'all'
        ? habits.filter((h) => h.repeat_days.includes(dow) && h.archived === 0)
        : habits.filter((h) => h.id === selectedHabitId && h.repeat_days.includes(dow) && h.archived === 0);

    totalScheduledMonth += relevantHabits.length;

    for (const h of relevantHabits) {
      const isDone = monthLogs.some((l) => l.habit_id === h.id && l.date === dayStr && l.completed === 1);
      if (isDone) totalCompletedMonth++;
    }
  }

  const monthCompletionRate =
    totalScheduledMonth > 0 ? Math.round((totalCompletedMonth / totalScheduledMonth) * 100) : 0;

  // Selected Day Habits Breakdown
  const selectedDow = getDayOfWeek(selectedDayStr);
  const selectedDayHabits = habits.filter(
    (h) => h.repeat_days.includes(selectedDow) && h.archived === 0
  );

  const handleBackfillConfirm = async () => {
    if (!backfillHabit) return;
    try {
      const existing = await logRepository.getLog(backfillHabit.id, selectedDayStr);
      await logRepository.upsertLog({
        id: existing?.id || generateId('log'),
        habit_id: backfillHabit.id,
        date: selectedDayStr,
        progress: 1,
        completed: 1,
        completed_at: Date.now(),
        source: 'manual'
      });
      await loadAllLogsAndRuns();
      await loadHabits();
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
      confetti({ particleCount: 50, spread: 60 });
      if (onShowToast) onShowToast('success', `Marked "${backfillHabit.name}" as done for ${selectedDayStr}!`);
    } catch (err) {
      console.error('Backfill error:', err);
    } finally {
      setBackfillHabit(null);
    }
  };

  // Activity stats calculation (F4)
  const totalKm = runs.reduce((acc, r) => acc + ((r.distance_m || 0) / 1000), 0);
  const bestDistanceKm = runs.reduce((max, r) => Math.max(max, (r.distance_m || 0) / 1000), 0);

  return (
    <div className="flex flex-col gap-5 pb-32 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Segmented Control Bar */}
      <div className="flex rounded-2xl bg-space-900 p-1 border border-[var(--border-subtle)] shadow-glass">
        {[
          { id: 'calendar' as SegmentTab, label: 'Calendar', icon: CalendarIcon },
          { id: 'stats' as SegmentTab, label: 'Stats', icon: BarChart3 },
          { id: 'activity' as SegmentTab, label: 'Activity', icon: ActivityIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSegment === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSegment(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-neon-cyan/20 text-[var(--text-main)] border border-neon-cyan/40 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neon-cyan' : 'text-[var(--text-muted)]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SEGMENT 1: CALENDAR VIEW */}
      {activeSegment === 'calendar' && (
        <div className="space-y-4">
          {/* Month Header & Filter */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-space-800 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-[var(--text-main)] tracking-wide">{monthName}</h2>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-space-800 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Habit Filter Dropdown */}
            <select
              value={selectedHabitId}
              onChange={(e) => setSelectedHabitId(e.target.value)}
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none"
            >
              <option value="all" className="bg-space-900 text-[var(--text-main)]">All Habits Overview</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id} className="bg-space-900 text-[var(--text-main)]">
                  {h.icon} {h.name}
                </option>
              ))}
            </select>

            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)] text-center">
              <div className="bg-space-900 rounded-xl p-2 border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Scheduled</span>
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">{totalScheduledMonth}</span>
              </div>
              <div className="bg-space-900 rounded-xl p-2 border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Completed</span>
                <span className="text-sm font-bold font-mono text-neon-emerald">{totalCompletedMonth}</span>
              </div>
              <div className="bg-space-900 rounded-xl p-2 border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Rate</span>
                <span className="text-sm font-bold font-mono text-neon-cyan">{monthCompletionRate}%</span>
              </div>
            </div>
          </GlassCard>

          {/* Month Grid */}
          <GlassCard className="p-4 space-y-2">
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-[var(--text-muted)] pb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty offset days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 rounded-xl bg-transparent" />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayStr = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                const dow = getDayOfWeek(dayStr);
                const isToday = dayStr === todayStr;
                const isSelected = dayStr === selectedDayStr;

                const dayHabits =
                  selectedHabitId === 'all'
                    ? habits.filter((h) => h.repeat_days.includes(dow) && h.archived === 0)
                    : habits.filter((h) => h.id === selectedHabitId && h.repeat_days.includes(dow) && h.archived === 0);

                const dayCompletedCount = dayHabits.filter((h) =>
                  monthLogs.some((l) => l.habit_id === h.id && l.date === dayStr && l.completed === 1)
                ).length;

                const isAllDone = dayHabits.length > 0 && dayCompletedCount === dayHabits.length;
                const isPartial = dayCompletedCount > 0 && dayCompletedCount < dayHabits.length;
                const isRest = dayHabits.length === 0;

                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDayStr(dayStr)}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center p-1 text-xs font-mono transition border ${
                      isSelected
                        ? 'border-neon-cyan bg-neon-cyan/20 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                        : isToday
                        ? 'border-neon-purple bg-space-800'
                        : 'border-[var(--border-subtle)] bg-space-900'
                    }`}
                  >
                    <span className={`text-[11px] ${isToday ? 'font-bold text-neon-purple' : 'text-[var(--text-main)]'}`}>
                      {dayNum}
                    </span>
                    <div className="flex gap-0.5 mt-0.5">
                      {isRest ? (
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                      ) : isAllDone ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-neon-emerald shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
                      ) : isPartial ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-neon-amber" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500/40" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Selected Day Details & Backfill */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                {formatDisplayDate(selectedDayStr)}
              </h3>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {selectedDayHabits.length} habit(s) scheduled
              </span>
            </div>

            {selectedDayHabits.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-3">
                Rest Day — No habits scheduled for this day.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayHabits.map((h) => {
                  const isDone = monthLogs.some(
                    (l) => l.habit_id === h.id && l.date === selectedDayStr && l.completed === 1
                  );
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)] text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{h.icon}</span>
                        <span className="font-semibold text-[var(--text-main)] truncate">{h.name}</span>
                      </div>

                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neon-emerald">
                          <CheckCircle2 className="w-4 h-4" /> Done
                        </span>
                      ) : (
                        <button
                          onClick={() => setBackfillHabit({ id: h.id, name: h.name })}
                          className="px-2.5 py-1 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan hover:text-white transition text-[10px] font-bold"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* SEGMENT 2: STATS & STREAK LEADERBOARD */}
      {activeSegment === 'stats' && (
        <div className="space-y-4">
          {/* Leaderboard Card */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-neon-amber" /> Streak Leaderboard
              </h3>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Sorted by Current Streak</span>
            </div>

            {habits.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No habits created yet.</p>
            ) : (
              <div className="space-y-2">
                {[...habits]
                  .sort((a, b) => b.streak_current - a.streak_current)
                  .map((h, idx) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-[var(--text-dim)] w-4">
                          #{idx + 1}
                        </span>
                        <span className="text-base">{h.icon}</span>
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">{h.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-neon-amber flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-neon-amber" />
                          {h.streak_current} {h.streak_current === 1 ? 'day' : 'days'}
                        </span>
                        <span className="text-[9px] text-[var(--text-dim)] block font-mono">
                          Best: {h.streak_best}d
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* SEGMENT 3: ACTIVITY VIEW (F4) */}
      {activeSegment === 'activity' && (
        <div className="space-y-4">
          {/* Activity Totals Banner */}
          <GlassCard className="p-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-space-900 rounded-xl p-2.5 border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Total Distance</span>
              <span className="text-base font-extrabold font-mono text-neon-emerald">
                {totalKm.toFixed(1)} km
              </span>
            </div>
            <div className="bg-space-900 rounded-xl p-2.5 border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Total Sessions</span>
              <span className="text-base font-extrabold font-mono text-[var(--text-main)]">{runs.length}</span>
            </div>
            <div className="bg-space-900 rounded-xl p-2.5 border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Best Distance</span>
              <span className="text-base font-extrabold font-mono text-neon-cyan">
                {bestDistanceKm.toFixed(1)} km
              </span>
            </div>
          </GlassCard>

          {/* Activity List */}
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-2">
              <Navigation className="w-4 h-4 text-neon-emerald" /> Recorded Workouts & Runs
            </h3>

            {runs.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Navigation className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
                <p className="text-xs text-[var(--text-muted)]">No workout runs recorded yet.</p>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigate && onNavigate('gps-run')}
                >
                  Start First Run
                </NeonButton>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => {
                  const distKm = (r.distance_m || 0) / 1000;
                  const dateStr = new Date(r.start_ts).toISOString().slice(0, 10);
                  const paceSec = distKm > 0 ? Math.round((r.duration_s || 0) / distKm) : 0;
                  const mins = Math.floor((r.duration_s || 0) / 60);
                  const secs = (r.duration_s || 0) % 60;

                  // Parse route points for SVG thumbnail
                  let pointsSvg = '';
                  try {
                    const pts = JSON.parse(r.route_json || '[]');
                    if (pts && pts.length >= 2) {
                      let minLat = pts[0].latitude;
                      let maxLat = pts[0].latitude;
                      let minLng = pts[0].longitude;
                      let maxLng = pts[0].longitude;
                      for (const p of pts) {
                        if (p.latitude < minLat) minLat = p.latitude;
                        if (p.latitude > maxLat) maxLat = p.latitude;
                        if (p.longitude < minLng) minLng = p.longitude;
                        if (p.longitude > maxLng) maxLng = p.longitude;
                      }
                      const latSpan = Math.max(0.0001, maxLat - minLat);
                      const lngSpan = Math.max(0.0001, maxLng - minLng);
                      const w = 60;
                      const h = 40;
                      const pad = 6;
                      const scale = Math.min((w - pad * 2) / lngSpan, (h - pad * 2) / latSpan);
                      const svgPts = pts
                        .map((p: any) => {
                          const x = pad + (p.longitude - minLng) * scale;
                          const y = h - (pad + (p.latitude - minLat) * scale);
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');
                      pointsSvg = svgPts;
                    }
                  } catch {}

                  return (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-space-900 border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--text-main)] font-mono">{formatDisplayDate(dateStr)}</span>
                          <span className="text-neon-emerald font-bold font-mono">
                            {distKm.toFixed(2)} km
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                          <span>⏱ {mins}m {secs}s</span>
                          <span>⚡ {paceSec > 0 ? `${Math.floor(paceSec / 60)}'${String(paceSec % 60).padStart(2, '0')}"/km` : '--'}</span>
                        </div>
                      </div>

                      {pointsSvg ? (
                        <div className="w-16 h-11 bg-space-950/80 rounded-lg border border-white/5 p-1 shrink-0 flex items-center justify-center">
                          <svg width="60" height="40" className="overflow-visible">
                            <polyline
                              fill="none"
                              stroke="#00F0FF"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={pointsSvg}
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-space-800 border border-white/5 flex items-center justify-center shrink-0">
                          <Navigation className="w-4 h-4 text-neon-cyan" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Backfill Confirmation Modal */}
      <Modal
        isOpen={!!backfillHabit}
        onClose={() => setBackfillHabit(null)}
        title="Mark Habit as Completed"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Confirm marking <strong>"{backfillHabit?.name}"</strong> as completed for{' '}
            <strong>{formatDisplayDate(selectedDayStr)}</strong>?
          </p>
          <div className="flex gap-3 pt-2">
            <NeonButton variant="secondary" size="md" className="flex-1" onClick={() => setBackfillHabit(null)}>
              Cancel
            </NeonButton>
            <NeonButton variant="primary" size="md" className="flex-1 font-bold" onClick={handleBackfillConfirm}>
              Confirm
            </NeonButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
