import { LocalNotifications, ScheduleOptions, PendingResult } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Reminder } from '../types/reminder';
import { habitNotifId } from '../utils/id';
import { reminderRepository } from '../db/repositories/reminderRepo';
import { useSettingsStore } from '../../store/useSettingsStore';

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
  id: number;
  title: string;
  body?: string;
  scheduledText: string;
  soundName: string;
  channelId?: string;
}

// Native helper plugin interface
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
}

const NativeAlarmHelper = registerPlugin<NativeAlarmHelperPluginType>('NativeAlarmHelper');

export class NotificationService {
  private static isInitialized = false;

  public static async initializeChannels(): Promise<void> {
    if (this.isInitialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // Register Done and Snooze action types
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'ORBIT_REMINDER_ACTIONS',
              actions: [
                {
                  id: 'DONE',
                  title: '✓ Done'
                },
                {
                  id: 'SNOOZE',
                  title: '⏱ Snooze 10m'
                }
              ]
            }
          ]
        });

        // Create high-importance notification channels for each bundled ringtone
        const ringtones = [
          { id: 'channel_ringtone_1', name: 'Orbit - Celestial Chime', sound: 'ringtone_1.mp3' },
          { id: 'channel_ringtone_2', name: 'Orbit - Upbeat Pulse', sound: 'ringtone_2.mp3' },
          { id: 'channel_ringtone_3', name: 'Orbit - Bright Resonance', sound: 'ringtone_3.mp3' },
          { id: 'channel_ringtone_4', name: 'Orbit - Deep Nebula', sound: 'ringtone_4.mp3' },
          { id: 'channel_ringtone_5', name: 'Orbit - Cosmic Bell', sound: 'ringtone_5.mp3' },
          { id: 'channel_default', name: 'Orbit - Default Alerts', sound: undefined }
        ];

        for (const ch of ringtones) {
          await LocalNotifications.createChannel({
            id: ch.id,
            name: ch.name,
            description: 'OrbitHabit exact high-priority reminder alarms',
            importance: 5, // MAX/HIGH importance for lock-screen head-up alerts
            visibility: 1, // Public visibility on lockscreen
            sound: ch.sound,
            vibration: true,
            lights: true,
            lightColor: '#00F0FF'
          });
        }
      } catch (err) {
        console.warn('Failed to create native notification channels:', err);
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

        const pending: PendingResult = await LocalNotifications.getPending();
        pendingCount = pending.notifications ? pending.notifications.length : 0;
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

  public static async getPendingList(): Promise<PendingAlarmDetails[]> {
    try {
      if (Capacitor.isNativePlatform()) {
        const pending = await LocalNotifications.getPending();
        if (!pending || !pending.notifications) return [];

        const DAYS_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return pending.notifications.map((n: any) => {
          let scheduledText = 'Scheduled Exact Alarm';
          const sched: any = n.schedule;
          if (sched) {
            if (sched.at) {
              const d = new Date(sched.at);
              scheduledText = `One-time / Next at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${d.toLocaleDateString()})`;
            } else if (sched.on) {
              const h = String(sched.on.hour ?? 0).padStart(2, '0');
              const m = String(sched.on.minute ?? 0).padStart(2, '0');
              if (sched.on.weekday !== undefined) {
                // weekday: 1 = Sun, 2 = Mon ... 7 = Sat
                const dayIdx = (sched.on.weekday - 1) % 7;
                scheduledText = `Repeats Every ${DAYS_MAP[dayIdx]} at ${h}:${m}`;
              } else {
                scheduledText = `Repeats Daily at ${h}:${m}`;
              }
            } else if (sched.every === 'day') {
              scheduledText = `Repeats Daily`;
            }
          }

          return {
            id: n.id,
            title: n.title || 'Habit Reminder',
            body: n.body || '',
            scheduledText,
            soundName: n.sound || 'Default',
            channelId: n.channelId
          };
        });
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

  public static async scheduleReminder(reminder: Reminder): Promise<void> {
    if (!reminder.enabled) return;

    try {
      await this.initializeChannels();

      const [hours, minutes] = reminder.time.split(':').map(Number);
      const soundName = reminder.sound?.replace(/\.mp3$|\.wav$/, '') || 'ringtone_1';
      const channelId =
        soundName === 'silent'
          ? undefined
          : `channel_${soundName}`;

      // Always cancel any existing slots for this reminder before rescheduling
      await this.cancelReminder(reminder.id);

      if (Capacitor.isNativePlatform()) {
        // Determine which days to schedule.
        // ALWAYS use per-weekday `on:` alarms — the `at: + every:'day'` approach
        // is unreliable on Android (drifts, misses, dies on reboot).
        const daysToSchedule: number[] =
          reminder.days && reminder.days.length > 0
            ? reminder.days
            : [0, 1, 2, 3, 4, 5, 6]; // fallback to all days

        const notificationsToSchedule: any[] = daysToSchedule.map((dayOfWeek) => ({
          // Stable, deterministic ID: same reminder + same weekday always = same notif ID
          id: habitNotifId(reminder.id, dayOfWeek),
          title: reminder.title,
          body: reminder.body || `Time for ${reminder.title}!`,
          channelId,
          sound: reminder.sound === 'silent' ? undefined : `${soundName}.mp3`,
          schedule: {
            on: {
              // Capacitor weekday: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
              // Our days[]: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
              weekday: dayOfWeek + 1,
              hour: hours,
              minute: minutes
            },
            repeats: true,
            allowWhileIdle: true
          },
          extra: {
            habit_id: reminder.habit_id,
            reminder_id: reminder.id
          },
          actionTypeId: 'ORBIT_REMINDER_ACTIONS'
        }));

        console.log(
          `[NotifService] Scheduling ${notificationsToSchedule.length} alarms for reminder "${reminder.title}" ` +
            `at ${reminder.time} on days [${daysToSchedule.join(',')}]`,
          notificationsToSchedule.map((n) => ({ id: n.id, weekday: n.schedule.on.weekday }))
        );

        const options: ScheduleOptions = { notifications: notificationsToSchedule };
        await LocalNotifications.schedule(options);
      }
    } catch (err) {
      console.error('[NotifService] Failed to schedule notification:', err);
    }
  }

  public static async cancelReminder(reminderId: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Cancel all 7 possible per-day slots derived from stable IDs
        const idsToCancel: number[] = [];
        for (let day = 0; day <= 6; day++) {
          idsToCancel.push(habitNotifId(reminderId, day));
        }
        console.log(`[NotifService] Cancelling reminder slots:`, idsToCancel);
        await LocalNotifications.cancel({
          notifications: idsToCancel.map((id) => ({ id }))
        });
      }
    } catch (err) {
      console.warn('[NotifService] Failed to cancel notification:', err);
    }
  }



  public static async sendTestNotification(
    delaySeconds = 10,
    title = 'OrbitHabit Exact Alarm Test',
    sound = 'ringtone_1.mp3'
  ): Promise<void> {
    try {
      await this.initializeChannels();
      const soundName = sound.replace(/\.mp3$|\.wav$/, '');
      const fireAt = new Date(Date.now() + delaySeconds * 1000);

      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 900000) + 100000,
              title,
              body: `High-priority exact alarm fired! Sound: ${soundName}.`,
              channelId: `channel_${soundName}`,
              sound: `${soundName}.mp3`,
              schedule: {
                at: fireAt,
                allowWhileIdle: true
              },
              actionTypeId: 'ORBIT_REMINDER_ACTIONS'
            }
          ]
        });
      } else {
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: `High-priority alarm fired! Sound: ${soundName}.` });
          }
        }, delaySeconds * 1000);
      }
    } catch (err) {
      console.warn('Test notification failed:', err);
    }
  }

  public static async cancelAllReminders(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
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

  public static async rescheduleAllReminders(): Promise<void> {
    try {
      const all = await reminderRepository.getAll();
      for (const r of all) {
        if (r.enabled) {
          await this.scheduleReminder(r);
        }
      }
    } catch (err) {
      console.warn('Failed to reschedule reminders:', err);
    }
  }
}


