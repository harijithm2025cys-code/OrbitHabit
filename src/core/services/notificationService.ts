import { LocalNotifications, PendingResult } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Reminder } from '../types/reminder';
import { reminderRepository } from '../db/repositories/reminderRepo';
import { logRepository } from '../db/repositories/logRepo';
import { habitRepository } from '../db/repositories/habitRepo';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useHabitStore } from '../../store/useHabitStore';
import { getTodayString, formatDateString } from '../utils/date';
import { generateId, habitNotifId } from '../utils/id';
import { HabitLog } from '../types/log';

export interface DeviceAlarmInfo {
  manufacturer: string;
  model: string;
  brand: string;
  sdkVersion: number;
  isIgnoringBatteryOptimizations: boolean;
  canScheduleExactAlarms: boolean;
}

export interface NotificationHealth {
  notificationsAllowed: boolean;
  exactAlarmsAllowed: boolean;
  soundEnabled: boolean;
  batteryOptimizationIgnored: boolean;
  pendingCount: number;
  deviceInfo?: DeviceAlarmInfo;
}

export interface PendingAlarmDetails {
  id: number | string;
  title: string;
  body?: string;
  scheduledText: string;
  soundName: string;
  channelId?: string;
  nextTriggerMs?: number;
}

export interface NativeReminderItem {
  id: string;
  habitId: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  weekdays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  sound: string;
  vibrate: boolean;
  enabled: boolean;
  nextTriggerMs?: number;
}

export interface NativePendingAction {
  habitId: string;
  action: string;
  timestamp: number;
}

interface NativeAlarmHelperPluginType {
  getDeviceInfo(): Promise<DeviceAlarmInfo>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  openOemBatterySettings(): Promise<void>;
  isLocationEnabled(): Promise<{ enabled: boolean }>;
  checkLocationPermissionsDetail(): Promise<{
    gpsSwitchEnabled: boolean;
    fineLocationGranted: boolean;
    coarseLocationGranted: boolean;
    backgroundLocationGranted: boolean;
    notificationGranted: boolean;
    isIgnoringBattery: boolean;
  }>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  scheduleReminders(options: { reminders: NativeReminderItem[] }): Promise<{ success: boolean; count: number }>;
  cancelReminders(options: { ids: string[] }): Promise<{ success: boolean }>;
  listReminders(): Promise<{ reminders: NativeReminderItem[] }>;
  getPendingActions(): Promise<{ actions: NativePendingAction[] }>;
  clearPendingActions(): Promise<{ success: boolean }>;
  getLastDeliveredAlarm(): Promise<{ title: string | null; timeMs: number }>;
  getNotificationLaunchHabitId(): Promise<{ habitId: string | null }>;
  setChatStyleEnabled(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean }>;
  isChatStyleEnabled(): Promise<{ enabled: boolean }>;
}

const NativeAlarmHelper = registerPlugin<NativeAlarmHelperPluginType>('NativeAlarmHelper');

