import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Navigation,
  Sparkles,
  Play,
  Square,
  Plus,
  Trash2,
  AlertCircle,
  ListTodo,
  AlarmClock,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Toggle } from '../components/ui/Toggle';
import { HabitType, Habit } from '../core/types/habit';
import { SoundService } from '../core/services/soundService';
import { NotificationService } from '../core/services/notificationService';
import { Reminder } from '../core/types/reminder';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { generateId, habitNotifId } from '../core/utils/id';

export interface ReminderFormItem {
  id?: string;
  time: string;
  sound: string;
  vibrate: boolean;
  message: string;
}

interface AddEditHabitPageProps {
  onBack: () => void;
  onSave?: (habitData: any) => Promise<void>;
  initialData?: Habit | null;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const HABIT_ICONS = ['💧', '🏃', '📚', '🧘', '💪', '💻', '🎨', '🎯', '🥗', '⚡', '🌙', '⏰', '⭐', '🏋️'];
const HABIT_COLORS = [
  '#00f0ff',
  '#a855f7',
  '#10b981',
  '#ec4899',
  '#f59e0b',
  '#3b82f6',
  '#f43f5e',
  '#8b5cf6'
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AddEditHabitPage: React.FC<AddEditHabitPageProps> = ({
  onBack,
  onSave,
  initialData,
  onShowToast
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [icon, setIcon] = useState(initialData?.icon || '💧');
  const [color, setColor] = useState(initialData?.color || '#00f0ff');
  const [type, setType] = useState<HabitType>(initialData?.type || 'check');
  const [targetValue, setTargetValue] = useState<number>(initialData?.target_value || 1);
  const [distanceInput, setDistanceInput] = useState<string>(
    initialData?.type === 'distance' ? String(initialData.target_value) : '3'
  );
  const [durationInput, setDurationInput] = useState<string>(
    initialData?.type === 'timer' ? String(initialData.target_value) : '20'
  );
  const [countInput, setCountInput] = useState<string>(
    initialData?.type === 'count' ? String(initialData.target_value) : '8'
  );
  const [unit, setUnit] = useState(initialData?.unit || 'done');
  const [frequencyMode, setFrequencyMode] = useState<'daily' | 'specific'>(
    initialData?.repeat_days && initialData.repeat_days.length === 7 ? 'daily' : 'specific'
  );
  const [repeatDays, setRepeatDays] = useState<number[]>(
    initialData?.repeat_days || [0, 1, 2, 3, 4, 5, 6]
  );

  // Checklist specific
  const [checklistItems, setChecklistItems] = useState<string[]>(
    initialData?.checklist_items || ['Step 1', 'Step 2']
  );
  const [newChecklistInput, setNewChecklistInput] = useState('');

  // Wake up specific
  const [alarmTime, setAlarmTime] = useState(initialData?.alarm_time || '07:00');
  const [alarmSound, setAlarmSound] = useState(initialData?.alarm_sound || 'ringtone_1');

  // Per-Habit Reminder States: list of objects with per-reminder sound, vibrate, message
  const [remindMe, setRemindMe] = useState(false);
  const [reminderItems, setReminderItems] = useState<ReminderFormItem[]>([
    { time: '08:00', sound: 'ringtone_1', vibrate: true, message: '' }
  ]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(!!initialData?.id);
  const [exactAlarmBlocked, setExactAlarmBlocked] = useState(false);
  const [typeChangeWarning, setTypeChangeWarning] = useState('');
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  // Form validation & saving states
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [targetError, setTargetError] = useState('');

  // Load existing reminder and sync fields on edit BEFORE rendering form fully
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setIcon(initialData.icon || 'Sparkles');
      setColor(initialData.color || '#00F0FF');
      setType(initialData.type || 'check');
      if (initialData.type === 'distance') setDistanceInput(String(initialData.target_value));
      if (initialData.type === 'timer') setDurationInput(String(initialData.target_value));
      if (initialData.type === 'count') setCountInput(String(initialData.target_value));
      setUnit(initialData.unit || 'done');
      setRepeatDays(initialData.repeat_days || [0, 1, 2, 3, 4, 5, 6]);
      setFrequencyMode(
        initialData.repeat_days && initialData.repeat_days.length === 7 ? 'daily' : 'specific'
      );
      if (initialData.checklist_items && initialData.checklist_items.length > 0) {
        setChecklistItems(initialData.checklist_items);
      }
      if (initialData.alarm_time) setAlarmTime(initialData.alarm_time);
      if (initialData.alarm_sound) setAlarmSound(initialData.alarm_sound.replace(/\.mp3$|\.wav$/, ''));

      if (initialData.id) {
        setIsLoadingReminders(true);
        reminderRepository.getByHabitId(initialData.id).then((reminders) => {
          if (reminders && reminders.length > 0) {
            setRemindMe(true);
            setReminderItems(
              reminders.map((r) => ({
                id: r.id,
                time: r.time,
                sound: (r.sound || 'ringtone_1').replace(/\.mp3$|\.wav$/, ''),
                vibrate: r.vibrate !== 0,
                message: r.body || ''
              }))
            );
          } else {
            setRemindMe(false);
            setReminderItems([{ time: '08:00', sound: 'ringtone_1', vibrate: true, message: '' }]);
          }
        }).catch((err) => {
          console.error('Failed to load existing reminders:', err);
        }).finally(() => {
          setIsLoadingReminders(false);
        });
      } else {
        setIsLoadingReminders(false);
      }
    } else {
      setIsLoadingReminders(false);
    }
  }, [initialData?.id]);

  const toggleDay = (dayIndex: number) => {
    if (repeatDays.includes(dayIndex)) {
      if (repeatDays.length > 1) {
        setRepeatDays(repeatDays.filter((d) => d !== dayIndex));
      }
    } else {
      setRepeatDays([...repeatDays, dayIndex].sort());
    }
  };

  const handleFrequencyModeChange = (mode: 'daily' | 'specific') => {
    setFrequencyMode(mode);
    if (mode === 'daily') {
      setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleTypeChange = (newType: HabitType) => {
    setType(newType);
    setTargetError('');
    if (initialData && initialData.type !== newType) {
      setTypeChangeWarning("Notice: Changing habit type will reset today's progress to 0.");
    } else {
      setTypeChangeWarning('');
    }
    if (newType === 'check') {
      setTargetValue(1);
      setUnit('done');
    } else if (newType === 'timer') {
      const val = parseInt(durationInput, 10) || 20;
      setTargetValue(val);
      setUnit('min');
    } else if (newType === 'distance') {
      const parsed = parseFloat(distanceInput.replace(',', '.')) || 3;
      setTargetValue(parsed);
      setUnit('km');
    } else if (newType === 'count') {
      const val = parseInt(countInput, 10) || 8;
      setTargetValue(val);
      setUnit('times');
    } else if (newType === 'checklist') {
      setTargetValue(checklistItems.length || 1);
      setUnit('items');
    } else if (newType === 'alarm') {
      setTargetValue(1);
      setUnit('alarm');
    }
  };

  const handleDistanceChange = (valStr: string) => {
    setDistanceInput(valStr);
    setTargetError('');
    const normalized = valStr.trim().replace(',', '.');
    if (normalized === '') {
      setTargetValue(0);
      return;
    }
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      setTargetValue(parsed);
    }
  };

  const handleDurationChange = (valStr: string) => {
    setDurationInput(valStr);
    setTargetError('');
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed)) {
      setTargetValue(parsed);
    } else {
      setTargetValue(0);
    }
  };

