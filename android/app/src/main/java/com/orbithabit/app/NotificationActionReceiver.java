package com.orbithabit.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Handles action clicks ("✓ Done", "⏱ Snooze 10m") from OrbitHabit notifications.
 */
public class NotificationActionReceiver extends BroadcastReceiver {

    private static final String TAG = "OrbitHabit.NotifAction";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        int notifId = intent.getIntExtra("notif_id", 0);

        // Cancel/dismiss the notification from the shade
        if (notifId > 0) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(notifId);
            }
        }

        if (ReminderAlarmReceiver.ACTION_DONE.equals(action)) {
            String habitId = intent.getStringExtra("habit_id");
            Log.i(TAG, "User tapped 'Done' for habit: " + habitId);

            if (habitId != null && !habitId.isEmpty()) {
                // Add to persistent queue in SharedPreferences
                AlarmScheduler.addPendingAction(context, habitId, "DONE");
            }

        } else if (ReminderAlarmReceiver.ACTION_SNOOZE.equals(action)) {
            String id = intent.getStringExtra("id");
            String habitId = intent.getStringExtra("habit_id");
            String title = intent.getStringExtra("title");
            String sound = intent.getStringExtra("sound");
            boolean vibrate = intent.getBooleanExtra("vibrate", true);

            Log.i(TAG, "User tapped 'Snooze 10m' for reminder: " + id);

            // Arm a 10-minute one-off alarm clock
            long snoozeTimeMs = System.currentTimeMillis() + (10 * 60 * 1000L);

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                int requestCode = Math.abs((id != null ? id : "snooze").hashCode() % 1_000_000_000) + 5000;

                Intent alarmIntent = new Intent(context, ReminderAlarmReceiver.class);
                alarmIntent.setAction("com.orbithabit.ALARM_TRIGGER");
                alarmIntent.putExtra("id", id);
                alarmIntent.putExtra("habit_id", habitId);
                alarmIntent.putExtra("title", title + " (Snoozed)");
                alarmIntent.putExtra("body", "Snoozed alarm reminder — 10m elapsed");
                alarmIntent.putExtra("sound", sound);
                alarmIntent.putExtra("vibrate", vibrate);

                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context,
                        requestCode,
                        alarmIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent showIntent = new Intent(context, MainActivity.class);
                showIntent.putExtra("habit_id", habitId);
                PendingIntent showPendingIntent = PendingIntent.getActivity(
                        context,
                        requestCode + 100,
                        showIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                try {
                    AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(snoozeTimeMs, showPendingIntent);
                    am.setAlarmClock(clockInfo, pendingIntent);
                    Log.i(TAG, "Snooze alarm set for 10 minutes from now");
                } catch (SecurityException se) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeTimeMs, pendingIntent);
                }
            }
        }
    }
}
