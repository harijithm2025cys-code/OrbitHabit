import React, { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  ArrowLeft,
  Plus,
  Volume2,
  Clock,
  Play,
  Square,
  Trash2,
  Bell,
  Check,
  Send
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Toggle } from '../components/ui/Toggle';
import { Modal } from '../components/ui/Modal';
import { Reminder } from '../core/types/reminder';
import { reminderRepository } from '../core/db/repositories/reminderRepo';
import { NotificationService } from '../core/services/notificationService';
import { SoundService } from '../core/services/soundService';
import { generateId, habitNotifId } from '../core/utils/id';

interface RemindersPageProps {
  onBack: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RemindersPage: React.FC<RemindersPageProps> = ({ onBack, onShowToast }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [time, setTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [sound, setSound] = useState('ringtone_1.mp3');
  const [vibrate, setVibrate] = useState(true);

  const loadReminders = async () => {
    try {
      const list = await reminderRepository.getAll();
      setReminders(list);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleOpenAddModal = () => {
    setEditingReminder(null);
    setTitle('Daily Reminder');
    setBody('');
    setTime('08:30');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setSound('ringtone_1.mp3');
    setVibrate(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rem: Reminder) => {
    setEditingReminder(rem);
    setTitle(rem.title);
    setBody(rem.body);
    setTime(rem.time);
    setSelectedDays(rem.days);
    setSound(rem.sound);
    setVibrate(rem.vibrate === 1);
    setIsModalOpen(true);
  };

  const toggleDay = (idx: number) => {
    if (selectedDays.includes(idx)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== idx));
      }
    } else {
      setSelectedDays([...selectedDays, idx].sort());
    }
  };

  const handleSelectEveryday = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSoundPreview = (soundId: string) => {
    if (playingSound === soundId) {
      SoundService.stopCurrentSound();
      setPlayingSound(null);
    } else {
      SoundService.playSound(soundId, () => setPlayingSound(null));
      setPlayingSound(soundId);
    }
  };

  const handleToggleEnable = async (rem: Reminder, enabled: boolean) => {
    try {
      await reminderRepository.toggleEnabled(rem.id, enabled);
      if (enabled) {
        await NotificationService.scheduleReminder({ ...rem, enabled: 1 });
      } else {
        await NotificationService.cancelReminder(rem.id);
      }
      await loadReminders();
    } catch (err) {
      console.error('Toggle reminder error:', err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await NotificationService.cancelReminder(id);
      await reminderRepository.delete(id);
      if (onShowToast) onShowToast('info', 'Reminder deleted');
      await loadReminders();
    } catch (err) {
      console.error('Delete reminder error:', err);
    }
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      // Request permissions only if not already granted
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await NotificationService.requestPermissions();
      }

      const reminderId = editingReminder?.id || generateId('rem');
      const reminderData: Reminder = {
        id: reminderId,
        habit_id: editingReminder?.habit_id || null,
        title: title.trim(),
        body: body.trim() || title.trim(),
        time,
        days: selectedDays,
        sound,
        vibrate: vibrate ? 1 : 0,
        enabled: 1,
        notif_id: editingReminder?.notif_id || habitNotifId(reminderId, 0)
      };

      if (editingReminder) {
        await reminderRepository.update(reminderData);
      } else {
        await reminderRepository.create(reminderData);
      }

      await NotificationService.scheduleReminder(reminderData);
      await loadReminders();
      setIsModalOpen(false);
      if (onShowToast) {
        onShowToast('success', editingReminder ? 'Reminder updated!' : 'Reminder scheduled!');
      }
    } catch (err) {
      console.error('Save reminder error:', err);
    }
  };

  const handleSendTestNotification = async (delaySeconds = 10) => {
    try {
      await NotificationService.requestPermissions();
      await NotificationService.sendTestNotification(
        delaySeconds,
        delaySeconds === 120 ? 'OrbitHabit 2-Min Exact Alarm' : 'OrbitHabit Exact Alarm Test',
        'ringtone_1.mp3'
      );
      if (onShowToast) {
        onShowToast(
          'info',
          `Exact alarm scheduled for ${delaySeconds}s! You can swipe away app from recents or lock screen to test.`
        );
      }
    } catch (err) {
      console.error('Test notification error:', err);
    }
  };

  const getSoundLabel = (soundFile: string) => {
    const item = SoundService.getAvailableSounds().find((s) => s.id === soundFile);
    return item?.name || soundFile;
  };

  const formatDaysLabel = (daysArr: number[]) => {
    if (daysArr.length === 7) return 'Every day';
    if (daysArr.length === 5 && !daysArr.includes(0) && !daysArr.includes(6)) return 'Weekdays (Mon-Fri)';
    if (daysArr.length === 2 && daysArr.includes(0) && daysArr.includes(6)) return 'Weekends (Sat-Sun)';
    return daysArr.map((d) => DAYS[d]).join(', ');
  };

  return (
    <div className="flex flex-col gap-6 pb-28 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-space-800 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neon-purple">
            OS Exact Alarms
          </span>
          <h1 className="text-xl font-bold text-[var(--text-main)]">Reminders & Alarms</h1>
        </div>
        <NeonButton
          size="icon"
          onClick={handleOpenAddModal}
          aria-label="Add reminder"
          className="shadow-neon-purple"
        >
          <Plus className="w-5 h-5 text-white font-bold" />
        </NeonButton>
      </header>

      {/* Test Notification Quick Trigger */}
      <GlassCard className="p-4 space-y-3 bg-space-900 border-neon-cyan/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-neon-cyan" /> Test Exact OS Alarm
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Rings on lock screen even with app closed & swiped away
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <NeonButton
            variant="outline"
            size="sm"
            onClick={() => handleSendTestNotification(10)}
            className="text-xs font-semibold"
          >
            Test in 10s
          </NeonButton>
          <NeonButton
            variant="primary"
            size="sm"
            onClick={() => handleSendTestNotification(120)}
            className="text-xs font-bold"
          >
            Test in 2 Mins
          </NeonButton>
        </div>
      </GlassCard>

      {/* Reminders List */}
      <div className="space-y-3">
        {reminders.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-3">
            <Bell className="w-12 h-12 text-[var(--text-dim)] mx-auto animate-float" />
            <h3 className="text-base font-bold text-[var(--text-main)]">No Reminders Yet</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Tap the + button to schedule exact alarms with custom ringtones for your habits.
            </p>
            <NeonButton variant="primary" size="md" onClick={handleOpenAddModal}>
              + Add First Reminder
            </NeonButton>
          </GlassCard>
        ) : (
          reminders.map((rem) => (
            <GlassCard
              key={rem.id}
              className={`p-4 space-y-3 transition-all ${
                rem.enabled ? 'border-[var(--border-subtle)]' : 'opacity-60 border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  onClick={() => handleOpenEditModal(rem)}
                  className="space-y-1 flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neon-cyan" />
                    <span className="text-2xl font-extrabold font-mono text-[var(--text-main)] tracking-wide">
                      {rem.time}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">{rem.title}</h3>
                  <span className="text-xs text-[var(--text-muted)] block">{formatDaysLabel(rem.days)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Toggle
                    checked={rem.enabled === 1}
                    onChange={(checked) => handleToggleEnable(rem, checked)}
                  />
                  <button
                    onClick={() => handleDeleteReminder(rem.id)}
                    className="p-1.5 text-[var(--text-dim)] hover:text-rose-500 rounded-lg transition"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-neon-purple" />
                  <span>{getSoundLabel(rem.sound)}</span>
                </div>
                {rem.sound !== 'silent' && (
                  <button
                    onClick={() => handleSoundPreview(rem.sound)}
                    className="text-neon-cyan hover:underline font-semibold flex items-center gap-1"
                  >
                    {playingSound === rem.sound ? (
                      <>
                        <Square className="w-3 h-3 fill-rose-500 text-rose-500" /> Stop Sound
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-neon-cyan" /> Test Sound
                      </>
                    )}
                  </button>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Add / Edit Reminder Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReminder ? 'Edit Reminder' : 'Add Exact Reminder'}
      >
        <form onSubmit={handleSaveReminder} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Jog, Update Expenses"
              className="w-full bg-space-800 border border-[var(--border-subtle)] rounded-2xl px-4 py-2.5 text-[var(--text-main)] text-sm focus:outline-none focus:border-neon-purple"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Message / Body (Optional)
            </label>
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Time for your 20-min reading!"
              className="w-full bg-space-800 border border-[var(--border-subtle)] rounded-2xl px-4 py-2.5 text-[var(--text-main)] text-sm focus:outline-none focus:border-neon-purple"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Alarm Time *
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-space-800 border border-[var(--border-subtle)] rounded-2xl px-4 py-2.5 text-[var(--text-main)] font-mono text-base focus:outline-none focus:border-neon-purple"
            />
          </div>

          {/* Repeat Days */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Repeat Days
              </label>
              <button
                type="button"
                onClick={handleSelectEveryday}
                className="text-[11px] text-neon-purple hover:underline"
              >
                Every Day
              </button>
            </div>
            <div className="flex items-center justify-between gap-1">
              {DAYS.map((d, idx) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(idx)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                    selectedDays.includes(idx)
                      ? 'bg-neon-purple/20 border-neon-purple text-[var(--text-main)] shadow-sm'
                      : 'bg-space-800 border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                  }`}
                >
                  {d[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Sound Picker */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
              Ringtone / Sound
            </label>
            <div className="space-y-1.5">
              {SoundService.getAvailableSounds().map((snd) => (
                <div
                  key={snd.id}
                  onClick={() => setSound(snd.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                    sound === snd.id
                      ? 'border-neon-purple bg-neon-purple/15 text-[var(--text-main)]'
                      : 'border-[var(--border-subtle)] bg-space-800 text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span>{snd.name}</span>
                  {snd.id !== 'silent' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSoundPreview(snd.id);
                      }}
                      className="p-1 rounded bg-space-700 hover:bg-space-600"
                    >
                      {playingSound === snd.id ? (
                        <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
                      ) : (
                        <Play className="w-3 h-3 fill-neon-cyan text-neon-cyan" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vibrate Toggle */}
          <Toggle label="Vibrate" checked={vibrate} onChange={setVibrate} />

          <NeonButton type="submit" variant="primary" size="lg" className="w-full font-bold">
            <Check className="w-5 h-5 mr-2" />
            {editingReminder ? 'Update Reminder' : 'Save Reminder'}
          </NeonButton>
        </form>
      </Modal>
    </div>
  );
};
