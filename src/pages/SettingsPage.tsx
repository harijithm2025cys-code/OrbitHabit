import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Shield,
  Download,
  Upload,
  Sparkles,
  RotateCcw,
  Globe,
  Edit2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Moon,
  Sun
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { GlassCard } from '../components/ui/GlassCard';
import { Toggle } from '../components/ui/Toggle';
import { NeonButton } from '../components/ui/NeonButton';
import { Modal } from '../components/ui/Modal';
import { useSettingsStore, ThemeMode } from '../store/useSettingsStore';
import { useHabitStore } from '../store/useHabitStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { BackupService } from '../core/services/backupService';
import { NotificationService, NotificationHealth } from '../core/services/notificationService';

interface SettingsPageProps {
  onNavigate: (route: string) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'AED', name: 'UAE Dirham (د.إ)' }
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate, onShowToast }) => {
  const {
    userName,
    userAge,
    userFocus,
    setProfile,
    theme,
    setTheme,
    hapticsEnabled,
    setHapticsEnabled,
    soundEnabled,
    setSoundEnabled,
    pinLockEnabled,
    setPinLock,
    currency,
    setCurrency,
    resetAllSettings
  } = useSettingsStore();

  const { loadHabits } = useHabitStore();
  const { loadAccounts } = useFinanceStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editAge, setAge] = useState(userAge);
  const [editFocus, setFocus] = useState(userFocus);

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Health Check Modal (Fix C.2)
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthStatus, setHealthStatus] = useState<NotificationHealth | null>(null);
  const [locationHealth, setLocationHealth] = useState<{
    gpsSwitchEnabled: boolean;
    fineLocationGranted: boolean;
    backgroundLocationGranted: boolean;
    notificationGranted: boolean;
    isIgnoringBattery: boolean;
  } | null>(null);
  const [pendingNotifs, setPendingNotifs] = useState<any[]>([]);
  const [isTestingNotif, setIsTestingNotif] = useState(false);

  useEffect(() => {
    setEditName(userName);
    setAge(userAge);
    setFocus(userFocus);
  }, [userName, userAge, userFocus]);

  const handleOpenHealthCheck = async () => {
    const status = await NotificationService.checkHealthStatus();
    setHealthStatus(status);
    const loc = await NotificationService.checkLocationPermissionsDetail();
    setLocationHealth(loc);
    const pending = await NotificationService.getPendingList();
    setPendingNotifs(pending);
    setShowHealthModal(true);
  };

  const handleRequestIgnoreBattery = async () => {
    await NotificationService.requestIgnoreBatteryOptimization();
    const status = await NotificationService.checkHealthStatus();
    setHealthStatus(status);
    const loc = await NotificationService.checkLocationPermissionsDetail();
    setLocationHealth(loc);
  };

  const handleOpenOemSettings = async () => {
    await NotificationService.openOemBatterySettings();
  };

  const handleOpenExactAlarmSettings = async () => {
    await NotificationService.openExactAlarmSettings();
  };

  const handleSendTestNotification = async (delaySeconds = 10) => {
    setIsTestingNotif(true);
    await NotificationService.sendTestNotification(
      delaySeconds,
      delaySeconds === 120 ? 'OrbitHabit 2-Min Exact Alarm' : 'OrbitHabit Test Alarm',
      'ringtone_1.mp3'
    );
    const pending = await NotificationService.getPendingList();
    setPendingNotifs(pending);
    if (onShowToast) {
      onShowToast(
        'info',
        `Exact alarm scheduled for ${delaySeconds}s ahead! You can swipe away app or lock screen to test.`
      );
    }
    setTimeout(() => setIsTestingNotif(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setProfile({ name: editName.trim(), age: editAge.trim(), focus: editFocus.trim() });
    setShowProfileModal(false);
    if (onShowToast) onShowToast('success', 'Profile updated successfully!');
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      setPinError('PIN must be 4 numeric digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PIN confirmation does not match.');
      return;
    }
    setPinLock(true, newPin);
    setShowPinModal(false);
    setNewPin('');
    setConfirmPin('');
    if (onShowToast) onShowToast('success', 'PIN Vault enabled for Money Ledger!');
  };

  const handleExportBackup = async () => {
    try {
      const backupStr = await BackupService.exportToJsonString();
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'OrbitHabit_Backup.json',
          text: backupStr,
          dialogTitle: 'Export OrbitHabit Backup'
        });
      } else {
        const blob = new Blob([backupStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OrbitHabit_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (onShowToast) onShowToast('success', 'Backup exported successfully!');
    } catch (err: any) {
      console.error('Export error:', err);
      if (onShowToast) onShowToast('error', 'Failed to export backup.');
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          await BackupService.importFromJsonString(text);
          await loadHabits();
          await loadAccounts();
          if (onShowToast) onShowToast('success', 'Database restored successfully from backup!');
        } catch (err: any) {
          if (onShowToast) onShowToast('error', err?.message || 'Invalid backup file.');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      if (onShowToast) onShowToast('error', 'Failed to read file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFullDatabaseWipe = async () => {
    try {
      await NotificationService.cancelAllReminders();
      await BackupService.wipeAllData();
      resetAllSettings();
      await loadHabits();
      await loadAccounts();
      setShowResetConfirmModal(false);
      setDeleteConfirmInput('');
      if (onShowToast) onShowToast('info', 'All data reset. Fresh start activated.');
      onNavigate('onboarding');
    } catch (err) {
      console.error('Failed to wipe database:', err);
      if (onShowToast) onShowToast('error', 'Failed to wipe database.');
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-32 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-neon-purple uppercase">
            Configuration
          </span>
          <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tight">
            Profile & Settings
          </h1>
        </div>
      </header>

      {/* User Profile Card (F5) */}
      <GlassCard className="p-4 flex items-center justify-between border-neon-cyan/20 bg-gradient-to-r from-space-900/90 to-space-950">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neon-cyan to-neon-purple flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            {userName.charAt(0).toUpperCase() || 'O'}
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              {userName} {userAge && <span className="text-xs text-[var(--text-muted)]">({userAge}y)</span>}
            </h2>
            <span className="text-xs text-neon-cyan font-medium block">{userFocus}</span>
          </div>
        </div>

        <button
          onClick={() => setShowProfileModal(true)}
          className="p-2.5 rounded-xl bg-space-850 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </GlassCard>

      {/* Appearance & Theme (F5) */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
          Appearance & Theme
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'dark-space' as ThemeMode, label: 'Dark Space', icon: Moon },
            { id: 'amoled' as ThemeMode, label: 'AMOLED Black', icon: Sparkles },
            { id: 'cyber-light' as ThemeMode, label: 'Cyber Light', icon: Sun }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition ${
                theme === t.id
                  ? 'bg-neon-cyan/20 border-neon-cyan text-[var(--text-main)] shadow-sm font-bold'
                  : 'bg-space-900 border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="text-[11px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Notifications & Reminders + Health Check (Fix C) */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-neon-cyan" /> Notifications & Reminders
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Manage standalone alarms and verify native device notification health.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <NeonButton
            variant="secondary"
            size="sm"
            className="w-full font-semibold"
            onClick={() => onNavigate('reminders')}
          >
            <Bell className="w-3.5 h-3.5 mr-1" /> Reminders List
          </NeonButton>
          <NeonButton
            variant="secondary"
            size="sm"
            className="w-full font-semibold text-neon-cyan border-neon-cyan/30"
            onClick={handleOpenHealthCheck}
          >
            <Activity className="w-3.5 h-3.5 mr-1" /> Health Check
          </NeonButton>
        </div>
      </GlassCard>

      {/* Currency & Financial (Fix B) */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-neon-emerald" /> Primary Currency
        </h3>
        <div className="space-y-1.5">
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              if (onShowToast) onShowToast('success', `Currency set to ${e.target.value}`);
            }}
            className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-neon-emerald"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-space-900 text-[var(--text-main)]">
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[var(--text-dim)] block font-mono">
            Default: Indian Rupee (₹) with Indian digit grouping (₹1,25,000.00).
          </span>
        </div>
      </GlassCard>

      {/* Controls & Security Toggles (Fix A) */}
      <GlassCard className="p-4 space-y-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-neon-purple" /> Controls & Security
        </h3>

        <Toggle
          checked={hapticsEnabled}
          onChange={setHapticsEnabled}
          label="Haptic Vibrations"
          description="Vibrate on habit completions and button interactions"
        />

        <Toggle
          checked={soundEnabled}
          onChange={setSoundEnabled}
          label="Sound Effects"
          description="Audio feedback on timer, workout, and alarm triggers"
        />

        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <Toggle
            checked={pinLockEnabled}
            onChange={(val) => {
              if (val) {
                setShowPinModal(true);
              } else {
                setPinLock(false);
                if (onShowToast) onShowToast('info', 'PIN Lock disabled.');
              }
            }}
            label="PIN Vault Lock"
            description="Protect Money ledger with a 4-digit PIN code"
          />
        </div>
      </GlassCard>

      {/* Data Management (F5) */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
          Data Management
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <NeonButton
            variant="secondary"
            size="sm"
            className="w-full font-semibold"
            onClick={handleExportBackup}
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export Backup
          </NeonButton>
          <NeonButton
            variant="secondary"
            size="sm"
            className="w-full font-semibold"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1" /> Restore JSON
          </NeonButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="w-full py-2 text-center text-xs font-bold text-rose-500 hover:text-rose-400 transition flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Delete All Data & Reset App
          </button>
        </div>
      </GlassCard>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Edit Profile"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-neon-cyan"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Age</label>
            <input
              type="number"
              value={editAge}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-neon-cyan"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Primary Focus</label>
            <input
              type="text"
              value={editFocus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-neon-cyan"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <NeonButton variant="secondary" size="md" className="flex-1" onClick={() => setShowProfileModal(false)}>
              Cancel
            </NeonButton>
            <NeonButton type="submit" variant="primary" size="md" className="flex-1 font-bold">
              Save Profile
            </NeonButton>
          </div>
        </form>
      </Modal>

      {/* Set PIN Modal */}
      <Modal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Set 4-Digit PIN Vault"
      >
        <form onSubmit={handleSavePin} className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Set a secure 4-digit numeric code to protect your daily cash ledger.
          </p>
          <div className="space-y-3">
            <input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New 4-digit PIN"
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-lg font-mono text-[var(--text-main)] tracking-widest focus:outline-none focus:border-neon-cyan"
            />
            <input
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Confirm 4-digit PIN"
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-center text-lg font-mono text-[var(--text-main)] tracking-widest focus:outline-none focus:border-neon-cyan"
            />
          </div>
          {pinError && <p className="text-xs text-rose-500 font-medium">{pinError}</p>}
          <div className="flex gap-3 pt-2">
            <NeonButton variant="secondary" size="md" className="flex-1" onClick={() => setShowPinModal(false)}>
              Cancel
            </NeonButton>
            <NeonButton type="submit" variant="primary" size="md" className="flex-1 font-bold">
              Lock Vault
            </NeonButton>
          </div>
        </form>
      </Modal>

      {/* Reminder Health Check Modal (Fix C.2) */}
      <Modal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        title="Exact Alarms & Battery Health"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
          {/* Device Brand & Android SDK Info */}
          {healthStatus?.deviceInfo && (
            <div className="p-3 rounded-xl bg-space-900 border border-neon-cyan/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-neon-cyan block">Detected Device</span>
                <span className="font-bold text-[var(--text-main)]">
                  {healthStatus.deviceInfo.manufacturer.toUpperCase()} {healthStatus.deviceInfo.model}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-space-800 text-[10px] font-mono text-[var(--text-muted)] border border-white/5">
                Android SDK {healthStatus.deviceInfo.sdkVersion}
              </span>
            </div>
          )}

          {/* Core System Checks */}
          <div className="space-y-2">
            {/* Notification Permission */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Notification Permission</span>
              {healthStatus?.notificationsAllowed ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Allowed
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await NotificationService.requestPermissions();
                    const s = await NotificationService.checkHealthStatus();
                    setHealthStatus(s);
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 font-bold hover:underline"
                >
                  Enable Now
                </button>
              )}
            </div>

            {/* Exact Alarms Engine */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Exact Alarms Engine</span>
              {healthStatus?.exactAlarmsAllowed ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Allowed / Ready
                </span>
              ) : (
                <button
                  onClick={handleOpenExactAlarmSettings}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold hover:underline"
                >
                  Allow Exact Alarms
                </button>
              )}
            </div>

            {/* Battery Optimization */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Battery Optimization</span>
              {healthStatus?.batteryOptimizationIgnored ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Unrestricted
                </span>
              ) : (
                <button
                  onClick={handleRequestIgnoreBattery}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold hover:underline"
                >
                  Disable Optimization
                </button>
              )}
            </div>

            {/* Sound Setting */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Sound Effects Setting</span>
              {healthStatus?.soundEnabled ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="text-rose-500 font-bold flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Muted
                </span>
              )}
            </div>
          </div>

          {/* Location & GPS Diagnostics Section */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <span className="font-bold text-[var(--text-main)] font-mono uppercase text-[11px] block">
              Outdoor GPS & Background Engine
            </span>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Phone Location Switch</span>
              {locationHealth?.gpsSwitchEnabled ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Device GPS ON
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await NotificationService.openLocationSettings();
                    setTimeout(handleOpenHealthCheck, 2000);
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 font-bold hover:underline"
                >
                  Turn ON GPS
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Precise Location Permission</span>
              {locationHealth?.fineLocationGranted ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Precise Granted
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await NotificationService.openAppSettings();
                    setTimeout(handleOpenHealthCheck, 2000);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold hover:underline"
                >
                  Grant Precise
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-space-900 border border-[var(--border-subtle)]">
              <div className="flex flex-col">
                <span className="text-[var(--text-muted)]">Background Location (Screen Off)</span>
                <span className="text-[10px] text-[var(--text-dim)]">Location → Allow all the time</span>
              </div>
              {locationHealth?.backgroundLocationGranted ? (
                <span className="text-neon-emerald font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> All The Time
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await NotificationService.openAppSettings();
                    setTimeout(handleOpenHealthCheck, 2000);
                  }}
                  className="px-2 py-0.5 rounded bg-neon-purple text-white font-bold hover:underline"
                >
                  Allow All Time
                </button>
              )}
            </div>
          </div>

          {/* OEM Background App Killing Advice */}
          <div className="p-3 rounded-xl bg-space-900/90 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-neon-purple" /> Background Protection
              </span>
              <button
                onClick={handleOpenOemSettings}
                className="text-[11px] text-neon-cyan hover:underline font-semibold"
              >
                Open Device Settings →
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Brands like Xiaomi/POCO, Samsung, Oppo, Vivo kill background apps to save battery. For 100% reliable alarms when app is closed:
            </p>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>Enable <strong>Autostart</strong> for OrbitHabit.</li>
              <li>Set Battery saver to <strong>No restrictions</strong>.</li>
              <li>Lock OrbitHabit in the recent apps tray.</li>
            </ul>
          </div>

          {/* Pending Native Alarms Live List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] font-mono uppercase text-[11px]">
                Pending OS Alarms ({pendingNotifs.length})
              </span>
              <button
                onClick={async () => {
                  const p = await NotificationService.getPendingList();
                  setPendingNotifs(p);
                }}
                className="text-[11px] text-neon-cyan hover:underline"
              >
                Refresh List
              </button>
            </div>

            {pendingNotifs.length === 0 ? (
              <p className="p-3 text-center text-[var(--text-dim)] bg-space-900 rounded-xl border border-white/5">
                No active alarms registered with OS. Create a habit reminder to schedule exact alarms.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingNotifs.map((alarm, idx) => (
                  <div
                    key={alarm.id || idx}
                    className="p-2.5 rounded-xl bg-space-900 border border-white/5 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5 truncate">
                      <span className="font-bold text-[var(--text-main)] truncate block">
                        {alarm.title}
                      </span>
                      <span className="text-[10px] text-neon-cyan font-mono block">
                        {alarm.scheduledText}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] block">
                        Audio: {alarm.soundName} • ID: {alarm.id}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-neon-emerald/15 text-neon-emerald text-[9px] font-bold shrink-0">
                      REGISTERED
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-world Test Trigger Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <NeonButton
              variant="secondary"
              size="sm"
              disabled={isTestingNotif}
              className="w-full font-semibold text-xs"
              onClick={() => handleSendTestNotification(10)}
            >
              {isTestingNotif ? 'Scheduling...' : 'Test in 10s'}
            </NeonButton>
            <NeonButton
              variant="primary"
              size="sm"
              disabled={isTestingNotif}
              className="w-full font-bold text-xs"
              onClick={() => handleSendTestNotification(120)}
            >
              {isTestingNotif ? 'Scheduling...' : 'Test in 2 Mins'}
            </NeonButton>
          </div>
          <p className="text-[10px] text-center text-[var(--text-dim)]">
            Tip: Tap "Test in 2 Mins", swipe away OrbitHabit from recents, lock the phone screen, and observe it ring at the exact minute.
          </p>
        </div>
      </Modal>

      {/* Reset All Data Safety Modal */}
      <Modal
        isOpen={showResetConfirmModal}
        onClose={() => {
          setShowResetConfirmModal(false);
          setDeleteConfirmInput('');
        }}
        title="Reset All Orbit Data?"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text-main)] leading-relaxed">
              <strong className="block font-bold text-rose-500 mb-0.5">Permanent Deletion Warning</strong>
              This will permanently delete all habits, streak history, accounts, transactions, and reminders, cancel all alarms, clear your PIN, and reset onboarding.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-main)]">
              Type <span className="text-rose-500 font-mono font-bold">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-space-900 border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[var(--text-main)] tracking-wider focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <NeonButton
              variant="secondary"
              size="md"
              className="flex-1 font-semibold"
              onClick={() => {
                setShowResetConfirmModal(false);
                setDeleteConfirmInput('');
              }}
            >
              Cancel
            </NeonButton>
            <NeonButton
              variant="danger"
              size="md"
              disabled={deleteConfirmInput.trim().toUpperCase() !== 'DELETE'}
              className={`flex-1 font-bold ${
                deleteConfirmInput.trim().toUpperCase() === 'DELETE'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] cursor-pointer text-white'
                  : 'opacity-40 cursor-not-allowed bg-rose-950/40 text-[var(--text-dim)]'
              }`}
              onClick={handleFullDatabaseWipe}
            >
              Delete Everything
            </NeonButton>
          </div>
        </div>
      </Modal>

      <footer className="text-center text-[10px] text-[var(--text-dim)] font-mono pt-4">
        100% Offline & Private • OrbitHabit v2.0
      </footer>
    </div>
  );
};