  const handleCountChange = (valStr: string) => {
    setCountInput(valStr);
    setTargetError('');
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed)) {
      setTargetValue(parsed);
    } else {
      setTargetValue(0);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistInput.trim()) return;
    setChecklistItems([...checklistItems, newChecklistInput.trim()]);
    setNewChecklistInput('');
  };

  const handleRemoveChecklistItem = (idx: number) => {
    if (checklistItems.length > 1) {
      setChecklistItems(checklistItems.filter((_, i) => i !== idx));
    }
  };

  const handleToggleSoundPreview = (soundId: string) => {
    const cleanSound = soundId.replace(/\.mp3$|\.wav$/, '');
    if (playingSound === cleanSound) {
      SoundService.stopSound();
      setPlayingSound(null);
    } else {
      SoundService.playSound(cleanSound, () => setPlayingSound(null));
      setPlayingSound(cleanSound);
    }
  };

  const handleAddReminderItem = () => {
    setReminderItems((prev) => [
      ...prev,
      { time: '20:00', sound: 'ringtone_1', vibrate: true, message: '' }
    ]);
  };

  const handleRemoveReminderItem = (index: number) => {
    if (reminderItems.length > 1) {
      setReminderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpdateReminderItem = (index: number, updates: Partial<ReminderFormItem>) => {
    setReminderItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingReminders) return;

    setNameError('');
    setTargetError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Please enter a habit name.');
      return;
    }

    let finalTargetValue = targetValue;

    if (type === 'distance') {
      const norm = distanceInput.trim().replace(',', '.');
      const parsed = parseFloat(norm);
      if (norm === '' || isNaN(parsed) || parsed <= 0) {
        setTargetError('Please enter a valid distance greater than 0 km.');
        return;
      }
      if (parsed > 500) {
        setTargetError('Distance cannot exceed 500 km.');
        return;
      }
      finalTargetValue = parsed;
    } else if (type === 'timer') {
      const parsed = parseInt(durationInput, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setTargetError('Please enter a valid duration (1 - 1440 minutes).');
        return;
      }
      if (parsed > 1440) {
        setTargetError('Duration cannot exceed 1440 minutes (24 hours).');
        return;
      }
      finalTargetValue = parsed;
    } else if (type === 'count') {
      const parsed = parseInt(countInput, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setTargetError('Please enter a valid target count (minimum 1).');
        return;
      }
      if (parsed > 10000) {
        setTargetError('Target count cannot exceed 10,000.');
        return;
      }
      finalTargetValue = parsed;
    } else if (type === 'checklist') {
      finalTargetValue = checklistItems.length;
    } else if (type === 'check' || type === 'alarm') {
      finalTargetValue = 1;
    }

    // Check exact alarm permission on Android 12+ if reminders enabled
    if (remindMe || type === 'alarm') {
      const dev = await NotificationService.getDeviceInfo();
      if (dev && dev.sdkVersion >= 31 && !dev.canScheduleExactAlarms) {
        setExactAlarmBlocked(true);
        if (onShowToast) {
          onShowToast('error', 'Exact alarm permission required for reminders to ring on time.');
        }
        return;
      }
    }

    setIsSaving(true);
    try {
      const activeRepeatDays = frequencyMode === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeatDays;
      const habitId = initialData?.id || generateId('habit');

      const habitPayload = {
        id: habitId,
        name: trimmedName,
        description: description.trim(),
        icon,
        color,
        type,
        target_value: finalTargetValue,
        unit,
        repeat_days: activeRepeatDays,
        checklist_items: type === 'checklist' ? checklistItems : [],
        alarm_time: type === 'alarm' ? alarmTime : undefined,
        alarm_sound: type === 'alarm' ? alarmSound : undefined
      };

      // Prepare target new reminders
      let newReminderObjects: Reminder[] = [];
      if (remindMe || type === 'alarm') {
        const itemsToSchedule: ReminderFormItem[] =
          type === 'alarm'
            ? [{ time: alarmTime, sound: alarmSound, vibrate: true, message: `Wake up! Time for ${trimmedName}` }]
            : reminderItems;

        newReminderObjects = itemsToSchedule.map((item) => {
          const remId = item.id || generateId('rem');
          return {
            id: remId,
            habit_id: habitId,
            title: trimmedName,
            body: item.message.trim() || `Time for ${trimmedName}!`,
            time: item.time,
            days: activeRepeatDays, // strictly from habit frequency
            sound: (item.sound || 'ringtone_1').replace(/\.mp3$|\.wav$/, ''),
            vibrate: item.vibrate ? 1 : 0,
            enabled: 1,
            notif_id: habitNotifId(remId, 0)
          };
        });

        // 1. ATOMIC: Schedule new reminders FIRST before deleting old ones!
        for (const rem of newReminderObjects) {
          const ok = await NotificationService.scheduleReminder(rem);
          if (ok === false) {
            throw new Error(`Failed to arm native alarm for reminder at ${rem.time}`);
          }
        }
      }

      // 2. Save habit payload (stripped of store fields)
      if (onSave) {
        await onSave(habitPayload);
      }

      // 3. Scheduling succeeded: delete old reminders that are no longer kept
      if (initialData?.id) {
        const existingReminders = await reminderRepository.getByHabitId(initialData.id);
        const newIds = new Set(newReminderObjects.map((r) => r.id));
        for (const oldRem of existingReminders) {
          if (!newIds.has(oldRem.id) || (!remindMe && type !== 'alarm')) {
            await NotificationService.cancelReminder(oldRem.id);
            await reminderRepository.delete(oldRem.id);
          }
        }
      }

      // 4. Save/update new reminders in repository
      for (const rem of newReminderObjects) {
        const existing = await reminderRepository.getById(rem.id);
        if (existing) {
          await reminderRepository.update(rem);
        } else {
          await reminderRepository.create(rem);
        }
      }

      if (onShowToast) {
        onShowToast('success', initialData ? 'Habit updated successfully!' : 'Habit created successfully!');
      }
      onBack();
    } catch (err: any) {
      console.error('Error saving habit / scheduling reminders:', err);
      if (onShowToast) {
        onShowToast('error', err?.message === 'SCHEDULE_EXACT_ALARM_PERMISSION_REQUIRED'
          ? 'Exact alarm permission is required in Android Settings.'
          : err?.message || 'Failed to save habit. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-[calc(env(safe-area-inset-bottom)+100px)] pt-4 px-4 max-w-md mx-auto w-full min-h-screen overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-space-800/80 border border-white/10 text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neon-cyan">
            {initialData ? 'Edit Mode' : 'Create New'}
          </span>
          <h1 className="text-lg font-bold text-white">
            {initialData ? 'Edit Habit' : 'Create Habit'}
          </h1>
        </div>
        <div className="w-9" />
      </header>

      <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
        {/* Title & Description Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Habit Title <span className="text-neon-cyan">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="e.g. Morning 5km Run, Drink Water"
              className="w-full bg-space-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan"
            />
            {nameError && (
              <p className="text-xs text-rose-400 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" /> {nameError}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this habit matters to your orbit..."
              className="w-full bg-space-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
            />
          </div>
        </GlassCard>

        {/* Task Type Selector Chips (F2) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 px-1">
            Task Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'check' as HabitType, label: 'Habit', icon: CheckSquare, desc: 'Check' },
              { id: 'timer' as HabitType, label: 'Duration', icon: Clock, desc: 'Timer' },
              { id: 'distance' as HabitType, label: 'Distance', icon: Navigation, desc: 'GPS' },
              { id: 'count' as HabitType, label: 'Counter', icon: Sparkles, desc: 'Count' },
              { id: 'checklist' as HabitType, label: 'Checklist', icon: ListTodo, desc: 'Multi-step' },
              { id: 'alarm' as HabitType, label: 'Wake Up', icon: AlarmClock, desc: 'Alarm' }
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  className={`p-2.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-neon-cyan/15 border-neon-cyan text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                      : 'bg-space-900/80 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-neon-cyan' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-[9px] text-slate-500">{t.desc}</span>
                </button>
              );
            })}
          </div>

          {typeChangeWarning && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs mt-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{typeChangeWarning}</span>
            </div>
          )}
        </div>

        {/* Dynamic Fields Based on Task Type */}
        <GlassCard className="p-4 space-y-3">
          {type === 'timer' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Target Duration (Minutes)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">1 - 1440 min</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={durationInput}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  placeholder="20"
                  className="w-28 bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-neon-cyan"
                />
                <span className="text-xs text-slate-400">minutes per session</span>
              </div>

              {/* Quick Pick Chips */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">Quick Select</span>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 20, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleDurationChange(String(mins))}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium transition border ${
                        durationInput === String(mins)
                          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan font-bold'
                          : 'bg-space-900/90 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === 'distance' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Target Distance (Kilometers)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">0.1 - 500 km</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={distanceInput}
                  onChange={(e) => handleDistanceChange(e.target.value)}
                  placeholder="5 or 2.5"
                  className="w-28 bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-neon-cyan"
                />
                <span className="text-xs text-slate-400">km running / walking</span>
              </div>

              {/* Quick Pick Chips */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">Quick Pick</span>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 5, 10, 21].map((kmVal) => (
                    <button
                      key={kmVal}
                      type="button"
                      onClick={() => handleDistanceChange(String(kmVal))}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition border ${
                        distanceInput === String(kmVal)
                          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan font-bold'
                          : 'bg-space-900/90 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {kmVal} km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === 'count' && (
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-300">
                Target Repetitions / Count
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={countInput}
                  onChange={(e) => handleCountChange(e.target.value)}
                  placeholder="8"
                  className="w-28 bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-neon-cyan"
                />
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. glasses, reps"
                  className="flex-1 bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                />
              </div>

              {/* Quick Pick Chips */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">Quick Select</span>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 8, 10, 20, 50, 100].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleCountChange(String(cnt))}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium transition border ${
                        countInput === String(cnt)
                          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan font-bold'
                          : 'bg-space-900/90 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === 'checklist' && (
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-300">
                Checklist Sub-items
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-space-900 border border-white/5 text-xs">
                    <span className="text-slate-200 truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistInput}
                  onChange={(e) => setNewChecklistInput(e.target.value)}
                  placeholder="Add item..."
                  className="flex-1 bg-space-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neon-cyan"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                />
                <NeonButton type="button" size="sm" variant="secondary" onClick={handleAddChecklistItem}>
                  <Plus className="w-3.5 h-3.5" />
                </NeonButton>
              </div>
            </div>
          )}

          {type === 'alarm' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Wake Up / Alarm Time
                </label>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(e) => setAlarmTime(e.target.value)}
                  className="w-full bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Alarm Ringtone
                </label>
                <select
                  value={alarmSound}
                  onChange={(e) => setAlarmSound(e.target.value)}
                  className="w-full bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="ringtone_1.mp3">Orbit - Celestial Chime</option>
                  <option value="ringtone_2.mp3">Orbit - Upbeat Pulse</option>
                  <option value="ringtone_3.mp3">Orbit - Bright Resonance</option>
                  <option value="ringtone_4.mp3">Orbit - Deep Nebula</option>
                  <option value="ringtone_5.mp3">Orbit - Cosmic Bell</option>
                </select>
              </div>
            </div>
          )}

          {type === 'check' && (
            <p className="text-xs text-slate-400">
              Simple 1-tap completion habit. Marked done with haptic feedback & confetti.
            </p>
          )}

          {targetError && (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {targetError}
            </p>
          )}
        </GlassCard>

        {/* Frequency Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Frequency
            </label>
            <div className="flex rounded-xl bg-space-900 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => handleFrequencyModeChange('daily')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  frequencyMode === 'daily'
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => handleFrequencyModeChange('specific')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  frequencyMode === 'specific'
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Specific Days
              </button>
            </div>
          </div>

          {frequencyMode === 'specific' && (
            <div className="flex justify-between gap-1 pt-1">
              {DAYS.map((day, idx) => {
                const isSelected = repeatDays.includes(idx);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition flex items-center justify-center border ${
                      isSelected
                        ? 'bg-neon-cyan text-space-950 border-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                        : 'bg-space-900 text-slate-400 border-white/10'
                    }`}
                  >
                    {day[0]}
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Reminder Card with Toggle */}
        {type !== 'alarm' && (
          <GlassCard className="p-4 space-y-3">
            <Toggle
              checked={remindMe}
              onChange={(val) => {
                setRemindMe(val);
                if (val) {
                  NotificationService.getDeviceInfo().then((dev) => {
                    if (dev && dev.sdkVersion >= 31 && !dev.canScheduleExactAlarms) {
                      setExactAlarmBlocked(true);
                    }
                  });
                }
              }}
              label="Remind Me"
              description={
                isLoadingReminders
                  ? 'Loading saved alarms...'
                  : remindMe
                  ? `${reminderItems.length} reminder(s) configured`
                  : 'No reminder'
              }
            />

            {isLoadingReminders && (
              <div className="flex items-center justify-center p-3 text-xs text-slate-400 gap-2 border-t border-white/10">
                <div className="w-3.5 h-3.5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                <span>Loading saved reminders from database...</span>
              </div>
            )}

            {exactAlarmBlocked && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2 mt-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Exact Alarm Permission Required</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Android requires special permission to ring reminder alarms when the phone is locked or OrbitHabit is swiped away.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await NotificationService.openExactAlarmSettings();
                    setTimeout(async () => {
                      const dev = await NotificationService.getDeviceInfo();
                      if (dev?.canScheduleExactAlarms) setExactAlarmBlocked(false);
                    }, 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30 text-xs w-full text-center"
                >
                  Open Alarm Settings →
                </button>
              </div>
            )}

            <AnimatePresence>
              {remindMe && !isLoadingReminders && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 border-t border-white/10"
                >
                  <div className="space-y-3">
                    {reminderItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-space-900 border border-white/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-neon-cyan uppercase font-mono">
                            Reminder #{idx + 1}
                          </span>
                          {reminderItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveReminderItem(idx)}
                              className="text-slate-400 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Time Picker */}
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) =>
                              handleUpdateReminderItem(idx, { time: e.target.value })
                            }
                            className="bg-space-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono flex-1 focus:border-neon-cyan focus:outline-none"
                          />
                        </div>

                        {/* Sound Picker & Preview */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-medium block">
                            Alarm Sound
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={item.sound}
                              onChange={(e) =>
                                handleUpdateReminderItem(idx, { sound: e.target.value })
                              }
                              className="flex-1 bg-space-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-neon-cyan focus:outline-none"
                            >
                              <option value="ringtone_1">Orbit - Celestial Chime</option>
                              <option value="ringtone_2">Orbit - Upbeat Pulse</option>
                              <option value="ringtone_3">Orbit - Bright Resonance</option>
                              <option value="ringtone_4">Orbit - Deep Nebula</option>
                              <option value="ringtone_5">Orbit - Cosmic Bell</option>
                              <option value="default">System Default Sound</option>
                              <option value="silent">Silent (Vibrate Only)</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleToggleSoundPreview(item.sound)}
                              className={`p-2 rounded-xl border ${
                                playingSound === item.sound.replace(/\.mp3$|\.wav$/, '')
                                  ? 'bg-neon-cyan text-space-950 border-neon-cyan'
                                  : 'bg-space-950 text-slate-300 border-white/10'
                              }`}
                            >
                              {playingSound === item.sound.replace(/\.mp3$|\.wav$/, '') ? (
                                <Square className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Vibrate Toggle */}
                        <Toggle
                          checked={item.vibrate}
                          onChange={(v) => handleUpdateReminderItem(idx, { vibrate: v })}
                          label="Vibrate"
                          description="Trigger haptic vibration with alarm"
                        />

                        {/* Optional Custom Message */}
                        <input
                          type="text"
                          value={item.message}
                          onChange={(e) =>
                            handleUpdateReminderItem(idx, { message: e.target.value })
                          }
                          placeholder={`Custom reminder message (optional)...`}
                          className="w-full bg-space-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-neon-cyan focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddReminderItem}
                    className="text-xs text-neon-cyan hover:underline flex items-center gap-1 font-medium pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add another reminder time
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        )}

        {/* Icon & Color Picker Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Icon & Visual Orb
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {HABIT_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 shrink-0 rounded-2xl text-lg flex items-center justify-center border transition ${
                    icon === i
                      ? 'bg-space-800 border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                      : 'bg-space-900 border-white/5 text-slate-400'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Theme Glow Color
            </label>
            <div className="flex justify-between gap-1.5">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full border-2 transition flex items-center justify-center ${
                    color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80'
                  }`}
                >
                  {color === c && <Check className="w-4 h-4 text-space-950 font-bold" />}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Submit Action Button */}
        <div className="pt-2">
          <NeonButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSaving || isLoadingReminders}
            className="w-full font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            {isSaving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-space-950 border-t-transparent rounded-full animate-spin" />
                <span>Saving to Orbit...</span>
              </div>
            ) : isLoadingReminders ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-space-950 border-t-transparent rounded-full animate-spin" />
                <span>Loading Alarms...</span>
              </div>
            ) : initialData ? (
              'SAVE CHANGES'
            ) : (
              'CREATE HABIT'
            )}
          </NeonButton>
        </div>
      </form>
    </div>
  );
};
