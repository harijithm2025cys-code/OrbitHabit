package com.orbithabit.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.List;

/**
 * BroadcastReceiver triggered by AlarmManager when an exact reminder alarm fires.
 *
 * Posts the native high-priority notification with customized sound channel,
 * Done / Snooze action buttons, full-screen lockscreen capability,
 * and immediately calculates & arms the next occurrence.
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "OrbitHabit.AlarmReceiver";

    public static final String ACTION_DONE = "com.orbithabit.ACTION_DONE";
    public static final String ACTION_SNOOZE = "com.orbithabit.ACTION_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String id = intent.getStringExtra("id");
        String habitId = intent.getStringExtra("habit_id");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String sound = intent.getStringExtra("sound");
        boolean vibrate = intent.getBooleanExtra("vibrate", true);

        if (title == null || title.isEmpty()) {
            title = "Orbit Habit Reminder";
        }
        if (body == null || body.isEmpty()) {
            body = "Time to complete your habit mission!";
        }

        Log.i(TAG, "⏰ Alarm fired for \"" + title + "\" (id=" + id + ", habitId=" + habitId + ")");

        // Record last delivered alarm
        AlarmScheduler.recordLastDelivered(context, title, System.currentTimeMillis());

        // Post the notification
        postNotification(context, id, habitId, title, body, sound, vibrate);

        // Immediately arm the next occurrence for this reminder!
        if (id != null && !id.isEmpty()) {
            reArmNextOccurrence(context, id);
        }
    }

    private void postNotification(Context context, String id, String habitId, String title, String body, String sound, boolean vibrate) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String channelId = AlarmScheduler.getChannelId(context, sound, vibrate);
        int notifId = id != null ? Math.abs(id.hashCode() % 1_000_000_000) : 1001;

        // Content Intent: Open Habit in MainActivity
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(Intent.ACTION_VIEW);
        openIntent.putExtra("habit_id", habitId);
        openIntent.putExtra("from_notification", true);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 1: "✓ Done" button
        Intent doneIntent = new Intent(context, NotificationActionReceiver.class);
        doneIntent.setAction(ACTION_DONE);
        doneIntent.putExtra("habit_id", habitId);
        doneIntent.putExtra("notif_id", notifId);
        PendingIntent donePendingIntent = PendingIntent.getBroadcast(
                context,
                notifId + 1,
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 2: "⏱ Snooze 10m" button
        Intent snoozeIntent = new Intent(context, NotificationActionReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra("id", id);
        snoozeIntent.putExtra("habit_id", habitId);
        snoozeIntent.putExtra("title", title);
        snoozeIntent.putExtra("sound", sound);
        snoozeIntent.putExtra("vibrate", vibrate);
        snoozeIntent.putExtra("notif_id", notifId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                notifId + 2,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int iconRes = context.getResources().getIdentifier("ic_stat_orbit", "drawable", context.getPackageName());
        if (iconRes == 0) {
            iconRes = R.mipmap.ic_launcher;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .setFullScreenIntent(contentPendingIntent, true)
                .addAction(0, "✓ Done", donePendingIntent)
                .addAction(0, "⏱ Snooze 10m", snoozePendingIntent);

        if (vibrate) {
            builder.setVibrate(new long[]{0, 400, 200, 400});
        }

        nm.notify(notifId, builder.build());
        Log.i(TAG, "Notification posted for \"" + title + "\" on channel " + channelId);
    }

    private void reArmNextOccurrence(Context context, String reminderId) {
        List<AlarmScheduler.ReminderItem> reminders = AlarmScheduler.loadReminders(context);
        for (AlarmScheduler.ReminderItem item : reminders) {
            if (reminderId.equals(item.id)) {
                if (item.enabled) {
                    AlarmScheduler.armNextOccurrence(context, item);
                    AlarmScheduler.saveReminders(context, reminders);
                }
                break;
            }
        }
    }
}
