export interface Reminder {
  id: string;
  habit_id: string | null;
  title: string;
  body: string;
  time: string; // 'HH:mm'
  days: number[]; // JSON array [0-6]
  sound: string; // 'ringtone_1.mp3' ... 'ringtone_5.mp3' | 'default' | 'silent'
  vibrate: number; // 0 or 1
  enabled: number; // 0 or 1
  notif_id: number; // unique integer ID for Capacitor LocalNotifications
}