const DAYS_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class NotificationService {
  private static isInitialized = false;

  public static async initializeChannels(): Promise<void> {
    if (this.isInitialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // Register action types for any fallback LocalNotification
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'ORBIT_REMINDER_ACTIONS',
              actions: [
                { id: 'DONE', title: '✓ Done' },
                { id: 'SNOOZE', title: '⏱ Snooze 10m' }
              ]
            }
          ]
        });
      } catch (err) {
        console.warn('Failed to register notification action types:', err);
      }
    }

    this.isInitialized = true;
  }

  public static async isLocationEnabled(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const res = await NativeAlarmHelper.isLocationEnabled();
      return res?.enabled ?? true;
    } catch {
      return true;
    }
  }

  public static async checkLocationPermissionsDetail(): Promise<{
    gpsSwitchEnabled: boolean;
    fineLocationGranted: boolean;
    coarseLocationGranted: boolean;
    backgroundLocationGranted: boolean;
    notificationGranted: boolean;
    isIgnoringBattery: boolean;
  }> {
    if (!Capacitor.isNativePlatform()) {
      return {
        gpsSwitchEnabled: true,
        fineLocationGranted: true,
        coarseLocationGranted: true,
        backgroundLocationGranted: true,
        notificationGranted: true,
        isIgnoringBattery: true
      };
    }
    try {
      const res = await NativeAlarmHelper.checkLocationPermissionsDetail();
      return {
        gpsSwitchEnabled: res?.gpsSwitchEnabled ?? true,
        fineLocationGranted: res?.fineLocationGranted ?? false,
        coarseLocationGranted: res?.coarseLocationGranted ?? false,
        backgroundLocationGranted: res?.backgroundLocationGranted ?? false,
        notificationGranted: res?.notificationGranted ?? false,
        isIgnoringBattery: res?.isIgnoringBattery ?? false
      };
    } catch {
      return {
        gpsSwitchEnabled: true,
        fineLocationGranted: true,
        coarseLocationGranted: true,
        backgroundLocationGranted: true,
        notificationGranted: true,
        isIgnoringBattery: true
      };
    }
  }

  public static async openLocationSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeAlarmHelper.openLocationSettings();
    } catch (err) {
      console.warn('openLocationSettings error:', err);
    }
  }

  public static async openAppSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeAlarmHelper.openAppSettings();
    } catch (err) {
      console.warn('openAppSettings error:', err);
    }
  }

  public static async getDeviceInfo(): Promise<DeviceAlarmInfo | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      return await NativeAlarmHelper.getDeviceInfo();
    } catch (err) {
      console.warn('NativeAlarmHelper.getDeviceInfo error:', err);
      return null;
    }
  }

  public static async requestIgnoreBatteryOptimization(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeAlarmHelper.requestIgnoreBatteryOptimization();
    } catch (err) {
      console.warn('requestIgnoreBatteryOptimization error:', err);
    }
  }

  public static async openExactAlarmSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeAlarmHelper.openExactAlarmSettings();
    } catch (err) {
      console.warn('openExactAlarmSettings error:', err);
    }
  }

  public static async openOemBatterySettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeAlarmHelper.openOemBatterySettings();
    } catch (err) {
      console.warn('openOemBatterySettings error:', err);
    }
  }

  public static async checkHealthStatus(): Promise<NotificationHealth> {
    let notificationsAllowed = false;
    let exactAlarmsAllowed = true;
    let batteryOptimizationIgnored = true;
    let pendingCount = 0;
    let deviceInfo: DeviceAlarmInfo | undefined;

    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.checkPermissions();
        notificationsAllowed = perm.display === 'granted';

        const dev = await this.getDeviceInfo();
        if (dev) {
          deviceInfo = dev;
          exactAlarmsAllowed = dev.canScheduleExactAlarms;
          batteryOptimizationIgnored = dev.isIgnoringBatteryOptimizations;
        }

        // Count pending native alarms
        const nativeList = await this.getPendingNativeReminders();
        pendingCount = nativeList.filter((r) => r.enabled).length;
      } else {
        notificationsAllowed = 'Notification' in window && Notification.permission === 'granted';
      }
    } catch (err) {
      console.warn('Health check query failed:', err);
    }

    const soundEnabled = useSettingsStore.getState().soundEnabled;

    return {
      notificationsAllowed,
      exactAlarmsAllowed,
      soundEnabled,
      batteryOptimizationIgnored,
      pendingCount,
      deviceInfo
    };
  }

  public static async getPendingNativeReminders(): Promise<NativeReminderItem[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
      const res = await NativeAlarmHelper.listReminders();
      return res?.reminders || [];
    } catch (err) {
      console.warn('listReminders error:', err);
      return [];
    }
  }

  public static async getLastDeliveredAlarm(): Promise<{ title: string | null; timeMs: number }> {
    if (!Capacitor.isNativePlatform()) return { title: null, timeMs: 0 };
    try {
      return await NativeAlarmHelper.getLastDeliveredAlarm();
    } catch {
      return { title: null, timeMs: 0 };
    }
  }

  public static async getNotificationLaunchHabitId(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      const res = await NativeAlarmHelper.getNotificationLaunchHabitId();
      return res?.habitId || null;
    } catch {
      return null;
    }
  }

  public static async getPendingList(): Promise<PendingAlarmDetails[]> {
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeList = await this.getPendingNativeReminders();
        if (nativeList && nativeList.length > 0) {
          return nativeList.map((item) => {
            const h = String(item.hour).padStart(2, '0');
            const m = String(item.minute).padStart(2, '0');
            let scheduledText = `Repeats Daily at ${h}:${m}`;
            if (item.weekdays && item.weekdays.length > 0 && item.weekdays.length < 7) {
              const daysStr = item.weekdays.map((d) => DAYS_MAP[d % 7]).join(', ');
              scheduledText = `${daysStr} at ${h}:${m}`;
            }

            if (item.nextTriggerMs && item.nextTriggerMs > 0) {
              const d = new Date(item.nextTriggerMs);
              scheduledText += ` (Next: ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
            }

            return {
              id: item.id,
              title: item.title,
              body: item.body,
              scheduledText,
              soundName: item.sound || 'ringtone_1',
              channelId: `rem_${item.sound}_${item.vibrate ? 'vib' : 'novib'}`,
              nextTriggerMs: item.nextTriggerMs
            };
          });
        }

        // Fallback to LocalNotifications pending if empty
        const pending: PendingResult = await LocalNotifications.getPending();
        if (!pending || !pending.notifications) return [];

        return pending.notifications.map((n: any) => ({
          id: n.id,
          title: n.title || 'Habit Reminder',
          body: n.body || '',
          scheduledText: 'Scheduled Alarm',
          soundName: n.sound || 'Default',
          channelId: n.channelId
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public static async requestPermissions(): Promise<boolean> {
    try {
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  }

  /**
   * Schedule a reminder natively using AlarmManager.setAlarmClock() with fallback.
   * Returns true on success, throws or returns false on failure.
   */
  public static async scheduleReminder(reminder: Reminder): Promise<boolean> {
    if (!reminder.enabled) {
      await this.cancelReminder(reminder.id);
      return true;
    }

    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const soundClean = (reminder.sound || 'ringtone_1')
        .replace(/\.mp3$|\.wav$/, '')
        .trim();

      const daysToSchedule: number[] =
        reminder.days && reminder.days.length > 0
          ? reminder.days
          : [0, 1, 2, 3, 4, 5, 6];

      if (Capacitor.isNativePlatform()) {
        // 1. Verify exact alarm permission on Android 12+ (SDK >= 31)
        const dev = await this.getDeviceInfo();
        if (dev && dev.sdkVersion >= 31 && !dev.canScheduleExactAlarms) {
          throw new Error('SCHEDULE_EXACT_ALARM_PERMISSION_REQUIRED');
        }

        // 2. Clear any lingering LocalNotifications for this reminder
        for (let d = 0; d <= 6; d++) {
          try {
            await LocalNotifications.cancel({
              notifications: [{ id: habitNotifId(reminder.id, d) }]
            });
          } catch {}
        }

        // 3. Schedule via native AlarmScheduler
        const nativeItem: NativeReminderItem = {
          id: reminder.id,
          habitId: reminder.habit_id || '',
          title: reminder.title,
          body: reminder.body || `Time for ${reminder.title}!`,
          hour: hours,
          minute: minutes,
          weekdays: daysToSchedule,
          sound: soundClean,
          vibrate: reminder.vibrate !== 0,
          enabled: true
        };

        const res = await NativeAlarmHelper.scheduleReminders({
          reminders: [nativeItem]
        });

        console.log(`[NotificationService] Native alarm armed for "${reminder.title}" at ${reminder.time}`);
        return !!res?.success;
      }

      // Non-native / Web environment
      console.log(`[NotificationService] Web reminder registered for "${reminder.title}" at ${reminder.time}`);
      return true;
    } catch (err: any) {
      console.error('[NotificationService] Failed to schedule reminder:', err);
      throw err;
    }
  }

  public static async cancelReminder(reminderId: string): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Cancel native alarm
        await NativeAlarmHelper.cancelReminders({ ids: [reminderId] });

        // Also clean up any possible LocalNotification slots
        const idsToCancel: number[] = [];
        for (let day = 0; day <= 6; day++) {
          idsToCancel.push(habitNotifId(reminderId, day));
        }
        await LocalNotifications.cancel({
          notifications: idsToCancel.map((id) => ({ id }))
        }).catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn('[NotificationService] Failed to cancel reminder:', err);
      return false;
    }
  }

  /**
   * Process pending actions queued by native notification receiver (e.g. Done clicked)
   */
  public static async processPendingActions(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const res = await NativeAlarmHelper.getPendingActions();
      const actions = res?.actions || [];
      if (actions.length === 0) return;

      console.log(`[NotificationService] Processing ${actions.length} pending notification actions:`, actions);

      for (const act of actions) {
        // Use local date when the button was tapped (act.timestamp), so Done tapped late at night counts for that day
        const actionDateStr = act.timestamp
          ? formatDateString(new Date(act.timestamp))
          : getTodayString();

        if (act.action === 'DONE' && act.habitId) {
          try {
            const habit =
              (await habitRepository.getById(act.habitId)) ||
              useHabitStore.getState().habits.find((h) => h.id === act.habitId);

            if (habit) {
              const existing = await logRepository.getLog(act.habitId, actionDateStr);
              const targetVal = habit.target_value || 1;
              const log: HabitLog = {
                id: existing?.id || generateId('log'),
                habit_id: act.habitId,
                date: actionDateStr,
                progress: targetVal,
                completed: 1,
                completed_at: act.timestamp || Date.now(),
                source: 'manual'
              };
              await logRepository.upsertLog(log);
              console.log(`[NotificationService] Applied DONE action for habit: ${habit.name} (${habit.id}) on date ${actionDateStr}`);
            }
          } catch (err) {
            console.error(`Failed to apply pending action for habit ${act.habitId}:`, err);
          }
        }
      }

      await NativeAlarmHelper.clearPendingActions();
      await useHabitStore.getState().loadHabits();
    } catch (err) {
      console.warn('[NotificationService] Error processing pending actions:', err);
    }
  }

  public static async sendTestNotification(
    delaySeconds = 10,
    title = 'OrbitHabit Exact Alarm Test',
    sound = 'ringtone_1'
  ): Promise<void> {
    try {
      const soundClean = sound.replace(/\.mp3$|\.wav$/, '');
      const testId = generateId('test_alarm');

      const now = new Date(Date.now() + delaySeconds * 1000);
      const testReminder: Reminder = {
        id: testId,
        habit_id: 'test_habit',
        title,
        body: `Exact Alarm fired on time! Sound: ${soundClean}.`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        days: [0, 1, 2, 3, 4, 5, 6],
        sound: soundClean,
        vibrate: 1,
        enabled: 1,
        notif_id: 9999
      };

      await this.scheduleReminder(testReminder);
    } catch (err) {
      console.warn('Test notification failed:', err);
    }
  }

  public static async cancelAllReminders(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeList = await this.getPendingNativeReminders();
        if (nativeList.length > 0) {
          await NativeAlarmHelper.cancelReminders({ ids: nativeList.map((r) => r.id) });
        }
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id }))
          });
        }
      }
    } catch (err) {
      console.warn('Failed to cancel all notifications:', err);
    }
  }

  /**
   * Reschedules all alarms from DB to native engine as a safety sync.
   */
  public static async rescheduleAllReminders(): Promise<void> {
    try {
      const all = await reminderRepository.getAll();
      const enabledList = all.filter((r) => r.enabled);

      if (Capacitor.isNativePlatform() && enabledList.length > 0) {
        const nativeItems: NativeReminderItem[] = enabledList.map((r) => {
          const [hours, minutes] = r.time.split(':').map(Number);
          return {
            id: r.id,
            habitId: r.habit_id || '',
            title: r.title,
            body: r.body || `Time for ${r.title}!`,
            hour: hours,
            minute: minutes,
            weekdays: r.days && r.days.length > 0 ? r.days : [0, 1, 2, 3, 4, 5, 6],
            sound: (r.sound || 'ringtone_1').replace(/\.mp3$|\.wav$/, ''),
            vibrate: r.vibrate !== 0,
            enabled: true
          };
        });

        await NativeAlarmHelper.scheduleReminders({ reminders: nativeItems });
        console.log(`[NotificationService] Safety sync: re-armed ${nativeItems.length} native alarms.`);
      }
    } catch (err) {
      console.warn('Failed to reschedule reminders safety sync:', err);
    }
  }

  /**
   * Configures whether notifications render chat-style avatar on the left (MessagingStyle).
   */
  public static async setChatStyleNotification(enabled: boolean): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAlarmHelper.setChatStyleEnabled({ enabled });
      } catch (err) {
        console.warn('Failed to set chat style notification preference:', err);
      }
    }
  }

  /**
   * Checks if chat-style notifications are enabled on the native device.
   */
  public static async isChatStyleNotification(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeAlarmHelper.isChatStyleEnabled();
        return res.enabled;
      } catch (err) {
        console.warn('Failed to query chat style preference:', err);
      }
    }
    return true;
  }
}
