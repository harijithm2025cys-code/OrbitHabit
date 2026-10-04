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
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { generateId, habitNotifId } from '../core/utils/id';

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
  const [alarmSound, setAlarmSound] = useState(initialData?.alarm_sound || 'ringtone_1.mp3');

  // Per-Habit Reminder States (Fix C)
  const [remindMe, setRemindMe] = useState(false);
  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00']);
  const [reminderSound, setReminderSound] = useState('ringtone_1.mp3');
  const [reminderVibrate, setReminderVibrate] = useState(true);
  const [reminderMessage, setReminderMessage] = useState('');
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  // Form validation & saving states
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [targetError, setTargetError] = useState('');

  // Load existing reminder and sync fields on edit
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
      if (initialData.alarm_sound) setAlarmSound(initialData.alarm_sound);

      if (initialData.id) {
        reminderRepository.getByHabitId(initialData.id).then((reminders) => {
          if (reminders && reminders.length > 0) {
            setRemindMe(true);
            setReminderTimes(reminders.map((r) => r.time));
            setReminderSound(reminders[0].sound || 'ringtone_1.mp3');
            setReminderVibrate(reminders[0].vibrate === 1);
            setReminderMessage(reminders[0].body || '');
            if (reminders[0].days && reminders[0].days.length > 0) {
              setRepeatDays(reminders[0].days);
              setFrequencyMode(reminders[0].days.length === 7 ? 'daily' : 'specific');
            }
          }
        });
      }
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
    if (playingSound === soundId) {
      SoundService.stopSound();
      setPlayingSound(null);
    } else {
      SoundService.playSound(soundId, () => setPlayingSound(null));
      setPlayingSound(soundId);
    }
  };

  const handleAddTime = () => {
    setReminderTimes([...reminderTimes, '20:00']);
  };

  const handleRemoveTime = (index: number) => {
    if (reminderTimes.length > 1) {
      setReminderTimes(reminderTimes.filter((_, i) => i !== index));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setIsSaving(true);
    try {
      const activeRepeatDays = frequencyMode === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeatDays;

      // Generate the habit ID HERE so we can link reminders to it before saving
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

      if (onSave) {
        await onSave(habitPayload);
      }

      // Schedule or cleanup reminders
      if (initialData?.id) {
        // Clear old habit-linked reminders before saving new ones
        const existingReminders = await reminderRepository.getByHabitId(initialData.id);
        for (const rem of existingReminders) {
          await NotificationService.cancelReminder(rem.id);
          await reminderRepository.delete(rem.id);
        }
      }

      if (remindMe || type === 'alarm') {
        // Check permission first, request only if needed
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await NotificationService.requestPermissions();
        }
        const timesToSchedule = type === 'alarm' ? [alarmTime] : reminderTimes;
        const soundToUse = type === 'alarm' ? alarmSound : reminderSound;

        for (const timeStr of timesToSchedule) {
          const remId = generateId('rem');
          const newReminder = {
            id: remId,
            habit_id: habitId, // ✅ now correctly linked
            title: trimmedName,
            body: reminderMessage.trim() || `Time for ${trimmedName}!`,
            time: timeStr,
            days: activeRepeatDays,
            sound: soundToUse,
            vibrate: reminderVibrate ? 1 : 0,
            enabled: 1,
            // Store a placeholder notif_id (actual IDs are derived from remId via habitNotifId)
            notif_id: habitNotifId(remId, 0)
          };
          await reminderRepository.create(newReminder);
          await NotificationService.scheduleReminder(newReminder);
        }
      }

      if (onShowToast) {
        onShowToast('success', initialData ? 'Habit updated successfully!' : 'Habit created successfully!');
      }
      onBack();
    } catch (err: any) {
      console.error('Error saving habit:', err);
      if (onShowToast) {
        onShowToast('error', err?.message || 'Failed to save habit. Please try again.');
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

        {/* Reminder Card with Toggle (Fix C) */}
        {type !== 'alarm' && (
          <GlassCard className="p-4 space-y-3">
            <Toggle
              checked={remindMe}
              onChange={setRemindMe}
              label="Remind Me"
              description={remindMe ? `${reminderTimes.length} time(s) set` : 'No reminder'}
            />

            <AnimatePresence>
              {remindMe && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 border-t border-white/10"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Reminder Time(s)
                    </label>
                    <div className="space-y-2">
                      {reminderTimes.map((timeStr, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={timeStr}
                            onChange={(e) => {
                              const updated = [...reminderTimes];
                              updated[idx] = e.target.value;
                              setReminderTimes(updated);
                            }}
                            className="bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono flex-1"
                          />
                          {reminderTimes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTime(idx)}
                              className="p-2 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddTime}
                      className="text-xs text-neon-cyan hover:underline flex items-center gap-1 font-medium pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add another time
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Ringtone Picker
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={reminderSound}
                        onChange={(e) => setReminderSound(e.target.value)}
                        className="flex-1 bg-space-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="ringtone_1.mp3">Orbit - Celestial Chime</option>
                        <option value="ringtone_2.mp3">Orbit - Upbeat Pulse</option>
                        <option value="ringtone_3.mp3">Orbit - Bright Resonance</option>
                        <option value="ringtone_4.mp3">Orbit - Deep Nebula</option>
                        <option value="ringtone_5.mp3">Orbit - Cosmic Bell</option>
                        <option value="silent">Silent</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleToggleSoundPreview(reminderSound)}
                        className={`p-2 rounded-xl border ${
                          playingSound === reminderSound
                            ? 'bg-neon-cyan text-space-950 border-neon-cyan'
                            : 'bg-space-900 text-slate-300 border-white/10'
                        }`}
                      >
                        {playingSound === reminderSound ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Toggle
                    checked={reminderVibrate}
                    onChange={setReminderVibrate}
                    label="Vibrate"
                    description="Trigger phone vibration with reminder"
                  />
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
            disabled={isSaving}
            className="w-full font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            {isSaving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-space-950 border-t-transparent rounded-full animate-spin" />
                <span>Saving to Orbit...</span>
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
